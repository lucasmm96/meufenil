# Draft 001 — refinado pelo spec-assistant (2026-09-02; OQs resolvidas em 2026-09-02)

> **Status:** DRAFT — não é proposta formal. IDs gerados: **ENH-0004** em `proposed/enhancements/ENH-0004-modelo-identidade-referencias.md` (sem dependências) e **FEAT-0017** em `proposed/features/FEAT-0017-sincronizacao-referencias-anvisa.md` (com `Dependencies: ENH-0004`). Quando aprovado o conteúdo, o fluxo orquestrado cria a Issue + item no Project.
> **Origem:** solicitação do usuário — brief de sincronização de referências com o Power BI/ANVISA (texto original preservado abaixo).
> **Decisões do usuário incorporadas (2026-09-02):** divisão em 2 specs com dependência (ENH-0004 → FEAT-0017) · regras de negócio fixadas no corpo das specs · técnicas em Alternatives com Decision TBD · §§53–69 (processo) fora das specs · 8 Open Questions resolvidas nas rodadas A–C. Detalhes nas specs.

---

# Implementação da Sincronização de Referências do MeuFenil com o Power BI/ANVISA

## 1. Missão

Você é o agente principal responsável por **analisar, projetar e implementar** no repositório do MeuFenil um mecanismo seguro, auditável e recorrente de sincronização das referências de alimentos com os dados oficiais extraídos do [relatório Power BI](https://app.powerbi.com/view?r=eyJrIjoiODNlZDRiZWUtOTM3Ni00ZTBmLTgxYWUtNWUzM2ZkNTk5NTUyIiwidCI6ImI2N2FmMjNmLWMzZjMtNGQzNS04MGM3LWI3MDg1ZjVlZGQ4MSJ9) que serve como fonte dos dados da ANVISA.

Existe um projeto independente chamado `powerbi-export`, localizado atualmente em:

`C:\Users\lucas\Documents\git\powerbi-export`

Esse projeto já consegue extrair programaticamente os dados do relatório Power BI, inclusive realizando o processo necessário para decodificar os dados retornados pelo backend do Power BI. Essa parte foi validada pelo usuário e é considerada funcional.

O objetivo desta tarefa é **integrar essa capacidade ao MeuFenil**, transformando a extração existente em uma rotina de sincronização confiável, com histórico, snapshots, backups, auditoria, curadoria humana e rollback/recuperação.

> **IMPORTANTE:** não comece implementando diretamente. Primeiro faça uma investigação completa do repositório, do modelo de dados atual, dos fluxos que utilizam `referencias`, do projeto `powerbi-export` e das regras abaixo. Algumas decisões foram deliberadamente delegadas a você para análise técnica. Quando uma regra estiver explicitamente definida pelo usuário, não a substitua arbitrariamente.

---

# 2. Contexto de negócio

A tabela `referencias` contém os alimentos utilizados pelo MeuFenil. Essas referências são o coração da aplicação e constituem um dado crítico.

A fonte original desses dados é um relatório Power BI associado à ANVISA.

O relatório atualmente não oferece uma opção convencional de exportação. Os dados foram inicialmente carregados manualmente no MeuFenil. Posteriormente foi desenvolvido o `powerbi-export`, que consegue extrair os dados diretamente das chamadas realizadas pelo Power BI e decodificá-los.

A fonte pode mudar sem aviso: referências podem ser adicionadas, removidas ou ter seus dados substantivos alterados.

O MeuFenil precisa, portanto, possuir um mecanismo recorrente para:

- obter os dados atuais da origem;
- validar a confiabilidade da extração;
- comparar origem e MeuFenil;
- detectar inclusões, ausências e divergências;
- aplicar automaticamente apenas alterações consideradas seguras;
- enviar alterações substantivas para curadoria quando necessário;
- preservar histórico;
- manter rastreabilidade;
- permitir recuperação/rollback seguro;
- impedir que dados históricos sejam destruídos.

O objetivo não é simplesmente "importar novamente a tabela". É criar um **mecanismo de sincronização controlado e auditável**.

---

# 3. Regra fundamental: fidelidade à origem

Os dados provenientes da ANVISA são críticos e devem ser tratados com máxima fidelidade.

Não devemos alterar arbitrariamente dados substantivos para "encaixá-los" no modelo do MeuFenil.

Ao mesmo tempo, o MeuFenil pode possuir representações técnicas/canônicas para fins de matching.

### Definição adotada

- Dados substantivos de uma referência são considerados imutáveis depois de criados.
- Para este projeto, a identidade substantiva da referência é definida por:
  - `nome`
  - `marca`
  - `fenil_mg_por_100g`
- Se qualquer um desses três componentes mudar na origem, isso representa **uma nova referência**, e não uma atualização da referência existente.
- Não é necessário tentar descobrir se duas referências representam o mesmo produto físico em momentos diferentes.
- Campos técnicos/administrativos podem mudar quando necessário (`is_ativa`, auditoria etc.).

O conceito acima deve ser formalizado na documentação técnica da solução.

---

# 4. Estrutura dos dados

A origem possui algo semelhante a:

```json
[
  {
    "Nome do Produto": "BASE EM PÓ PARA O PREPARO DE MOLHO BRANCO BECHAMEL",
    "Marca do Produto": "KNORR",
    "NU_MAX_AMINOACIDO": 184
  }
]
```

Enquanto o MeuFenil atualmente possui algo semelhante a:

```json
[
  {
    "idx": 0,
    "id": "0002ef68-9e4a-4f0f-9b78-7960f5197756",
    "nome": "Base em pó para o preparo de molho branco bechamel (Marca: Knorr)",
    "fenil_mg_por_100g": 184,
    "criado_por": "1eb6c81e-ba37-4f6d-9457-6806b73295df",
    "is_global": true,
    "created_at": "2026-01-01 06:56:19.774852+00",
    "updated_at": "2026-01-01 06:56:19.774852+00",
    "nome_normalizado": "base em pó para o preparo de molho branco bechamel (marca: knorr)",
    "is_ativa": true
  }
]
```

Foi tomada uma decisão importante:

## O banco deve passar a armazenar separadamente

- `nome`
- `marca`
- quantidade de fenilalanina por 100g

A apresentação combinada continuará sendo feita dinamicamente no frontend.

O Claude deve investigar o schema completo e propor a melhor alteração estrutural.

Não assumir que apenas adicionar `marca` resolve o problema. Avaliar:

- constraints;
- índices;
- triggers;
- funções;
- RLS;
- foreign keys;
- queries existentes;
- componentes frontend;
- favoritos;
- registros históricos;
- exportações;
- filtros;
- ordenações;
- testes;
- migrations;
- compatibilidade retroativa;
- impacto em `nome_normalizado`;
- necessidade ou não de novos campos canônicos.

---

# 5. Modelo canônico e matching

A origem e o MeuFenil possuem formatos diferentes.

O sistema deve transformar os dados da origem em um **modelo canônico intermediário** antes do matching e da persistência.

A comparação de identidade deve ser determinística.

### Regra

A identidade é determinada por:

`nome + marca + fenil_mg_por_100g`

após aplicação das regras determinísticas de normalização/matching.

Não utilizar matching semântico para decidir identidade.

### Matching aproximado

Similaridade/heurísticas podem ser utilizadas apenas como:

- auxílio à curadoria;
- sugestão de possíveis correspondências;
- ferramenta para o administrador.

Nunca devem decidir automaticamente a identidade de uma referência.

---

# 6. Valor oficial vs. normalização

É necessário separar:

1. **valor persistido oficial**
2. **representação canônica para matching**

Os valores persistidos devem preservar o dado oficial de forma determinística.

A normalização para matching nunca deve substituir o valor oficial.

O snapshot bruto da origem e o histórico da sincronização serão responsáveis por preservar os dados exatamente como recebidos.

Não é necessário duplicar os valores brutos na tabela `referencias`, salvo se a análise técnica demonstrar uma necessidade forte.

### A normalização deve ser investigada

Você deve estudar os dados reais do `powerbi-export` e os dados existentes no MeuFenil para definir uma estratégia determinística e segura.

Avaliar especialmente:

- maiúsculas/minúsculas;
- espaços;
- acentos;
- pontuação;
- espaços duplicados;
- representações de marca;
- campos vazios;
- caracteres especiais;
- nomenclaturas de produtos in natura;
- possíveis inconsistências recorrentes da fonte.

Não usar IA/LLM para normalização determinística do matching.

---

# 7. Marca ausente / produto in natura

O Power BI frequentemente apresenta:

`NÃO SE APLICA (PRODUTO IN NATURA)`

para produtos sem marca.

O Claude deve investigar os dados reais do `powerbi-export` e recomendar a melhor representação no banco.

Preferência do usuário:

> Se tecnicamente seguro e sem perda de fidelidade, normalizar para um valor canônico como `Produto In Natura`.

Porém, a decisão final deve ser baseada nos dados reais e documentada.

---

# 8. Conjunto controlado pela sincronização

A sincronização deve controlar:

`is_global = true`

Somente referências globais pertencem ao conjunto oficial controlado pela origem Power BI/ANVISA.

Referências não globais não devem ser afetadas pela sincronização oficial.

O Claude deve investigar como `is_global` é utilizado atualmente antes de implementar a regra.

---

# 9. is_global

A política final de alteração manual de `is_global` ainda deve ser determinada após investigação do sistema atual.

O Claude deve:

- localizar todos os usos de `is_global`;
- identificar quem pode alterá-lo;
- analisar RLS;
- analisar fluxos administrativos;
- verificar se existem referências globais criadas manualmente;
- avaliar consequências futuras da alteração.

A recomendação deve priorizar segurança e coerência com o modelo de sincronização.

---

# 10. is_ativa

`is_ativa` representa se a referência está atualmente disponível para uso normal.

Uma referência arquivada:

- não deve ser usada para novos registros;
- deve permanecer disponível para histórico;
- pode continuar aparecendo em registros antigos;
- deve ser visualmente identificada como arquivada/indisponível;
- não deve ser fisicamente excluída.

### Favoritos

Quando uma referência for arquivada, ela deve permanecer nos favoritos.

O trigger atual:

`trg_remover_favoritos_referencia_inativa`

entra em conflito com essa regra e deverá ser analisado/removido/alterado.

A UX esperada é:

- referência permanece favoritada;
- aparece como arquivada/indisponível;
- não pode ser utilizada em novos registros;
- o usuário pode desfavoritá-la normalmente.

---

# 11. Mudanças substantivas na origem

Se a origem alterar qualquer um destes:

- nome;
- marca;
- fenilalanina;

não atualizar a referência existente.

A referência antiga deve permanecer histórica e ser arquivada, e uma nova referência deve ser criada somente quando a alteração for aprovada pela curadoria.

### Exemplo

Origem:

`Produto X / Knorr / 184`

passa para:

`Produto X / Knorr / 210`

Isso significa:

- referência antiga = removida/arquivada;
- nova referência = adicionada.

Não representar internamente como UPDATE da referência.

---

# 12. Histórico e diff

No histórico da sincronização, uma alteração deve ser representada como:

- referência removida;
- referência adicionada.

Mesmo que visualmente a interface possa indicar a relação entre elas, o modelo de referências permanece baseado em registros imutáveis.

O histórico deve possuir um **diff visual semelhante ao GitHub**, permitindo entender claramente:

- valor anterior;
- valor novo;
- campos alterados.

---

# 13. Curadoria humana

Alterações substantivas devem poder ser submetidas à curadoria administrativa.

### Aprovar

Aprovar significa:

1. arquivar a referência antiga;
2. criar nova referência;
3. registrar a decisão;
4. registrar auditoria;
5. registrar o diff.

### Rejeitar

Rejeitar significa:

- não alterar a referência atual;
- registrar a decisão;
- registrar o motivo;
- manter a divergência como conhecida e deliberada.

A curadoria deve permitir:

- aprovar;
- rejeitar;
- informar motivo.

Não adicionar estados complexos sem necessidade.

---

# 14. Curadoria é independente por sincronização

Cada sincronização é independente.

Uma decisão tomada na Sync #10:

- pertence à Sync #10;
- não cria regra permanente;
- não impede que a mesma divergência seja apresentada na Sync #11.

Se a origem continuar diferente, a divergência pode reaparecer.

Uma rejeição não deve ser tratada como erro.

---

# 15. Estado "sincronizado"

"Sincronizado" não significa necessariamente que MeuFenil e origem são byte-a-byte idênticos.

A definição é:

> O sistema está sincronizado quando não existem divergências desconhecidas.

Uma divergência rejeitada conscientemente pelo administrador:

- é conhecida;
- é auditada;
- é um estado válido;
- não impede que a sincronização seja considerada concluída.

---

# 16. Ausência na origem e comparação bidirecional

A sincronização deve fazer comparação bidirecional.

É obrigatório detectar:

1. presentes na origem e ausentes no MeuFenil;
2. presentes no MeuFenil e ausentes na origem;
3. presentes em ambos, mas com dados substantivos divergentes.

### Referência presente no MeuFenil e ausente na origem

Uma única sincronização confiável na qual uma referência ativa não seja encontrada na origem é suficiente para arquivá-la.

Porém:

> Uma sincronização que não seja considerada confiável jamais pode produzir arquivamentos ou criações.

---

# 17. Referências arquivadas e reaparência

Referências com:

`is_ativa = false`

são históricas.

Elas ficam fora da comparação normal de existência.

Existe uma distinção importante:

### Arquivada pela origem

Se uma referência foi arquivada porque desapareceu da origem e posteriormente reaparecer:

- ela NÃO deve ser reativada;
- deve nascer uma nova referência;
- a referência antiga continua histórica.

### Bloqueada manualmente

Se um Admin arquivou manualmente:

- o bloqueio administrativo deve ser preservado;
- a sincronização não deve reativá-la automaticamente;
- se o produto estiver presente na origem, isso não é considerado divergência;
- o sistema deve preservar silenciosamente esse bloqueio.

O Claude deve analisar o modelo atual, incluindo auditoria, e propor o mecanismo mais seguro e simples para distinguir os dois casos.

---

# 18. Reativação

Regra de negócio preferida:

> Uma referência arquivada não volta a ficar ativa.

Se reaparecer na origem, cria-se uma nova referência.

O usuário quer que o Claude avalie criticamente essa regra durante o design, mas não a substitua sem apresentar justificativa técnica/negocial.

---

# 19. Referências globais fora da origem

Toda referência com:

`is_global = true`

deve obrigatoriamente possuir origem no conjunto Power BI/ANVISA.

Não deve existir legitimamente uma referência global criada manualmente fora da origem.

O procedimento de bootstrap deve tratar isso cuidadosamente.

---

# 20. Bootstrap inicial

Já existem referências globais no banco, carregadas manualmente no passado.

O primeiro processo de sincronização não pode simplesmente assumir que tudo já está perfeitamente associado à origem.

Deve existir um processo seguro de bootstrap/migração que:

- preserve os dados atuais;
- extraia uma linha de base da origem;
- faça matching determinístico;
- identifique equivalências;
- identifique referências atuais sem correspondência;
- identifique itens da origem sem correspondência;
- detecte divergências;
- estabeleça o estado inicial da sincronização;
- evite arquivamentos/criações indevidos durante a implantação.

Para referências globais existentes no MeuFenil e ausentes na primeira origem, o Claude deve definir uma estratégia de bootstrap segura.

Não assumir automaticamente que devem ser arquivadas.

---

# 21. Duplicidades na origem

### Duplicidade exata

Mesmos:

- nome;
- marca;
- fenilalanina.

Pode ser deduplicada automaticamente para fins de sincronização.

### Duplicidade conflitante

Mesmos nome/marca, mas fenilalanina diferente, ou outra combinação substantiva conflitante:

> Deve invalidar a sincronização.

Não aplicar alterações provenientes de uma origem estruturalmente inconsistente.

---

# 22. Validação da extração

Existe uma preocupação específica com quantidade de registros.

Se houver variação acima da margem aceitável:

1. tentar novamente a extração;
2. somente depois decidir se a sincronização deve ser abortada ou entrar em estado de falha.

Além disso, o Claude deve investigar o `powerbi-export` e propor todas as validações necessárias, incluindo, quando aplicável:

- quantidade;
- campos obrigatórios;
- tipos;
- estrutura;
- valores inválidos;
- `null`;
- duplicidades;
- duplicidades conflitantes;
- fenilalanina inválida;
- nomes vazios;
- marcas inválidas;
- mudanças anômalas;
- estrutura inesperada da resposta;
- dados truncados;
- payload incompleto;
- qualquer outro indicador que possa sugerir extração corrompida.

Uma extração considerada não confiável:

> não pode criar referências, arquivar referências ou aplicar alterações substantivas.

---

# 23. Atomicidade

Se ocorrer falha técnica durante a aplicação das alterações, o Claude deve projetar a estratégia mais segura considerando:

- PostgreSQL/Supabase;
- volume atual;
- transações;
- RLS;
- Edge Functions;
- concorrência;
- possibilidade de falha no meio da operação.

A prioridade é evitar estado inconsistente.

Não assumir simplesmente que operações parcialmente aplicadas são aceitáveis.

Apresente a estratégia técnica antes da implementação.

---

# 24. Sincronização como unidade

Uma sincronização é uma execução completa do processo:

`extração -> validação -> comparação -> aplicação/pendências -> conclusão`

Ela deve possuir um único ID.

Todas as etapas, eventos, pendências, snapshots e backups relacionados devem poder ser rastreados por esse ID.

O Claude pode criar identificadores técnicos adicionais se necessário, mas deve existir uma entidade agrupadora de sincronização.

---

# 25. Snapshot da origem

Devem ser preservados snapshots da origem.

O snapshot deve preservar o payload bruto retornado pelo `powerbi-export`, de modo que seja possível reconstruir o estado observado na sincronização.

O snapshot é diferente do backup do banco.

---

# 26. Backup do banco

Antes de cada nova sincronização/importação:

> deve ser criado um backup completo da tabela `referencias`.

O backup representa o estado anterior à aplicação daquela sincronização.

Retenção:

> manter backups dos últimos 12 meses.

O Claude deve projetar:

- armazenamento;
- compressão, se apropriado;
- integridade;
- retenção;
- limpeza automática;
- proteção contra exclusão acidental;
- RLS;
- custo;
- auditoria.

---

# 27. Snapshot + backup

Devem existir ambos:

### Snapshot da origem

"O que a fonte dizia?"

### Backup do MeuFenil

"O que o MeuFenil possuía antes da sincronização?"

Esses dois artefatos são fundamentais para auditoria e recuperação.

---

# 28. Pendências e backup

Pendências devem estar vinculadas à sincronização que as originou.

Essa sincronização deve permitir rastrear:

- snapshot;
- backup;
- alterações propostas;
- alterações aplicadas;
- pendências;
- decisões de curadoria;
- auditoria;
- resultado final.

---

# 29. Rollback seletivo

O mecanismo exato deve ser projetado pelo Claude com foco em segurança.

Porém existe uma regra importante:

> O rollback deve desfazer somente as alterações produzidas pela sincronização escolhida, preservando alterações posteriores.

Não utilizar simplesmente o backup antigo para sobrescrever todo o estado atual, pois isso poderia destruir alterações posteriores.

O backup completo ainda existe como mecanismo de recuperação excepcional.

---

# 30. Restauração excepcional de backup

A restauração deve:

- criar um novo evento de recuperação no histórico;
- preservar todas as sincronizações anteriores como eventos históricos;
- preservar todas as sincronizações posteriores como eventos históricos;
- fazer o estado atual do banco refletir o backup restaurado;
- possuir rastreabilidade completa;
- exigir autorização apropriada;
- nunca apagar o histórico.

O Claude deve projetar o mecanismo mais seguro.

---

# 31. Permissão para rollback/recuperação

Rollback/recuperação não deve ser uma operação administrativa comum.

Deve existir uma permissão/role específica.

O Claude deve integrar isso ao modelo de autorização atual e avaliar:

- `usuarios.role`;
- RLS;
- permissões existentes;
- Edge Functions;
- auditoria.

Não criar um sistema de autorização paralelo se o atual puder ser estendido adequadamente.

---

# 32. Pendência cancelada/revertida

Quando uma pendência for afetada por rollback/restauração:

- deve ser marcada como cancelada/revertida;
- deve permanecer no histórico;
- não pode receber nova decisão;
- deve continuar rastreável à sincronização original.

---

# 33. is_ativa manual

Admin pode alterar `is_ativa` manualmente.

Toda alteração manual precisa ser auditada.

Se um Admin definir:

`is_ativa = false`

isso deve funcionar como bloqueio administrativo.

A sincronização não deve reativá-lo automaticamente.

---

# 34. Exclusão física

Referências nunca devem ser excluídas fisicamente pela aplicação.

Exclusão física só pode ocorrer através de:

- procedimento técnico;
- migration;
- operação controlada de manutenção.

Dados históricos são críticos.

---

# 35. Diff

O histórico administrativo deve permitir visualizar diferenças entre versões/referências.

Preferência visual:

> aparência semelhante ao diff do GitHub.

Exemplo conceitual:

```diff
- nome: Produto X
+ nome: Produto X Especial

- marca: Knorr
+ marca: Outra Marca

- fenil_mg_por_100g: 184
+ fenil_mg_por_100g: 210
```

---

# 36. Auditoria

Toda operação relevante deve ser auditável.

No mínimo:

- sincronização iniciada;
- extração;
- validação;
- resultado;
- backup criado;
- snapshot criado;
- referência criada;
- referência arquivada;
- mudança aprovada;
- mudança rejeitada;
- motivo;
- alteração manual de `is_ativa`;
- operações de rollback;
- restauração;
- cancelamento/reversão de pendência.

O Claude deve avaliar o sistema de auditoria existente antes de criar outro.

---

# 37. Segurança

Avaliar especialmente:

- RLS;
- permissões;
- funções `SECURITY DEFINER`;
- usuário técnico/sistema;
- `criado_por`;
- execução via Edge Function;
- acesso aos snapshots;
- acesso aos backups;
- exposição de dados;
- autorização de operações destrutivas;
- concorrência;
- idempotência.

Para referências criadas automaticamente pela sincronização, a preferência do usuário é:

> usar um ator "Sistema".

Porém o Claude deve analisar o schema/RLS atual e definir a melhor implementação.

---

# 38. `criado_por`

Atualmente:

```sql
criado_por uuid not null default auth.uid()
```

A sincronização automática provavelmente não terá um usuário humano autenticado.

O Claude deve investigar a melhor solução:

- usuário técnico/sistema;
- usuário especial;
- nullable;
- outro mecanismo.

Preferência do usuário:

> "Sistema".

Não quebrar integridade referencial.

---

# 39. Schema atual conhecido

O schema atual da tabela é:

```sql
create table public.referencias (
  id uuid not null default gen_random_uuid (),
  nome text not null,
  fenil_mg_por_100g real not null,
  criado_por uuid not null default auth.uid (),
  is_global boolean not null default false,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  nome_normalizado text not null,
  is_ativa boolean not null default true,
  constraint referencias_pkey primary key (id),
  constraint referencias_criado_por_fkey foreign KEY (criado_por) references usuarios (id) on delete CASCADE
) TABLESPACE pg_default;

create unique INDEX if not exists referencias_nome_unique
on public.referencias using btree (lower(nome));

create unique INDEX if not exists referencias_nome_normalizado_unique
on public.referencias using btree (nome_normalizado);

create trigger trg_normalizar_nome_referencia
BEFORE INSERT OR UPDATE ON referencias
FOR EACH ROW
EXECUTE FUNCTION fn_normalizar_nome_referencia ();

create trigger trg_remover_favoritos_referencia_inativa
AFTER UPDATE OF is_ativa ON referencias
FOR EACH ROW
EXECUTE FUNCTION fn_remover_favoritos_referencia_inativa ();
```

**Este schema não deve ser tratado como definitivo.**

Investigue o banco inteiro antes de decidir.

---

# 40. Atenção especial aos índices atuais

O índice:

`referencias_nome_unique`

pode ser incompatível com a nova realidade de referências historicamente imutáveis.

É possível que duas referências históricas possuam o mesmo nome em momentos diferentes.

Da mesma forma:

`referencias_nome_normalizado_unique`

precisa ser reavaliado.

Analise:

- se unicidade deve considerar apenas referências ativas;
- se deve considerar `is_global`;
- se referências históricas podem coexistir;
- se nome + marca + fenilalanina é a identidade correta;
- se índices parciais são necessários;
- se o índice deve ser substituído por um índice de identidade canônica;
- impacto em RLS e performance.

Não preserve constraints atuais apenas por compatibilidade.

---

# 41. Exatidão da fenilalanina

Investigue se:

`real`

é o tipo adequado para representar a quantidade de fenilalanina.

Avalie:

- precisão;
- comparação;
- normalização;
- possíveis casas decimais;
- necessidade de `numeric`;
- compatibilidade com dados existentes;
- impacto em matching.

Se sugerir mudança, documente o motivo.

---

# 42. Idempotência

A sincronização deve ser idempotente.

Executar duas vezes a mesma origem válida não deve:

- duplicar referências;
- arquivar novamente;
- criar múltiplas referências equivalentes;
- gerar alterações artificiais;
- corromper histórico.

O Claude deve projetar explicitamente como reconhecer o mesmo snapshot/origem e manter a idempotência.

---

# 43. Concorrência

Investigue o que ocorre se:

- duas sincronizações iniciarem simultaneamente;
- um Admin fizer curadoria durante uma sincronização;
- um Admin alterar uma referência manualmente enquanto uma sincronização estiver aplicando alterações;
- ocorrer rollback durante uma sincronização;
- houver falha no meio da operação.

Defina locks, estados, constraints ou mecanismos adequados.

---

# 44. Estados

A sincronização precisa distinguir, no mínimo conceitualmente:

- sucesso;
- falha técnica;
- origem inválida;
- pendências de curadoria;
- concluída com divergências conhecidas;
- cancelada/revertida;
- restaurada.

Não necessariamente criar todos esses estados como enum/coluna sem necessidade. O Claude deve propor o modelo mais simples que preserve as informações necessárias.

---

# 45. UI administrativa

A implementação deve incluir, quando aplicável:

- histórico de sincronizações;
- status;
- data/hora;
- quantidade encontrada;
- quantidade criada;
- quantidade arquivada;
- divergências;
- pendências;
- decisões;
- snapshots;
- backups;
- diff;
- rollback;
- recuperação;
- auditoria.

Não construir uma interface excessivamente complexa se o fluxo puder ser claro e simples.

---

# 46. Retenção

Backups:

- últimos 12 meses.

Snapshots:

- o Claude deve avaliar a política de retenção adequada, considerando auditoria, custo e necessidade de reconstrução.

Histórico de sincronização e auditoria:

- não devem ser removidos de forma a comprometer rastreabilidade;
- se houver necessidade de retenção, o Claude deve justificar.

---

# 47. Testes

O projeto deve manter alto nível de cobertura.

A implementação precisa:

1. criar testes para toda funcionalidade nova;
2. revisar testes existentes relacionados a `referencias`;
3. revisar testes de favoritos;
4. revisar registros de consumo;
5. revisar RLS;
6. revisar triggers;
7. revisar funções;
8. revisar frontend;
9. testar migrations;
10. testar sincronização;
11. testar falhas;
12. testar rollback;
13. testar restauração;
14. testar bootstrap;
15. testar idempotência;
16. testar concorrência quando viável.

Não considerar a tarefa concluída apenas porque os testes novos passam.

Faça uma revisão de cobertura funcional:

> Toda funcionalidade oferecida pela aplicação relacionada a referências deve continuar coberta por testes.

---

# 48. Migrations

Toda alteração de schema deve ser feita por migration versionada.

Antes de criar migration:

- investigar migrations existentes;
- verificar objetos não versionados;
- evitar conflito;
- verificar ordem;
- verificar produção/dev;
- verificar reversibilidade quando possível.

---

# 49. Projeto `powerbi-export`

Você deve analisar o projeto real.

Investigue:

- como a extração é iniciada;
- dependências;
- linguagem;
- CLI/API;
- saída;
- erros;
- timeout;
- retries;
- estrutura do JSON;
- possibilidade de importação como biblioteca;
- possibilidade de execução como processo;
- licenciamento/dependências;
- variáveis de ambiente;
- credenciais;
- limitações;
- comportamento quando o Power BI muda;
- testes existentes.

A integração deve reutilizar o trabalho existente sempre que tecnicamente seguro.

Não copie e cole código desnecessariamente.

---

# 50. Arquitetura de integração

O `powerbi-export` está separado do MeuFenil.

Avalie cuidadosamente:

- biblioteca;
- pacote;
- processo externo;
- script;
- submódulo;
- outra forma de integração.

Escolha a solução que ofereça melhor equilíbrio entre:

- manutenção;
- confiabilidade;
- simplicidade;
- segurança;
- deploy;
- observabilidade.

O MeuFenil já possui infraestrutura de background/cron no Vercel e Supabase.

Avalie como essa infraestrutura pode ser aproveitada.

---

# 51. Agendamento

O mecanismo precisa ser recorrente.

Avalie a melhor forma de integrá-lo ao cron/background já existente.

Considere:

- timeout;
- memória;
- payload;
- execução longa;
- retries;
- idempotência;
- locks;
- logs;
- observabilidade.

---

# 52. Princípios arquiteturais

Prioridades:

1. **integridade dos dados**
2. **segurança**
3. **rastreabilidade**
4. **preservação histórica**
5. **confiabilidade da extração**
6. **idempotência**
7. **simplicidade**
8. **manutenibilidade**
9. **boa UX**
10. **performance**

Não construir uma solução excessivamente sofisticada sem necessidade.

---

# 53. O que está deliberadamente delegado ao Claude

Você deve investigar e recomendar soluções para pontos ainda não totalmente definidos, especialmente:

- arquitetura de integração com `powerbi-export`;
- normalização canônica;
- representação de produto in natura;
- política de `is_global`;
- representação de sistema em `criado_por`;
- distinção entre arquivamento automático e manual;
- mecanismo técnico de rollback;
- mecanismo técnico de restauração;
- atomicidade;
- estados internos;
- locks;
- idempotência;
- retenção de snapshots;
- definição de "utilizado recentemente", caso necessária;
- bootstrap;
- estrutura final do schema;
- índices;
- tipo numérico da fenilalanina;
- validações adicionais;
- UX da curadoria;
- arquitetura dos jobs;
- modelo de auditoria.

Para cada decisão delegada:

1. investigue o código real;
2. apresente alternativas;
3. explique trade-offs;
4. recomende uma;
5. implemente somente após estabelecer a decisão.

---

# 54. Metodologia obrigatória de trabalho

Esta tarefa é grande.

**Não tente resolvê-la em uma única etapa monolítica.**

Divida o trabalho em fases claramente definidas.

A sessão principal deve atuar como coordenadora.

Use sub-agentes quando possível para investigações independentes, especialmente:

- banco/schema;
- frontend;
- testes;
- `powerbi-export`;
- arquitetura de sincronização;
- segurança/RLS;
- UX/admin;
- migrations;
- auditoria/rollback.

Cada sub-agente deve receber apenas o contexto necessário para seu trabalho.

A sessão principal deve:

- consolidar resultados;
- resolver conflitos;
- manter as decisões;
- impedir que sub-agentes alterem partes incompatíveis;
- revisar o trabalho antes de avançar.

---

# 55. Fase 0 — Descoberta

Antes de alterar qualquer código:

### Investigar o MeuFenil

Mapear:

- estrutura do projeto;
- tabela `referencias`;
- todas as queries;
- hooks;
- contextos;
- páginas;
- componentes;
- favoritos;
- registros;
- exports;
- Admin;
- RLS;
- migrations;
- triggers;
- functions;
- testes;
- cron/background;
- auditoria existente;
- permissões.

### Investigar `powerbi-export`

Mapear toda a arquitetura e o fluxo de extração.

### Resultado esperado

Produzir uma análise contendo:

- arquitetura atual;
- dependências;
- pontos de impacto;
- riscos;
- decisões que precisam ser tomadas.

Não implementar ainda.

---

# 56. Fase 1 — Design

Produzir um design técnico completo.

Definir:

- modelo de dados;
- migrations;
- entidades;
- relacionamentos;
- estados;
- matching;
- normalização;
- snapshots;
- backups;
- auditoria;
- curadoria;
- rollback;
- restauração;
- bootstrap;
- jobs;
- locks;
- idempotência;
- segurança;
- RLS;
- UX.

Antes de codificar, revisar se todas as regras deste prompt estão representadas.

---

# 57. Fase 2 — Schema/migração

Implementar a estrutura necessária.

Priorizar:

- integridade;
- constraints;
- índices;
- RLS;
- funções;
- triggers;
- compatibilidade histórica.

Não destruir dados existentes.

A migração inicial deve preservar os registros atuais.

---

# 58. Fase 3 — Integração da extração

Integrar `powerbi-export`.

Implementar:

- execução;
- timeout;
- retry;
- validação;
- snapshot;
- tratamento de erro.

Uma origem inválida deve ser rejeitada antes de produzir mudanças.

---

# 59. Fase 4 — Motor de comparação

Implementar:

- origem → MeuFenil;
- MeuFenil → origem;
- divergências;
- matching;
- normalização;
- duplicidades;
- novos;
- ausentes;
- alterações substantivas.

Tudo deve ser determinístico.

---

# 60. Fase 5 — Aplicação

Implementar:

- criação;
- arquivamento;
- geração de pendências;
- auditoria;
- transação;
- idempotência.

Nenhuma alteração deve ser aplicada antes de passar pelas validações necessárias.

---

# 61. Fase 6 — Curadoria

Implementar no painel:

- lista de pendências;
- detalhes;
- diff;
- aprovar;
- rejeitar;
- motivo;
- histórico.

Aprovar alteração substantiva:

`arquivar antigo + criar novo`

Rejeitar:

`nenhuma alteração`

---

# 62. Fase 7 — Histórico, backup e recuperação

Implementar:

- snapshot;
- backup;
- histórico;
- rollback seletivo;
- restauração excepcional;
- cancelamento/reversão de pendências;
- auditoria.

---

# 63. Fase 8 — Bootstrap

Criar mecanismo seguro para transformar o estado atual em estado sincronizável.

Não executar arquivamentos destrutivos automaticamente sem garantir que a origem e o matching estão confiáveis.

---

# 64. Fase 9 — UX

Ajustar:

- referências;
- favoritos;
- registros históricos;
- seleção de novos alimentos;
- indicação de arquivamento;
- Admin;
- curadoria;
- histórico.

---

# 65. Fase 10 — Testes e auditoria final

Executar:

- testes unitários;
- integração;
- banco;
- RLS;
- frontend;
- E2E se existente;
- sincronização;
- falhas;
- rollback;
- restauração;
- bootstrap.

Depois revisar manualmente:

> "Existe alguma funcionalidade existente relacionada a referências que agora está sem cobertura?"

---

# 66. Regra sobre `.ai/.temp`

Use `.ai/.temp` para artefatos temporários de análise quando isso fizer sentido.

Artefatos temporários não devem ser apagados imediatamente após serem usados.

Depois que estiverem resolvidos:

- preserve uma janela/forma de recuperação;
- só então faça cleanup;
- não remova irreversivelmente algo que ainda possa ser necessário.

---

# 67. Critério de conclusão

A tarefa só pode ser considerada concluída quando:

- a extração funciona;
- a origem é validada;
- snapshots são preservados;
- backups são preservados;
- matching é determinístico;
- comparação é bidirecional;
- alterações substantivas não sobrescrevem referências;
- referências históricas são preservadas;
- arquivamento é lógico;
- favoritos são preservados;
- curadoria funciona;
- rejeições são auditadas;
- rollback é seguro;
- restauração é auditada;
- bootstrap está definido/implementado;
- RLS está correto;
- migrations estão versionadas;
- testes cobrem o comportamento;
- idempotência está garantida;
- concorrência foi tratada;
- cron/background está integrado;
- UX está coerente;
- documentação foi atualizada.

---

# 68. Regra de ouro

Sempre que houver conflito entre:

- conveniência de implementação
- e integridade histórica dos dados,

prefira preservar os dados.

Sempre que houver dúvida entre:

- automatizar uma alteração;
- e pedir curadoria,

prefira curadoria.

Sempre que houver dúvida sobre a origem:

- não aplique alterações destrutivas.

Sempre que houver necessidade de recuperar estado:

- preserve o histórico;
- crie um novo evento de recuperação;
- não apague eventos anteriores.

---

# 69. Primeira ação obrigatória

**Não implemente nada ainda.**

Comece pela Fase 0.

Analise profundamente:

1. o repositório MeuFenil;
2. o schema/migrations atuais;
3. todos os fluxos de `referencias`;
4. favoritos;
5. registros;
6. Admin;
7. RLS;
8. auditoria;
9. testes;
10. cron/background;
11. `powerbi-export`.

Depois produza uma análise consolidada contendo:

- entendimento do sistema atual;
- pontos de impacto;
- inconsistências encontradas;
- decisões ainda necessárias;
- riscos;
- proposta arquitetural inicial;
- plano de fases;
- distribuição de tarefas entre sub-agentes.

**Não avance para implementação enquanto as decisões arquiteturais críticas não estiverem claras.**

A sessão principal deve coordenar os sub-agentes e revisar seus resultados antes de consolidar o design final.
