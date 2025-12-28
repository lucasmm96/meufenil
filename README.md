# MeuFenil

## 📌 Sobre o projeto

**MeuFenil** é uma aplicação open source criada para **controle pessoal da ingestão diária de fenilalanina**, com foco em **apoio a pacientes com Fenilcetonúria (PKU)**. O projeto tem como objetivo facilitar a administração da dieta extremamente restritiva exigida pela condição, oferecendo organização, clareza e autonomia ao paciente e seus cuidadores.

> ⚠️ **Aviso importante**: este aplicativo **não substitui, em nenhuma hipótese, o acompanhamento médico ou nutricional**. Ele deve ser utilizado apenas como ferramenta de apoio.

## 💙 Motivação

Olá! Meu nome é [Lucas](www.linkedin.com/in/lucas-martins-menezes/)
 e sou marido de uma paciente com fenilcetonúria.

Antes de conhecê-la, essa condição era completamente desconhecida para mim. A convivência me mostrou o quanto ainda faltam recursos no Brasil para pacientes com PKU — como fórmulas mais palatáveis, acesso ao Dicloridrato de Sapropterina ([Kuvan®](https://www.biomarin.com/pt-br/kuvan-pku/)), produtos de baixa proteína e, principalmente, informações nutricionais claras sobre a quantidade de fenilalanina nos alimentos.

Manter uma dieta tão restritiva, com pouca informação disponível, é um grande desafio. Por isso, decidi unir meu conhecimento em tecnologia à vontade de melhorar a rotina da minha esposa e de outras pessoas na mesma condição.

Este aplicativo foi criado para ajudar no controle diário da ingestão de alimentos e da fenilalanina. Os dados iniciais têm como base tabelas públicas disponibilizadas pela [ANVISA](https://app.powerbi.com/view?r=eyJrIjoiODNlZDRiZWUtOTM3Ni00ZTBmLTgxYWUtNWUzM2ZkNTk5NTUyIiwidCI6ImI2N2FmMjNmLWMzZjMtNGQzNS04MGM3LWI3MDg1ZjVlZGQ4MSJ9), e o usuário também pode cadastrar seus próprios alimentos caso não os encontre na lista.

**Este é um projeto totalmente sem fins lucrativos, criado com o único objetivo de contribuir — mesmo que um pouco — para uma melhor qualidade de vida das pessoas com fenilcetonúria.**

## 🚀 Funcionalidades

Atualmente, o MeuFenil oferece:

* Autenticação de usuários (OAuth com Google)
* Cadastro e login
* Registro diário de consumo alimentar
* Cálculo automático de fenilalanina ingerida
* Definição de limite diário personalizado
* Relatórios por período
* Gráficos de acompanhamento
* Registro e acompanhamento de exames de PKU
* Exportação de dados
* Suporte a múltiplos dispositivos (PWA / mobile)

### Funcionalidades planejadas

* Melhorias no gerenciamento de alimentos personalizados
* Interface para alimentos favoritos e/ou mais consumidos
* Compartilhamento de acesso com terceiros (ex: familiares ou cuidadores)

## 🧱 Stack técnica

### Frontend

* React
* TypeScript
* React Router
* Tailwind CSS

### Build

* Vite

### Backend / BaaS

* Supabase

  * Autenticação (OAuth Google)
  * Banco de dados PostgreSQL
  * Edge Functions

### Hospedagem

* Vercel

## 🔐 Autenticação e permissões

* Autenticação via **Google OAuth** (Supabase Auth)
* Cada usuário tem acesso:

  * Aos **seus próprios dados**
  * A dados **globais**, gerenciados por administradores (ex: referências alimentares)

## 🗄️ Estrutura de dados (visão geral)

A aplicação utiliza um banco PostgreSQL gerenciado pelo Supabase. De forma resumida, a estrutura contempla:

* **Usuários**: dados básicos, limite diário de fenilalanina, fuso horário e permissões
* **Referências alimentares**: alimentos com valor de fenilalanina por 100g (globais ou criados pelo usuário)
* **Registros alimentares**: consumo diário associado a um alimento de referência
* **Exames de PKU**: histórico de resultados laboratoriais do usuário

> ⚠️ Detalhes internos de segurança, políticas e regras de acesso são propositalmente omitidos neste documento.

## ⚙️ Setup local

### Requisitos

* Node.js **18+**

### Variáveis de ambiente

Crie um arquivo `.env` na raiz do projeto com:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
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