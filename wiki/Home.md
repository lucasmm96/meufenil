# MeuFenil - Controle da Fenilalanina

O **MeuFenil** é uma aplicação open source de controle pessoal da ingestão diária de fenilalanina, criada para apoiar pessoas com Fenilcetonúria (PKU) e seus cuidadores no dia a dia. Com ele, você registra o que come, acompanha o consumo do dia em relação ao seu limite, consulta o histórico e as estatísticas, acompanha exames de PKU e compartilha o acesso com nutricionistas ou cuidadores.

> **Importante:** o MeuFenil é uma ferramenta de apoio e **não substitui, em nenhuma hipótese, o acompanhamento médico ou nutricional**.

## Documentação

- [Guia do Usuário](Guia-Usuario) — como usar o aplicativo no dia a dia, passo a passo.
- [Guia do Desenvolvedor](Guia-Desenvolvedor) — configuração do ambiente, padrões e fluxo de desenvolvimento.
- [Arquitetura](Arquitetura) — visão geral das camadas e dos fluxos de dados do sistema.
- [Funcionalidades](Funcionalidades) — lista de todas as funcionalidades implementadas e planos futuros.
- [Referências Técnicas](Referencias-Tecnicas) — detalhes de banco de dados, edge functions, jobs e ferramentas.

## Sobre o projeto

- **Open source** sob licença **MIT**, 100% gratuito e sem fins lucrativos.
- Criado para facilitar a administração da dieta extremamente restritiva exigida pela PKU, oferecendo organização, clareza e autonomia ao paciente e aos seus cuidadores.
- Os dados iniciais de alimentos têm como base tabelas públicas da **ANVISA** (2.958 referências no cadastro inicial); o usuário também pode cadastrar seus próprios alimentos.
- A aplicação é uma **SPA web** (React + Vite) com suporte multi-dispositivo via **PWA instalável**, hospedada na Vercel, com autenticação via conta Google e banco de dados PostgreSQL gerenciado pelo Supabase.
- Para saber mais sobre a motivação e a história do projeto, acesse a página "Sobre" dentro do aplicativo ou o [README do repositório](https://github.com/lucasmm96/meufenil).
