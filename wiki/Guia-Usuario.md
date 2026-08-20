# Guia do Usuário

Bem-vindo ao **MeuFenil**! Este guia explica, em linguagem simples, como usar o aplicativo para controlar a ingestão diária de fenilalanina. Cada seção traz o passo a passo das principais funcionalidades.

## Sumário

- [Primeiro acesso e entrada no aplicativo](#primeiro-acesso-e-entrada-no-aplicativo)
- [Registro diário de consumo](#registro-diario-de-consumo)
- [Acompanhamento do limite diário](#acompanhamento-do-limite-diario)
- [Dashboard (visão do dia)](#dashboard-visao-do-dia)
- [Histórico de registros](#historico-de-registros)
- [Estatísticas e exportação](#estatisticas-e-exportacao)
- [Referências alimentares](#referencias-alimentares)
- [Exames PKU](#exames-pku)
- [Perfil do usuário](#perfil-do-usuario)
- [Delegação de acesso para nutricionistas e cuidadores](#delegacao-de-acesso-para-nutricionistas-e-cuidadores)
- [Consentimento LGPD e privacidade](#consentimento-lgpd-e-privacidade)
- [Instalação como aplicativo (PWA)](#instalacao-como-aplicativo-pwa)
- [Perguntas Frequentes](#perguntas-frequentes)

## Primeiro acesso e entrada no aplicativo

1. Abra o endereço do MeuFenil no seu navegador (celular, tablet ou computador).
2. Na página inicial, toque em **"Entrar com Google"**.
3. Escolha a conta Google que deseja usar e autorize o acesso.
4. Pronto! Seu perfil é criado automaticamente na primeira entrada. Você já cai direto no **Dashboard**, que mostra o resumo do consumo de hoje.

Ao entrar pela primeira vez, o aplicativo vai pedir seu consentimento para uso dos dados (veja a seção [Consentimento LGPD](#consentimento-lgpd-e-privacidade)). Depois de aceitar, o uso é livre.

Se você já estiver logado e abrir o site novamente, a sessão é mantida — você não precisa entrar de novo.

## Registro diário de consumo

Registrar o que você comeu é o coração do aplicativo:

1. No **Dashboard**, toque em **"Adicionar Registro"**.
2. Escolha a **data** (por padrão, já vem como hoje).
3. Digite o nome do **alimento** no campo de busca — a lista vai filtrando enquanto você digita. Se preferir, você também pode:
   - Usar uma das suas **referências favoritas**, que aparecem em destaque na lista;
   - Criar um alimento novo na hora, pelo link **"Criar novo alimento"**.
4. Informe o **peso consumido em gramas** (ex.: 150).
5. O aplicativo calcula automaticamente a **fenilalanina** correspondente e mostra o valor na tela.
6. Toque em **"Salvar Registro"**.

O registro aparece na hora no resumo do dia e fica salvo no seu histórico.

> **Dica:** se você comer a mesma coisa sempre, pode marcar o alimento como favorito na página de Referências para encontrá-lo mais rápido.

## Acompanhamento do limite diário

O limite diário é o teto de fenilalanina que você definiu para consumir por dia:

- Ao criar seu perfil, o limite padrão é de **500 mg/dia**.
- Para alterá-lo, vá em **Perfil** e edite o campo **"Limite diário de fenilalanina (mg)"**. Salve com o botão **"Salvar alterações"**.
- No **Dashboard** você acompanha o consumo do dia em relação ao limite: o total consumido, o **percentual** com uma barra de progresso e o quanto ainda **resta** para o dia.
- Se você **ultrapassar** o limite, um aviso vermelho aparece na tela informando o excesso: *"Você ultrapassou seu limite diário de fenilalanina em X mg. Considere ajustar suas próximas refeições."*

## Dashboard (visão do dia)

O Dashboard é a primeira tela depois do login e reúne tudo do seu dia:

- **Cards de resumo:** Hoje (total consumido), Percentual (do limite) e Restante (o que ainda pode consumir).
- **Gráfico "Últimos 7 dias":** mostra a evolução do consumo da semana.
- **Ações rápidas:** botões **"Adicionar Registro"** e **"Criar Alimento"** abrem as telas para registrar consumo e cadastrar alimentos novos.

## Histórico de registros

Na página **Histórico** você vê todos os seus registros de consumo, agrupados por dia (do mais recente para o mais antigo):

- Cada dia mostra o **total consumido** e a lista de alimentos com peso e fenilalanina.
- Para filtrar por período, use os campos **Data Início** e **Data Fim** e toque em **"Aplicar filtros"**. Para voltar a ver tudo, toque em **"Limpar filtros"**.
- Para apagar um registro, toque no ícone de lixeira e confirme a exclusão.

## Estatísticas e exportação

Na página **Estatísticas** você analisa o consumo por período:

1. Escolha entre **"Última Semana"** (7 dias, incluindo hoje) ou **"Último Mês"** (30 dias).
2. Veja os cards de **Total**, **Média Diária** e **Maior Consumo** do período, além do gráfico **"Consumo por Dia"**.
3. Para guardar os dados, toque nos botões **CSV** ou **JSON** no topo da página — o arquivo é baixado para o seu aparelho (ex.: `meufenil-estatisticas-semana.csv`).

> Os arquivos podem ser abertos em planilhas (CSV) ou em editores de texto (JSON) — úteis para compartilhar com seu nutricionista.

## Referências alimentares

A página **Referências** é o catálogo de alimentos com o valor de fenilalanina por 100g:

- **Busca:** digite no campo "Buscar alimento" para filtrar a lista.
- **Filtros:** marque as opções "Mostrar referências inativas", "Somente favoritas" e "Somente customizadas" para ajustar a lista.
- **Ordenação:** toque nos cabeçalhos da tabela para ordenar por nome ou por valor de fenilalanina.
- **Favoritos:** toque na estrela para marcar/desmarcar um alimento como favorito — ele aparece primeiro na busca de alimentos.
- **Criar alimento:** toque em **"+ Nova Referência"**, informe o nome e a quantidade de fenilalanina por 100g.
- **Editar:** toque no lápis para alterar um alimento que você criou.
- **Remover/desativar:** toque na lixeira. Se o alimento já tiver registros de consumo associados, ele não é apagado — é **desativado** (fica riscado na lista, com o aviso "(Inativa)") e não pode mais ser usado em novos registros. Alimentos desativados podem ser **reativados** com o botão de seta circular.
- **Referências globais:** são os alimentos da base (dados da ANVISA) e de administradores — disponíveis para todos. Só administradores podem alterá-las.

## Exames PKU

A página **Exames PKU** acompanha seus exames laboratoriais:

1. Toque em **"+ Registrar Exame"**.
2. Informe a **data do exame** e o **resultado** (em mg/dL — a tela mostra a conversão *"Valor PHE ÷ 60,6 = PKU em mg/dL"* para ajudar).
3. Toque em **"Salvar"**.

A página mostra os cards de resumo (**Último Exame**, **Variação** em relação ao anterior e **Total de Exames**), o gráfico **"Histórico de Resultados"** e a lista completa, com opção de excluir um exame.

## Perfil do usuário

Na página **Perfil** você gerencia suas informações:

- **Informações pessoais:** nome (o e-mail não pode ser alterado) e limite diário de fenilalanina.
- **Acessos concedidos:** quem você autorizou a operar na sua conta (veja a próxima seção).
- **Acessos recebidos:** perfis que você pode assumir.
- **Privacidade e Dados:**
  - **"Exportar meus dados"** baixa um arquivo JSON com seus dados (perfil e registros de consumo);
  - **"Excluir minha conta"** remove seus dados do aplicativo. A exclusão pede confirmação dupla: você precisa digitar `EXCLUIR` para confirmar. Atenção: essa ação é definitiva.

## Delegação de acesso para nutricionistas e cuidadores

Você pode autorizar outra pessoa (como um nutricionista ou cuidador) a operar na sua conta, em seu nome:

**Para conceder acesso:**
1. Vá em **Perfil** → **Acessos concedidos** → **"Conceder acesso"**.
2. Informe o **e-mail** da pessoa (ela precisa já ter conta no MeuFenil).
3. Pronto — a pessoa passa a poder registrar e consultar dados em seu nome.

**Para assumir um perfil (quando você é quem recebeu o acesso):**
1. Vá em **Perfil** → **Acessos recebidos** → **"assumir"**.
2. Aparece um aviso âmbar no topo: *"Você está acessando o perfil de {nome}"*, com o botão **"Voltar para minha conta"**.
3. Enquanto estiver acessando o perfil de outra pessoa, tudo é registrado no perfil dela; a página Perfil fica somente para consulta (não é possível alterar dados nem excluir a conta).
4. Para voltar, toque em **"Voltar para minha conta"** — ou saia do aplicativo, que o acesso volta automaticamente.

**Para revogar:** vá em **Perfil** → **Acessos concedidos** e revogue o acesso. O efeito é imediato: a pessoa perde a capacidade de operar na sua conta.

> **Importante:** o acesso delegado é uma autorização para **operar em seu nome** — a pessoa não troca de identidade e não vê sua senha ou dados de login.

## Consentimento LGPD e privacidade

Na primeira entrada, o MeuFenil exibe a tela **"Consentimento LGPD"** com:

- **Dados coletados:** nome e e-mail (via sua conta Google), registros de consumo, referências de alimentos e configurações de perfil.
- **Finalidade:** funcionalidades de controle, estatísticas e relatórios, e melhoria da experiência.
- **Seus direitos:** acessar seus dados a qualquer momento, exportá-los, solicitar exclusão completa e revogar o consentimento.

Para começar a usar, toque em **"Aceitar e Continuar"**. A data do seu consentimento fica registrada. Enquanto não aceitar, a tela reaparece a cada visita.

Seus dados nunca são compartilhados com terceiros sem o seu consentimento explícito. Você pode exercer seus direitos na página **Perfil** (exportar dados ou excluir a conta).

## Instalação como aplicativo (PWA)

O MeuFenil pode ser **instalado** no seu celular ou computador, como um aplicativo:

- **No celular (Android):** no navegador, use o menu (⋮) → **"Adicionar à tela inicial"** ou **"Instalar aplicativo"**.
- **No iPhone (iOS):** no Safari, toque no botão de compartilhar → **"Adicionar à Tela de Início"**.
- **No computador:** o navegador oferece um botão de instalação na barra de endereço.

Depois de instalado, o aplicativo abre em tela cheia, com ícone próprio, como um app nativo.

> **Sobre o uso offline:** a instalação facilita o acesso rápido, mas o MeuFenil atualmente **precisa de conexão com a internet** para funcionar (o modo offline ainda não está disponível).

## Perguntas Frequentes

**Preciso pagar para usar?**
Não. O MeuFenil é gratuito, open source e sem fins lucrativos.

**Posso usar no celular e no computador ao mesmo tempo?**
Sim. É só entrar com a mesma conta Google em cada aparelho — seus dados ficam sincronizados na conta.

**Como o aplicativo calcula a fenilalanina de um registro?**
Ele usa o valor de fenilalanina do alimento (por 100g) e o peso que você informou: `fenilalanina = (valor por 100g × peso em gramas) ÷ 100`.

**Esqueci de registrar uma refeição. Consigo incluir depois?**
Sim. No registro, escolha a **data** correta do consumo (não precisa ser hoje).

**Posso editar um registro já salvo?**
Não. Registros de consumo não podem ser editados — mas você pode **excluir** o registro errado (no Histórico) e criar um novo.

**O que acontece se eu ultrapassar meu limite diário?**
Nada é bloqueado. O aplicativo mostra um **alerta** no Dashboard com o excesso, para você considerar ajustar as próximas refeições.

**Outra pessoa consegue ver meus dados?**
Não, a menos que você **conceda acesso** a ela explicitamente (delegação). Cada usuário só vê os próprios dados; os alimentos da base (referências globais) são públicos para todos os usuários.

**Como eu apago minha conta e todos os meus dados?**
Em **Perfil → Privacidade e Dados → "Excluir minha conta"**, digitando `EXCLUIR` para confirmar. A exclusão é definitiva.

**O aplicativo substitui o acompanhamento médico ou nutricional?**
Não. O MeuFenil é apenas uma ferramenta de apoio ao controle diário. Siga sempre as orientações da sua equipe de saúde.

**Algo não funciona ou você tem uma sugestão?**
Você pode abrir uma issue no repositório do projeto (GitHub) — as contribuições são muito bem-vindas.
