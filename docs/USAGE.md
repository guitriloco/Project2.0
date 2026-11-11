# Guia de uso

## Instalação

```bash
git clone https://github.com/guitriloco/project-2.0.git
cd project-2.0
npm install
```

Configure `DATABASE_URL` para o PostgreSQL/Neon usado pelo backend. Para desenvolvimento local, o frontend usa automaticamente `http://localhost:3001`; defina `XEREBRO_BACKEND_URL` apenas quando precisar apontar para outro backend.

## Execução

```bash
# Frontend e backend juntos
npm run dev

# Validação e produção
npm run typecheck
npm run build
npm run start
```

Acesse `http://localhost:3000/dashboard`.

## Endpoints comprovados

O backend Fastify roda por padrão em `http://localhost:3001`.

### Resumo operacional

```bash
curl http://localhost:3001/api/operations/summary
```

Retorna métricas e registros recentes de tarefas, decisões e propostas.

### Tarefas

```bash
curl -X POST http://localhost:3001/api/tasks \
  -H 'Content-Type: application/json' \
  -d '{"title":"Revisar fluxo operacional"}'

curl -X PATCH http://localhost:3001/api/tasks/TASK_ID/complete
```

A interface principal usa os proxies Next.js equivalentes:

- `GET /api/operations/summary`
- `POST /api/operations/tasks`
- `PATCH /api/operations/tasks/:id/complete`
- `GET /api/operations/decisions`
- `POST /api/operations/decisions`

### Decisões

```bash
curl -X POST http://localhost:3001/api/decisions \
  -H 'Content-Type: application/json' \
  -d '{"action":"Aprovar fluxo","rationale":"Fluxo validado","confidence":0.8,"status":"LOGGED"}'
```

### Chat do Xerebro

A interface usa o proxy Next.js `POST /api/xerebro/chat`, que encaminha para o backend configurado. O contrato deve ser consultado na rota antes de integrações externas; respostas de módulos conceituais não são consideradas capacidades de produção sem testes e configuração correspondente.

## Estado dos módulos

### Funcional

Dashboard, operações, tarefas, decisões, Prisma, PostgreSQL/Neon e proxies Next.js são o núcleo validado atualmente.

### Experimental

Rotas e componentes relacionados a neural, consciousness, symbiosis, dimensional, XR, simulation e evolução permanecem disponíveis como laboratório. Podem compilar ou expor endpoints, mas não devem ser considerados fluxos de negócio prontos.

### Histórico/legado

As fases conceituais e documentos de visão preservam a trajetória do produto. Referências antigas a endpoints como `/api/xerebro/query`, `/api/xerebro/voice-mode`, Docker/Kubernetes e infraestrutura autônoma são históricas ou não verificadas na configuração atual.

## Limitações atuais

- Não há ainda escopo consistente por usuário ou workspace.
- O histórico exibido no painel é derivado dos registros recentes, não uma auditoria imutável.
- Produção exige uma estratégia explícita para publicar o Fastify ou migrar suas rotas para o Next.js.
- Os endpoints experimentais podem mudar sem compatibilidade garantida.

## Troubleshooting

**Preview sem script de desenvolvimento:** execute a partir da raiz do repositório; o `package.json` raiz contém o script `dev`.

**Backend indisponível:** confirme que `npm run dev` foi executado na raiz e que a porta 3001 está livre.

**Banco indisponível:** confirme `DATABASE_URL`, conectividade do PostgreSQL/Neon e o estado do schema Prisma.

## Contribuição

Preserve módulos históricos, descreva claramente o que é experimental e adicione testes ao promover uma capacidade para o núcleo funcional. Use branches de trabalho e Pull Requests para mudanças estruturais.
