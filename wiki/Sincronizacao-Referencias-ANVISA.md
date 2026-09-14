# Guia de Sincronização de Referências ANVISA

Guia dedicado ao sistema de sincronização controlada do catálogo global de referências alimentares do MeuFenil com a tabela oficial de fenilalanina disponibilizada pela ANVISA. Cobre propósito, fluxo, regras de validação, curadoria e recuperação.

(Fonte: FEAT-0017 em `.ai/specs/current/features/FEAT-0017-sincronizacao-referencias-anvisa.md`; BR-038–BR-047 em `.ai/specs/current/domain/business-rules.md`)

## Sumário

- [Propósito](#propósito)
- [Fontes de dados](#fontes-de-dados)
- [Fluxo de sincronização](#fluxo-de-sincronizacao)
- [Modos: bootstrap e pos_bootstrap](#modos-bootstrap-e-pos_bootstrap)
- [Regras de sanitização de nomes](#regras-de-sanitizacao-de-nomes)
- [Formatação numérica](#formatacao-numerica)
- [Tratamento de duplicidade e colisões](#tratamento-de-duplicidade-e-colisoes)
- [Curadoria de pendências](#curadoria-de-pendencias)
- [Recuperação excepcional](#recuperacao-excepcional)
- [Exceções e edge cases conhecidos](#excecoes-e-edge-cases-conhecidos)
- [Referências](#referencias)

---

## Propósito

Manter o conjunto global de referências alimentares (`is_global = true`) atualizado com a tabela oficial de fenilalanina publicada pela ANVISA, sem impactar o dia a dia dos usuários e sem risco de alterações não auditadas.

A sincronização é:

- **Recorrente:** cron semanal (`0 12 * * 1` UTC — toda segunda-feira ao meio-dia)
- **Controlada:** nenhuma alteração automática sem base em comparação determinística; divergências substantivas sempre passam por curadoria humana
- **Auditável:** cada evento registrado em `referencia_eventos`; cada execução rastreável por ID único em `referencia_syncs`

A sync **não** altera dados de usuário (registros de consumo, referências pessoais, favoritos) — ela controla exclusivamente o conjunto global (`is_global = true`). (BR-038)

---

## Fontes de dados

| Componente | Detalhe |
|---|---|
| Origem | Relatório Power BI público associado à ANVISA |
| Autenticação da origem | `POWERBI_RESOURCE_KEY` (variável de ambiente — nunca hardcoded) |
| Módulos de extração | `src/shared/powerbi/` — `decode.ts`, `extract.ts`, `query-payload.ts`, `validate.ts` |
| Campo de fenilalanina | `NU_MAX_AMINOACIDO` na nomenclatura ANVISA → `fenil_mg_por_100g` no catálogo |
| Campo de nome | Nome do alimento (texto livre) |
| Campo de marca | Marca declarada quando presente; `null` quando ausente na origem |

(Fonte: `backend/api-referencias-sync.md`)

---

## Fluxo de sincronização

A sync executa 8 estágios sequenciais. Um estágio que falha interrompe a execução e registra o motivo; nenhum estágio parcialmente executado deixa o banco em estado inconsistente.

```
GATILHO (cron semanal GET / execução manual POST por admin)
   │
   ▼
[1] CLAIM SINGLE-FLIGHT
      Registra sync como 'running' no ambiente (índice parcial único).
      Segunda execução simultânea → HTTP 409; sem linha registrada.
   │
   ▼
[2] EXTRAÇÃO
      decode/extract do payload Power BI via src/shared/powerbi/
   │
   ▼
[3] VALIDAÇÃO
      Checks estruturais, de tipos e de duplicidade.
      ├── Estrutura inválida ou zero linhas válidas → abort: status origin_invalid
      ├── Anomalia de campo → rejeição individual (linha sai; sync segue)
      └── Duplicidade conflitante (mesmo nome+marca, fenil divergente)
             → par inteiro rejeitado; sync segue com as demais linhas (BR-044)
   │
   ▼
[4] SNAPSHOT
      Payload das linhas válidas + sha256 gravado em referencia_snapshots.
   │
   ▼
[5] BACKUP
      Estado atual das referências globais + sha256 gravado em referencia_backups.
      (Base para rollback e restauração — retenção: 12 meses)
   │
   ▼
[6] COMPARAÇÃO (motor puro — sem I/O)
      src/shared/referencias-sync/ (canonical.ts / compare.ts)
      Determina o modo (bootstrap ou pos_bootstrap) e gera o plano de alterações.
   │
   ▼
[7] APLICAÇÃO (RPC aplicar_sync_referencias — service_role, transação única)
      ├── pos_bootstrap: criações e arquivamentos automáticos (ator Sistema)
      ├── bootstrap: zero alterações automáticas
      └── Pendências de curadoria abertas para divergências substantivas
   │
   ▼
[8] CONCLUSÃO
      ├── success         → sem pendências abertas
      ├── pending_review  → há pendências open (admin decide na curadoria)
      ├── origin_invalid  → validação falhou antes de qualquer efeito no banco
      └── failure         → erro durante a execução (retry limpo na próxima)
```

(Fonte: FEAT-0017 Main Flow; `backend/api-referencias-sync.md`)

---

## Modos: bootstrap e pos_bootstrap

O modo determina o quanto a sync confia em si mesma para aplicar alterações automáticas. Ele é calculado pelo `derivarModoSync` no motor de comparação e não exige configuração manual.

### bootstrap

- **Quando:** o ambiente ainda não tem nenhuma sync anterior bem-sucedida (`success` ou `pending_review`) no histórico de `referencia_syncs`.
- **Comportamento:** ZERO alterações automáticas no catálogo global. Toda divergência detectada (nova referência, ausência, substituição) vira uma pendência de curadoria. O admin precisa decidir cada pendência para que a sync alcance status `success` (BR-039).
- **Por quê:** a 1ª sync nunca foi validada contra a realidade da produção — permitir arquivamentos automáticos sem esse contexto poderia remover itens erroneamente.
- **Seed de globais inativas:** no bootstrap, globais inativas sem evento de auditoria prévio recebem um evento `pre_sync_inativa` — isso registra o histórico e permite que a sync distinga bloqueio manual de arquivamento por sync em execuções futuras. (BR-042)
- **Pill de status no Admin:** "Aguardando bootstrap" (âmbar) indica que o ambiente ainda não tem matching validado.

### pos_bootstrap

- **Quando:** há pelo menos uma sync anterior bem-sucedida no histórico.
- **Comportamento:** alterações "seguras" são aplicadas automaticamente — criações de novos itens da origem e arquivamentos de globais ausentes. Divergências substantivas (mudança de nome, marca ou fenil de item existente) ainda abrem pendências de curadoria.
- **Pill de status no Admin:** "Matching validado" (esmeralda).

---

## Regras de sanitização de nomes

> **DIRETRIZ CENTRAL**
>
> Todas as validações, formatações e regras de deduplicação descritas neste guia visam **EXCLUSIVAMENTE** melhorar a visualização, evitar duplicidades e eliminar ambiguidades nos dados recebidos da ANVISA. **NUNCA alteram os valores nutricionais ou os dados originais dos alimentos.** O valor de fenilalanina (`fenil_mg_por_100g`) extraído da ANVISA é armazenado exatamente como recebido (dentro da precisão validada de 2 casas decimais), sem nenhum ajuste de conteúdo.

As regras de normalização acontecem em dois momentos distintos:

### 1. Normalização para matching (comparação)

Para decidir se um item da origem corresponde a um do catálogo, a chave canônica é:

```
chaveRef = (lower(trim(nome)), lower(trim(marca)), fenil_mg_por_100g)
```

- `lower(trim(nome))` — nome sem espaços marginais e em minúsculas (apenas para comparação)
- `lower(trim(marca))` — idem para a marca
- O **valor armazenado no banco preserva a capitalização original da fonte** — a normalização existe só para o matching, não para modificar o dado

O matching é **determinístico**: a mesma chave sempre produz o mesmo resultado. Heurísticas ou IA nunca decidem identidade — no máximo auxiliam curadoria. (BR-041)

### 2. Tratamento da marca

| Situação | Valor armazenado como `marca` |
|---|---|
| Marca declarada na origem | Texto exato da origem (ex.: `"Produto In Natura"`) |
| Marca nula ou ausente na origem | `''` (string vazia = sem marca declarada) |
| `'Produto In Natura'` | Marca declarada pelo relatório ANVISA para in natura — NÃO é `''` |

A coluna `marca` não aceita `NULL` — `''` é o canônico para "sem marca".

### 3. Rejeição de linhas inválidas

Cada linha da extração é avaliada individualmente antes de entrar no snapshot:

- Campo obrigatório ausente ou com tipo incorreto → linha rejeitada individualmente
- A rejeição é reportada com: número da linha na origem, nome do campo, motivo
- A sync **continua com as demais linhas válidas**
- A sync só aborta (status `origin_invalid`) se **nenhuma linha válida restar** após a validação

---

## Formatação numérica

O valor `fenil_mg_por_100g` (fenilalanina por 100g) é o dado central de cada referência. A precisão é fixada em **2 casas decimais** em toda a cadeia de processamento.

| Ponto da cadeia | Regra |
|---|---|
| Validação da origem | `NU_MAX_AMINOACIDO` aceito com até 2 casas; valor com mais casas ou inválido → linha rejeitada (PR #68) |
| Chave canônica (`chaveFenil`) | `fenil_mg_por_100g` com precisão `numeric(10,2)` — base do matching (BR-041) |
| Coluna no banco | `numeric(10,2)` — dev desde migration `20260911000000_referencias_fenil_numeric_10_2.sql`; prod: aplicação da migration pendente até a release |
| UI (Admin, Referências, AdicionarRegistro) | `.toFixed(2)` em todos os pontos de exibição numérica (PR #69) |

**Por que precisão fixa?** Diferenças de arredondamento causariam falsas divergências no matching. Se a origem reportar `2.300 mg` e o catálogo armazenar `2.3 mg` com precisão `numeric(10,1)`, uma comparação por texto ou float poderia indicar divergência onde não há. Com `numeric(10,2)`, ambos são `2.30 mg`.

---

## Tratamento de duplicidade e colisões

### Duplicidades exatas

Se a mesma combinação `(nome, marca, fenil_mg_por_100g)` aparecer mais de uma vez na extração da origem, as cópias são **deduplicadas silenciosamente** antes da comparação — um representante é mantido e o restante é descartado. Não gera rejeição nem pendência.

### Duplicidade conflitante (BR-044)

Quando duas ou mais linhas têm o mesmo `(nome, marca)` mas valores de `fenil_mg_por_100g` **diferentes**:

- **Comportamento:** TODAS as linhas do grupo conflitante são **rejeitadas** — o par inteiro sai do payload. Nenhum valor vence arbitrariamente.
- **Impacto:** o produto não é processado nesta execução; fica ausente do catálogo até que a origem estabilize (a ANVISA corrija os valores divergentes).
- **A sync NÃO é invalidada:** a execução segue normalmente com as demais linhas válidas. A sync só aborta se não restar nenhuma linha válida.
- **Revisão de 2026-09-14 (D-10):** a decisão original invalidava a sync inteira em caso de par conflitante. Com dados reais, pares conflitantes existem e abortar permanentemente a sync bloquearia todas as atualizações restantes. A revisão mantém o produto fora mas não prejudica o restante do catálogo.

---

## Curadoria de pendências

Pendências são divergências que não podem ser resolvidas automaticamente. Elas aparecem na aba "Pendências de curadoria" do painel Admin — acessível apenas para usuários com perfil `admin`.

### Tipos de pendência

| Tipo | Significado | O que a aprovação executa |
|---|---|---|
| `substitution` (Substituição) | Global ativa com mudança substantiva (nome, marca ou fenil) na origem | Arquiva a referência atual + cria a nova com os dados da origem (ator Sistema) |
| `absence` (Ausência) | Global ativa não encontrada na origem | Arquiva a referência (ator Sistema) |
| `new_item` (Novo item) | Item na origem sem correspondência no catálogo ativo | Cria a referência global com os dados da origem (ator Sistema) |

**Por que nunca UPDATE in-place?** A identidade de uma referência global é imutável: `(nome, marca, fenil_mg_por_100g)`. Mudar qualquer desses campos significa um produto diferente. A abordagem arquivar + criar preserva o histórico, mantém os registros de consumo vinculados íntegros e garante rastreabilidade. (BR-040)

### Fluxo de decisão

```
Pendência aberta (open)
   │
   ├── Aprovar ──→ executa a mudança por tipo
   │                  substitution: arquiva atual + cria nova
   │                  absence: arquiva atual
   │                  new_item: cria nova
   │                  (criações usam o ator Sistema como autor)
   │
   └── Rejeitar ──→ motivo obrigatório
                     divergência vira "conhecida e deliberada"
                     reapresenta em syncs futuras até nova decisão
                     não cria regra permanente (BR-043)
```

Quando todas as pendências de uma sync são decididas, a sync alcança status `success`.

### Aprovação e rejeição individual

Cada card de pendência tem botões "Aprovar" e "Rejeitar". A rejeição abre um modal exigindo o motivo (campo obrigatório). A aprovação não exige confirmação adicional.

O card exibe um diff GitHub-like com o "Antes" e o "Depois" de cada campo divergente, facilitando a decisão.

### Aprovação e rejeição em lote

A barra de ação (visível quando há pendências `open` na página atual) permite:

- **Seleção múltipla:** checkbox por card de pendência aberta. "Selecionar todos (N)" seleciona todos os itens `open` da página atual.
- **"Aprovar selecionados":** processa as pendências selecionadas sequencialmente; exige `window.confirm`.
- **"Rejeitar selecionados":** abre modal de rejeição em lote — um único motivo aplicado a todas as selecionadas.
- **Banner de resultado:** exibe o resumo após o processamento ("1 decisão registrada com sucesso." / "N decisões registradas com sucesso." / com erros se parcial, com pluralização correta).

### Botão "Aprovar tudo"

O botão **"Aprovar tudo (N)"** aparece na barra de ação quando:
- O filtro de status está em "Abertas"
- Há itens abertos na página atual

Ao acionar:
- Exibe o total real de pendências abertas (`N` — pode incluir pendências em outras páginas)
- Exige confirmação via `window.confirm`
- Processa **todas as pendências abertas**, inclusive as que estão em páginas além da atual, respeitando o filtro de sync ativo (`pendenciasSyncId`) quando aplicado
- Realiza reload único ao final (sem reloads intermediários)
- Exibe banner de resultado com contagem de sucessos e erros

Este botão é especialmente útil no modo **bootstrap**, onde todas as divergências viram pendências e precisam ser aprovadas para que a sync alcance status `success`.

---

## Recuperação excepcional

As operações de recuperação estão disponíveis apenas para admins com a flag `pode_recuperacao = true` na tabela `usuarios` (concedida manualmente pelo dono do projeto — nunca automatizada). A aba "Recuperação" no painel Admin não é renderizada para admins sem essa permissão. (BR-046)

### Rollback seletivo

O rollback desfaz somente as alterações de uma sync específica, em ordem reversa.

- **O que preserva:** alterações posteriores — se um item foi modificado novamente após a sync-alvo, o rollback o pula e registra o motivo no evento
- **Cancelamento de pendências:** pendências `open` da sync revertida são canceladas (evento `pendencia_cancelada`)
- **No-op revisado (migration `20260914000000_reverter_sync_sem_ops_cancela_pendencias.sql`):** se a sync escolhida não aplicou nenhuma alteração mas tem pendências abertas (caso típico do bootstrap), o rollback cancela as pendências e marca a sync como `reverted`. Sem alterações E sem pendências open → no-op informativo sem efeito.
- **Confirmação:** requer digitar exatamente `REVERTER` na caixa de diálogo

### Restauração por backup

A restauração devolve todo o conjunto global de referências ao estado exato de um backup.

- **Integridade:** verifica o `sha256` do payload antes de qualquer efeito; aborta se não confere
- **Escopo:** só toca referências globais (`is_global = true`); referências pessoais nunca são alteradas
- **Cancelamento de pendências:** cancela todas as pendências `open` (evento `pendencia_cancelada`)
- **Histórico preservado:** não apaga linhas de sync, pendências ou eventos — apenas cancela o estado aberto
- **Retenção dos backups:** 12 meses (trigger `trg_trim_referencia_backups`)
- **Confirmação:** requer digitar exatamente `RESTAURAR` na caixa de diálogo

---

## Exceções e edge cases conhecidos

| Situação | Comportamento |
|---|---|
| Global arquivada pela sync reaparece na origem | Tratada como NOVO item — não é reativação; cria referência com novo ID (BR-042) |
| Global bloqueada manualmente (`is_ativa = false` sem evento de arquivo por sync) | Presença na origem é silenciosa; a sync nunca a reativa (BR-042) |
| Ator Sistema ausente e plano com criações | Sync aborta com exceção orientando a executar `scripts/provisionar-ator-sistema.js` |
| Segunda execução simultânea no mesmo ambiente | HTTP 409 — single-flight por índice parcial; nenhuma linha registrada (BR-045) |
| Race condition (estado mudou durante a sync) | Exceção `23505` → rollback da transação de aplicação; sync marcada `failure`; retry limpo na próxima execução agendada |
| Pares conflitantes na origem (fenil divergente) | Par rejeitado inteiro; sync segue com o restante — revisão 2026-09-14 (BR-044) |
| 1ª extração real com volume completo em produção | Calibração de margens de validação pendente após a 1ª sync real (`[UNKNOWN]` — ver spec FEAT-0017) |
| Retenção de snapshots | Sem trim automático hoje — decisão em aberto (`[UNKNOWN]` — ver spec FEAT-0017) |

---

## Referências

- **Spec completa:** `FEAT-0017` em `.ai/specs/current/features/FEAT-0017-sincronizacao-referencias-anvisa.md`
- **Business Rules:** BR-038 a BR-047 em `.ai/specs/current/domain/business-rules.md`
- **Painel Admin (UI):** `.ai/specs/current/frontend/pages/admin.md`
- **Rota de sync:** `.ai/specs/current/backend/api-referencias-sync.md`
- **Referências Técnicas (banco, RPCs, migrations):** [Referencias-Tecnicas](Referencias-Tecnicas)
- **Funcionalidades (visão geral):** [Funcionalidades](Funcionalidades)
