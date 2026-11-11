import Fastify from 'fastify';
import { xerebroOrchestrator } from './modules/xerebro/orchestrator.js';
import operationsRoutes from './routes/operations/index.js';
import tasksRoutes from './routes/tasks/index.js';
import workspacesRoutes from './routes/workspaces/index.js';
import decisionsRoutes from './routes/decisions/index.js';
import auditRoutes from './routes/audit/index.js';
import documentsRoutes from './routes/documents/index.js';
import governanceRoutes from './routes/governance/index.js';
import xerebroRoutes from './routes/xerebro/index.js';
import webhooksRoutes from './routes/webhooks/index.js';
import sandboxRoutes from './routes/sandbox/index.js';
import policiesRoutes from './routes/policies/index.js';
import prisma from './lib/prisma.js';
import { z } from 'zod';
import { auth, getSession } from './lib/auth.js';
import { createProblemDetails } from './lib/schemas/contracts.js';
import { ZodError } from 'zod';

const fastify = Fastify({
  logger: true
});

fastify.setErrorHandler((error, request, reply) => {
  fastify.log.error(error);

  if (error instanceof ZodError) {
    const problem = createProblemDetails({
      status: 400,
      title: 'Validation Error',
      detail: error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
      instance: request.url,
      code: 'ERR_VALIDATION_FAILED',
      invalidParams: error.issues.map((i) => ({ name: i.path.join('.'), reason: i.message })),
    });
    return reply.code(400).header('content-type', 'application/problem+json').send(problem);
  }

  const err = error as any;
  const statusCode = err?.statusCode || err?.status || 500;
  const isServer = statusCode >= 500;
  const problem = createProblemDetails({
    status: statusCode,
    title: isServer ? 'Internal Server Error' : (err?.name || 'Request Error'),
    detail: isServer ? 'Ocorreu um erro interno ao processar a solicitação.' : (err?.message || 'Erro inesperado.'),
    instance: request.url,
    code: err?.code || (isServer ? 'ERR_INTERNAL_SERVER' : 'ERR_BAD_REQUEST'),
  });
  return reply.code(statusCode).header('content-type', 'application/problem+json').send(problem);
});

// Register API routes
fastify.addHook('onRequest', async (request, reply) => {
  if (request.url.startsWith('/health') || request.url.startsWith('/api/auth/')) return;
  if (!request.url.startsWith('/api/')) return;
  const session = await getSession(request);
  if (session?.user) {
    (request as typeof request & { userId: string }).userId = session.user.id;
    return;
  }

  // Preview-only operator identity: keeps the public test deployment usable
  // without weakening authentication in production or storing credentials client-side.
  if (process.env.VERCEL_ENV !== 'production' && process.env.NODE_ENV !== 'production') {
    const email = 'preview.operator@xerebro.local';
    const user = await prisma.user.upsert({
      where: { email },
      update: { name: 'Preview Operator' },
      create: { email, name: 'Preview Operator', emailVerified: true },
    });
    const workspace = await prisma.workspace.findFirst({ where: { name: 'Preview Workspace' } })
      ?? await prisma.workspace.create({ data: { name: 'Preview Workspace' } });
    await prisma.workspaceMember.upsert({
      where: { workspaceId_userId: { workspaceId: workspace.id, userId: user.id } },
      update: { role: 'OWNER' },
      create: { workspaceId: workspace.id, userId: user.id, role: 'OWNER' },
    });
    (request as typeof request & { userId: string }).userId = user.id;
    return;
  }

  return reply.code(401).send({ error: 'Autenticação necessária.' });
});

const chatRequestSchema = z.object({
  conversationId: z.string().uuid().nullable().optional(),
  messages: z.array(z.object({ role: z.enum(['user', 'assistant', 'system']), content: z.string().min(1).max(20000) })).min(1).max(100),
});

fastify.all('/api/auth/*', async (request, reply) => {
  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) if (typeof value === 'string') headers.set(key, value);
  const url = `${process.env.BETTER_AUTH_URL ?? `http://localhost:${process.env.PORT ?? 3001}`}${request.raw.url ?? ''}`;
  const body = request.method === 'GET' || request.method === 'HEAD' ? undefined : JSON.stringify(request.body ?? {});
  const response = await auth.handler(new Request(url, { method: request.method, headers, body }));
  reply.code(response.status);
  response.headers.forEach((value, key) => reply.header(key, value));
  return reply.send(await response.text());
});

fastify.get('/health', async () => {
  return { status: 'OK' };
});

// Helper to register modular routes
const registerRoutes = async () => {
  const routes = [
    ['operations', operationsRoutes],
    ['tasks', tasksRoutes],
    ['workspaces', workspacesRoutes],
    ['decisions', decisionsRoutes],
    ['audit', auditRoutes],
    ['documents', documentsRoutes],
    ['governance', governanceRoutes],
    ['xerebro', xerebroRoutes],
    ['webhooks', webhooksRoutes],
    ['sandbox', sandboxRoutes],
    ['policies', policiesRoutes],
  ] as const;
  for (const [name, route] of routes) fastify.register(route, { prefix: `/api/${name}` });
};

let routesReady: Promise<void> | undefined

export default async function handler(request: any, response: any) {
  routesReady ??= registerRoutes()
  await routesReady
  await fastify.ready()
  const payload = request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body
  const result = await fastify.inject({
    method: request.method,
    url: request.url ?? '/',
    headers: request.headers,
    payload,
  })
  response.statusCode = result.statusCode
  for (const [key, value] of Object.entries(result.headers)) response.setHeader(key, value as string)
  response.end(result.rawPayload)
}

if (process.env.VERCEL !== '1') {
  const start = async () => {
    try {
      await registerRoutes()
      const port = Number(process.env.PORT ?? 3001)
      await fastify.listen({ port, host: '0.0.0.0' })
      console.log(`Server listening on http://0.0.0.0:${port}`)
    } catch (err) {
      fastify.log.error(err)
      process.exit(1)
    }
  }
  void start()
}
