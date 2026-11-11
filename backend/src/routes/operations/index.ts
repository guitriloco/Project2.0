import type { FastifyPluginAsync } from 'fastify';
import prisma from '../../lib/prisma.js';
import { withWorkspaceContext } from '../../lib/workspace.js';
import { requireWorkspaceViewer } from '../../lib/rbac.js';
import { workspaceEventBus } from '../../lib/events.js';
import { createProblemDetails } from '../../lib/schemas/contracts.js';
import { verifyChainIntegrity } from '../../lib/auditChain.js';

const operationsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/operations/summary: Consolidated operational metrics strictly scoped to active workspace
  fastify.get(
    '/summary',
    {
      preHandler: [withWorkspaceContext, requireWorkspaceViewer],
    },
    async (request, reply) => {
      try {
        const userId = request.userId!;
        const workspaceId = request.workspace!.id;

        const conversationCount = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)
          ? prisma.xerebroConversation.count({ where: { userId } }).catch(() => 0)
          : Promise.resolve(0);

        const [
          tasks,
          decisions,
          proposals,
          conversations,
          recentTasks,
          recentDecisions,
          recentAudit,
          auditCount,
        ] = await Promise.all([
          prisma.task.groupBy({
            by: ['status'],
            where: { workspaceId },
            _count: { _all: true },
          }).catch(() => []),
          prisma.decisionLog.count({ where: { workspaceId } }).catch(() => 0),
          prisma.proposal.groupBy({
            by: ['status'],
            where: { workspaceId },
            _count: { _all: true },
          }).catch(() => []),
          conversationCount,
          prisma.task.findMany({
            where: { workspaceId },
            orderBy: { updatedAt: 'desc' },
            take: 8,
          }).catch(() => []),
          prisma.decisionLog.findMany({
            where: { workspaceId },
            orderBy: { createdAt: 'desc' },
            take: 6,
          }).catch(() => []),
          prisma.auditEvent.findMany({
            where: { workspaceId },
            orderBy: { createdAt: 'desc' },
            take: 20,
          }).catch(() => []),
          prisma.auditEvent.count({ where: { workspaceId } }).catch(() => 0),
        ]);

        const totalTasks = (tasks as Array<{ _count: { _all: number } }>).reduce(
          (sum: number, item: { _count: { _all: number } }) => sum + item._count._all,
          0
        );
        const totalProposals = (proposals as Array<{ _count: { _all: number } }>).reduce(
          (sum: number, item: { _count: { _all: number } }) => sum + item._count._all,
          0
        );

        return reply.send({
          generatedAt: new Date().toISOString(),
          workspace: {
            id: workspaceId,
            role: request.workspace!.role,
            name: request.workspace!.workspaceName,
          },
          tasks: { total: totalTasks, byStatus: tasks, recent: recentTasks },
          decisions: { total: decisions, recent: recentDecisions },
          proposals: { total: totalProposals, byStatus: proposals },
          conversations,
          recentTasks,
          audit: { total: auditCount, recent: recentAudit },
        });
      } catch (err: any) {
        const problem = createProblemDetails({
          status: 500,
          title: 'Operations Summary Failed',
          detail: err?.message || 'Falha ao consolidar resumo operacional.',
          instance: request.url,
          code: 'ERR_OPERATIONS_SUMMARY',
        });
        return reply.code(500).header('content-type', 'application/problem+json').send(problem);
      }
    }
  );

  // GET /api/operations/stream: Real-time Server-Sent Events (SSE) telemetry stream
  fastify.get(
    '/stream',
    {
      preHandler: [withWorkspaceContext, requireWorkspaceViewer],
    },
    async (request, reply) => {
      const workspaceId = request.workspace!.id;

      reply.raw.setHeader('Content-Type', 'text/event-stream');
      reply.raw.setHeader('Cache-Control', 'no-cache, no-transform');
      reply.raw.setHeader('Connection', 'keep-alive');
      reply.raw.setHeader('X-Accel-Buffering', 'no');

      // Send initial connection handshake
      const handshake = JSON.stringify({
        status: 'connected',
        workspaceId,
        timestamp: new Date().toISOString(),
      });
      reply.raw.write(`event: connected\ndata: ${handshake}\n\n`);

      // Subscribe to events published for this workspace
      const unsubscribe = workspaceEventBus.subscribe(workspaceId, (domainEvent) => {
        try {
          reply.raw.write(`event: ${domainEvent.type}\ndata: ${JSON.stringify(domainEvent)}\n\n`);
        } catch {
          // Socket was closed
        }
      });

      // 20-second heartbeat to maintain alive state across intermediate proxies
      const heartbeat = setInterval(() => {
        try {
          reply.raw.write(`: heartbeat ${new Date().toISOString()}\n\n`);
        } catch {
          clearInterval(heartbeat);
          unsubscribe();
        }
      }, 20000);

      const cleanup = () => {
        clearInterval(heartbeat);
        unsubscribe();
      };

      request.raw.on('close', cleanup);
      request.raw.on('end', cleanup);

      // Keep stream open
      return new Promise<void>((resolve) => {
        request.raw.on('close', () => resolve());
      });
    }
  );

  // GET /api/operations/governance/verify-chain: Check cryptographic chain integrity
  fastify.get(
    '/governance/verify-chain',
    {
      preHandler: [withWorkspaceContext, requireWorkspaceViewer],
    },
    async (request, reply) => {
      try {
        const workspaceId = request.workspace!.id;
        const verification = verifyChainIntegrity(workspaceId);
        return reply.send(verification);
      } catch (err: any) {
        return reply.code(500).send({
          error: 'Falha ao verificar integridade criptográfica.',
          detail: err?.message,
        });
      }
    }
  );
};

export default operationsRoutes;
