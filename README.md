# MeuFenil

## 📌 Sobre o projeto

**MeuFenil** é uma aplicação open source criada para **controle pessoal da ingestão diária de fenilalanina**, com foco em **apoio a pacientes com Fenilcetonúria (PKU)**.

O projeto tem como objetivo facilitar a administração da dieta extremamente restritiva exigida pela condição, oferecendo **organização, clareza e autonomia** ao paciente e a seus cuidadores.

> ⚠️ **Aviso importante**: este aplicativo **não substitui, em nenhuma hipótese, o acompanhamento médico ou nutricional**. Ele deve ser utilizado exclusivamente como ferramenta de apoio.

---

## 💙 Motivação

Olá! Meu nome é [Lucas](https://www.linkedin.com/in/lucas-martins-menezes/) e sou marido de uma paciente com fenilcetonúria.

Antes de conhecê-la, essa condição era completamente desconhecida para mim. A convivência me mostrou o quanto ainda faltam recursos no Brasil para pacientes com PKU — como fórmulas mais palatáveis, acesso ao Dicloridrato de Sapropterina ([Kuvan®](https://www.biomarin.com/pt-br/kuvan-pku/)), produtos de baixa proteína e, principalmente, **informações nutricionais claras sobre a quantidade de fenilalanina nos alimentos**.

Manter uma dieta tão restritiva, com pouca informação disponível, é um grande desafio. Por isso, decidi unir meu conhecimento em tecnologia à vontade de melhorar a rotina da minha esposa e de outras pessoas na mesma condição.

Este aplicativo foi criado para ajudar no controle diário da ingestão de alimentos e da fenilalanina. Os dados iniciais têm como base tabelas públicas disponibilizadas pela [ANVISA](https://app.powerbi.com/view?r=eyJrIjoiODNlZDRiZWUtOTM3Ni00ZTBmLTgxYWUtNWUzM2ZkNTk5NTUyIiwidCI6ImI2N2FmMjNmLWMzZjMtNGQzNS04MGM3LWI3MDg1ZjVlZGQ4MSJ9), e o usuário também pode cadastrar seus próprios alimentos caso não os encontre na lista.

**Este é um projeto totalmente sem fins lucrativos**, criado com o único objetivo de contribuir — mesmo que um pouco — para uma melhor qualidade de vida das pessoas com fenilcetonúria.

## 🚀 Funcionalidades

Atualmente, o MeuFenil oferece:

- Autenticação de usuários (OAuth com Google)
- Cadastro e login
- Registro diário de consumo alimentar
- Cálculo automático de fenilalanina ingerida
- Definição de limite diário personalizado
- Relatórios por período
- Gráficos de acompanhamento
- Registro e acompanhamento de exames de PKU
- Exportação de dados
- Suporte a múltiplos dispositivos (PWA / mobile)

### Funcionalidades planejadas

- Melhorias no gerenciamento de alimentos personalizados
- Interface para alimentos favoritos e/ou mais consumidos

## 🧱 Stack técnica

### Frontend
- React
- TypeScript
- React Router
- Tailwind CSS

### Build
- Vite

### Backend / BaaS
- Supabase
  - Autenticação (OAuth Google)
  - Banco de dados PostgreSQL
  - Edge Functions

### Hospedagem
- Vercel

## 🔐 Autenticação e permissões

- Autenticação via **Google OAuth** (Supabase Auth)
- Cada usuário tem acesso:
  - Aos **seus próprios dados**
  - A dados **globais**, gerenciados por administradores (ex: referências alimentares)

As regras de acesso são aplicadas diretamente no banco de dados via **Row Level Security (RLS)**.

## 🗄️ Estrutura de dados (visão geral)

A aplicação utiliza um banco PostgreSQL gerenciado pelo Supabase. De forma resumida, a estrutura contempla:

- **Usuários**: dados básicos, limite diário de fenilalanina, fuso horário e permissões
- **Referências alimentares**: alimentos com valor de fenilalanina por 100g (globais ou criados pelo usuário)
- **Registros alimentares**: consumo diário associado a um alimento de referência
- **Exames de PKU**: histórico de resultados laboratoriais do usuário

> ⚠️ Detalhes internos de segurança, políticas, triggers e regras de acesso são documentados separadamente e não fazem parte deste README.

## ⚙️ Setup local

### Requisitos
- Node.js **18+**

### Variáveis de ambiente

Crie os arquivos `.env.development` e `.env.production` na raiz do projeto com as seguintes variáveis:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_PROJECT_ID=your_project_id
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_DATABASE_URL=your_database_url
```

### Migrations

Migrations do banco de dados são gerenciadas via Supabase CLI e versionadas em `supabase/migrations/`.

Para aplicar migrations pendentes:

```bash
# Desenvolvimento
./scripts/apply-supabase-migrations.sh --env development

# Produção (exige confirmação adicional)
./scripts/apply-supabase-migrations.sh --env production
```

### Instalação e execução

```bash
npm install
npm run dev
```

### Build de produção

```bash
npm run build
```

## 💸 Custos e sustentabilidade

Atualmente, o MeuFenil é **100% gratuito**, sem qualquer fim lucrativo.

A aplicação utiliza os **planos gratuitos do Supabase e da Vercel**, e o consumo de recursos é monitorado manualmente.

Caso o volume de usuários cresça a ponto de exigir planos pagos para manter a aplicação funcionando, a política de gratuidade **poderá ser reavaliada**, sempre com o único objetivo de **cobrir custos de infraestrutura**, nunca visando lucro.

## Keepalive diário

Para evitar que o projeto gratuito do Supabase entre em estado de pausa por inatividade, a aplicação expõe uma rota interna em `/api/keepalive`.

Essa rota é executada automaticamente pelo Vercel Cron uma vez por dia e faz uma leitura mínima na tabela `public.usuarios` do banco correspondente ao ambiente atual:

- em desenvolvimento, lê o banco de dev
- em produção, lê o banco de produção

Cada execução também persiste um histórico próprio na tabela `public.background_job_executions` do mesmo banco acessado.

A rota usa automaticamente as credenciais do ambiente atual:

```env
VITE_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Se você já mantiver variáveis explícitas de keepalive no painel da Vercel, elas continuam funcionando como override, mas não são obrigatórias para o fluxo padrão.

Horário do cron:

- `0 12 * * *` UTC, equivalente a 09:00 em `America/Sao_Paulo` durante o horário normal.

## Infraestrutura de jobs

A persistência das execuções de jobs fica centralizada na tabela `public.background_job_executions` de cada ambiente.

Campos principais:

- `job_key`: identifica o job, como `keepalive`
- `environment`: indica o ambiente do registro, como `prod` ou `dev`
- `run_id`: agrupa os eventos da mesma execução
- `started_at` e `finished_at`: início e fim da execução
- `duration_ms`: duração total
- `status`: `success`, `failure` ou `partial`
- `message`: resumo legível da execução
- `details`: JSON com metadados adicionais

Reutilização:

- novas rotinas em background podem chamar o helper compartilhado em `src/shared/background-jobs.ts`
- basta informar `jobKey`, `environment`, `status`, tempos, mensagem e `details`

Retenção:

- a tabela mantém apenas registros dos últimos 365 dias
- a limpeza é automática via trigger no banco
- isso evita crescimento infinito sem depender de um job de manutenção separado

Monitoramento no painel administrativo:

- o painel de admin mostra um resumo das execuções em background do ambiente atual
- a tela inclui filtros por job, status e período
- o histórico fica paginado e protegido por RLS, visível apenas para administradores

Para testar manualmente:

```bash
# carregue os dois arquivos e crie aliases temporários para o keepalive
set -a
source .env.development
export KEEPALIVE_DEV_SUPABASE_URL="$VITE_SUPABASE_URL"
export KEEPALIVE_DEV_SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY"
set +a

set -a
source .env.production
export KEEPALIVE_SUPABASE_URL="$VITE_SUPABASE_URL"
export KEEPALIVE_SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY"
set +a

vercel dev
curl http://localhost:3000/api/keepalive
```

Na Vercel, a resposta `200` indica que os dois bancos foram acessados com sucesso. Se algum projeto falhar, a rota retorna `500` e o payload mostra qual banco apresentou erro.

Se você quiser testar apenas um ambiente isolado, também funciona deixando disponíveis apenas `VITE_SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` do ambiente correspondente, porque a rota agora aceita esses nomes como fallback.

Para consultar o histórico:

```sql
select *
from public.background_job_executions
where job_key = 'keepalive'
order by created_at desc;
```

Se quiser ver só um ambiente:

```sql
select *
from public.background_job_executions
where job_key = 'keepalive'
  and environment = 'prod'
order by created_at desc;
```

```sql
select *
from public.background_job_executions
where job_key = 'keepalive'
  and environment = 'dev'
order by created_at desc;
```

## 🤝 Contribuição

Contribuições são muito bem-vindas!

Se você é desenvolvedor(a), nutricionista, profissional da saúde ou paciente e deseja ajudar, fique à vontade para:

* Abrir issues
* Propor melhorias
* Enviar pull requests

## 📄 Licença

Este projeto está licenciado sob a licença **MIT**.


## 💙 Agradecimentos

Um agradecimento especial à minha esposa, portadora de fenilcetonúria, cuja força, disciplina e resiliência — especialmente durante a gravidez, quando a dieta precisou ser ainda mais restritiva — foram a principal inspiração para a criação deste projeto.

Este aplicativo existe por ela e por todas as pessoas que convivem diariamente com a PKU.

## 📬 Contato

LinkedIn:
https://www.linkedin.com/in/lucas-martins-menezes
