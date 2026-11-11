# Project 2.0

> Plataforma experimental de inteligência operacional, governança e evolução de sistemas.

## Visão atual

O Project 2.0 combina um Centro Operacional com módulos conceituais de Xerebro AI, governança, conhecimento e experimentação neural. O núcleo comprovado hoje é o fluxo de tarefas e decisões persistidas em PostgreSQL, apresentado por um dashboard Next.js.

A linguagem de “mais de 200 fases” e os nomes de soberania, unificação e sobrevivência são parte da história e da visão do produto. Eles não significam que todas essas capacidades estejam implementadas ou validadas em produção.

## Stack real

- Next.js 16, React 19 e TypeScript
- Tailwind CSS e shadcn/ui
- Fastify 5 e Node.js
- Prisma 5
- PostgreSQL via Neon
- npm com scripts na raiz

## Começando

Pré-requisitos: Node.js 18+, npm e uma variável `DATABASE_URL` válida para o backend.

```bash
git clone https://github.com/guitriloco/project-2.0.git
cd project-2.0
npm install
npm run dev
```

O comando raiz inicia os dois serviços:

- Frontend: http://localhost:3000
- Backend: http://localhost:3001
- Dashboard: http://localhost:3000/dashboard

`XEREBRO_BACKEND_URL` pode ser configurada para apontar para um backend remoto. Sem ela, o frontend usa `http://localhost:3001` em desenvolvimento.

## Núcleo funcional

- Centro Operacional com métricas reais.
- Criação e conclusão de tarefas.
- Registro e consulta de decisões.
- Filtros de tarefas e decisões.
- Histórico de atividade e detalhes de auditoria derivados dos registros recentes.
- Proxy Next.js para operações e chat do Xerebro.

## Estrutura

```text
project-2.0/
├── frontend/              # Next.js, React e UI
├── backend/               # Fastify, Prisma e rotas de domínio
├── scripts/dev.mjs        # Launcher frontend + backend
├── docs/ARCHITECTURE.md   # Arquitetura técnica atual
├── docs/ROADMAP.md        # Prioridades de evolução
├── docs/USAGE.md          # Comandos e endpoints comprovados
└── docs/                  # Visão conceitual e histórico do produto
```

## Classificação dos módulos

- **Funcional:** dashboard, operações, tarefas, decisões, Prisma e proxies Next.js.
- **Experimental:** neural, consciousness, symbiosis, dimensional, XR, simulações e módulos de evolução.
- **Histórico:** fases conceituais e documentos que registram a visão do produto.

Os módulos históricos e experimentais são preservados para referência e futuras variações. Eles não devem ser anunciados como funcionalidades entregues sem integração, testes e persistência comprovados.

## Documentação

- [Arquitetura](docs/ARCHITECTURE.md)
- [Roadmap](docs/ROADMAP.md)
- [Guia de uso](docs/USAGE.md)
- [Contribuição](CONTRIBUTING.md)
- [Licença](LICENSE)

## Desenvolvimento

```bash
npm run dev
npm run build
npm run typecheck
npm run start
```

Para alterações maiores, preserve o branch original, crie uma branch de trabalho e valide frontend, backend, banco e Preview antes de abrir um Pull Request.

## Estado atual e alterações realizadas

Este repositório é o backup do estado atual trabalhado nesta sessão. O histórico completo dos commits foi preservado no branch `product-enhancement`.

### Funcionalidades implementadas

- Dashboard operacional em Next.js com navegação para Executivo, Governança, Workspaces e Produtividade.
- Painel executivo com resumo de tarefas, decisões, propostas e auditoria.
- Centro Operacional com leitura de métricas e estados de carregamento/fallback.
- Gerenciamento de workspaces com listagem, criação, edição e exclusão na interface.
- Fluxos de tarefas: criação, atualização de status e consulta.
- Registro de decisões, filtros e visualização de atividade recente.
- Histórico/auditoria derivados dos registros operacionais.
- Chat do Xerebro com proxy Next.js para o backend.
- Formulário de autenticação e mecanismo de código de acesso para demonstração.
- Identidade técnica de Preview para permitir testar o ambiente sem login, mantendo o fluxo de autenticação real separado para produção.
- Integração do frontend com `XEREBRO_BACKEND_URL` e rotas proxy `/api/operations/*`.
- Configuração de deploy do backend na Vercel, incluindo entrypoint serverless e regras de rewrite.
- Dependências do backend ajustadas para execução com Express/Fastify, TypeScript e Prisma.
- Build e typecheck do frontend validados durante o trabalho.

### Deploy e acesso

Os endereços de Preview são temporários e podem deixar de existir. Para acessar a aplicação, use o domínio exibido no deployment ativo do projeto `frontend` na Vercel e acrescente:

- `/dashboard` — dashboard principal
- `/executive` — painel executivo

A proteção de Deployment Protection/SSO da Vercel precisa estar desativada quando o Preview for usado como demonstração pública. O frontend pode abrir mesmo quando a API estiver indisponível; nesse caso, os componentes exibem estado vazio de Preview em vez de inventar dados persistidos.

### Banco, persistência e limitações conhecidas

O sistema foi estruturado para persistir dados em PostgreSQL usando Prisma e Neon. Para salvar tarefas, decisões e workspaces de forma permanente, o backend publicado precisa estar com `DATABASE_URL` e `BETTER_AUTH_SECRET` configurados no ambiente correto da Vercel e com as migrações Prisma aplicadas.

O modo Preview sem sessão é destinado a demonstração e diagnóstico. Ele não substitui autenticação real nem deve ser usado como controle de acesso em produção. Se a API ou o banco estiverem indisponíveis, o frontend pode mostrar dados vazios ou um workspace local de Preview; isso não significa que o registro foi salvo no banco.

### Histórico técnico desta sessão

Os principais commits realizados incluem:

- `feat: add demo authentication endpoint and demo login functionality`
- `feat: add demo access code validation and update API request handling`
- `feat: add preview operator identity for non-production environments`
- `feat: add API handler and Vercel rewrite rule`
- `feat: refactor backend API and modularize route registration`
- `feat: enhance executive panel fetcher with fallback summary`

## Licença

Este projeto está sob a licença MIT. Veja [LICENSE](LICENSE).

**Project 2.0 — A Ressonância**
