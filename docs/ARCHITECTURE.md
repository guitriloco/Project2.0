# Arquitetura técnica

## Estado atual

O Project 2.0 é um monorepo com um frontend Next.js e um backend Fastify separado. O núcleo funcional comprovado é o Centro Operacional: tarefas, decisões, resumo operacional, histórico derivado e chat do Xerebro.

## Stack real

- **Frontend:** Next.js 16, React 19, TypeScript, Tailwind CSS e componentes shadcn/ui.
- **Backend:** Node.js, TypeScript e Fastify 5.
- **Dados:** Prisma 5 com PostgreSQL, usando a integração Neon no ambiente do projeto.
- **Execução local/Preview:** `scripts/dev.mjs` inicia frontend na porta 3000 e backend na porta 3001.

## Fluxo de requisição

```text
Navegador
  -> Next.js /api/operations/*
  -> Fastify /api/operations/*
  -> Prisma
  -> PostgreSQL/Neon
```

O frontend usa rotas proxy do Next.js para evitar expor diretamente a URL do backend ao navegador. `XEREBRO_BACKEND_URL` pode sobrescrever o destino; na execução local o fallback é `http://localhost:3001`.

## Componentes funcionais

- `frontend/src/app/dashboard/page.tsx`: página do Centro Operacional.
- `frontend/src/components/operational-center.tsx`: estado, mutações e composição do painel.
- `frontend/src/components/operational-center-sections.tsx`: métricas e histórico visual.
- `backend/src/routes/operations/index.ts`: resumo agregado.
- `backend/src/routes/tasks/index.ts`: criação e conclusão de tarefas.
- `backend/src/routes/decisions/index.ts`: registro e consulta de decisões.
- `backend/prisma/schema.prisma`: modelos persistidos.

## Preview e produção

O launcher raiz resolve a execução conjunta no Preview/local, mas não transforma automaticamente o Fastify em serviço de produção. Um deploy produtivo deve publicar o backend separadamente, migrar suas rotas para handlers do Next.js, ou usar uma estratégia de serviço compatível com o ambiente escolhido.

## Classificação do repositório

- **Funcional:** dashboard, tarefas, decisões, resumo operacional, proxies Next.js, Prisma e rotas validadas.
- **Experimental:** componentes e rotas de neural, consciousness, symbiosis, dimensional, XR e módulos de simulação.
- **Histórico/legado:** fases conceituais e documentos que descrevem intenções de produto, não capacidades comprovadas automaticamente.

A classificação não remove arquivos. Ela evita que uma ideia histórica seja apresentada como funcionalidade entregue.

## Limites atuais

- Ainda não há autorização multiusuário consistente por `userId` ou `workspaceId`.
- O histórico de atividade é derivado dos registros recentes; não é uma trilha de auditoria imutável.
- Há módulos legados que ainda precisam ser consolidados e alguns contratos antigos que devem ser revisados antes de produção.
