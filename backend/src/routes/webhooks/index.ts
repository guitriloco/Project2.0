import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { withWorkspaceContext } from '../../lib/workspace.js';
import { requireWorkspaceViewer, requireWorkspaceAdmin } from '../../lib/rbac.js';
import { rateLimit } from '../../lib/rate-limiter.js';
import { recordAuditFromRequest } from '../../lib/audit.js';
import {
  registerWebhook,
  listWebhooks,
  getWebhook,
  deleteWebhook,
  dispatchTestPing,
  listDeliveries,
  listDlq,
  getDelivery,
  replayDlqDelivery,
  deleteDlqDelivery,
} from '../../lib/webhooks.js';
import { createProblemDetails } from '../../lib/schemas/contracts.js';

const CreateWebhookSchema = z.object({
  targetUrl: z
    .string()
    .url('Endereço targetUrl deve ser uma URL válida (http/https)')
    .max(500, 'Máximo de 500 caracteres'),
  events: z
    .array(z.enum(['task:created', 'task:updated', 'task:deleted', 'decision:logged', 'decision:voted', 'audit:recorded']))
    .min(1, 'Selecione pelo menos um evento para subscrição')
    .default(['task:created', 'decision:logged']),
});

const QueryDeliveriesSchema = z.object({
  status: z.enum(['PENDING', 'RETRYING', 'DELIVERED', 'DEAD_LETTER']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

const webhooksRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/webhooks: List all active webhook subscriptions for workspace
  fastify.get(
    '/',
    {
      preHandler: [withWorkspaceContext, requireWorkspaceViewer],
    },
    async (request) => {
      const workspaceId = request.workspace!.id;
      return listWebhooks(workspaceId);
    }
  );

  // POST /api/webhooks: Register new webhook subscription (Requires ADMIN or OWNER)
  fastify.post(
    '/',
    {
      preHandler: [
        withWorkspaceContext,
        requireWorkspaceAdmin,
        rateLimit({ max: 30, windowMs: 60000 }),
      ],
    },
    async (request, reply) => {
      const parsed = CreateWebhookSchema.safeParse(request.body);
      if (!parsed.success) {
        const problem = createProblemDetails({
          status: 400,
          title: 'Invalid Webhook Payload',
          detail: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
          instance: request.url,
          code: 'ERR_WEBHOOK_VALIDATION',
          invalidParams: parsed.error.issues.map((i) => ({ name: i.path.join('.'), reason: i.message })),
        });
        return reply.code(400).header('content-type', 'application/problem+json').send(problem);
      }

      const workspaceId = request.workspace!.id;
      const subscription = registerWebhook({
        workspaceId,
        targetUrl: parsed.data.targetUrl,
        events: parsed.data.events,
      });

      await recordAuditFromRequest(request, {
        type: 'WEBHOOK_REGISTERED',
        entityId: subscription.id,
        entityTitle: subscription.targetUrl,
        status: 'ACTIVE',
        source: 'webhooks',
        details: {
          targetUrl: subscription.targetUrl,
          events: subscription.events,
          registeredBy: request.userId,
        },
      });

      return reply.code(201).send(subscription);
    }
  );

  // DELETE /api/webhooks/:id: Unregister webhook subscription (Requires ADMIN or OWNER)
  fastify.delete(
    '/:id',
    {
      preHandler: [withWorkspaceContext, requireWorkspaceAdmin],
    },
    async (request, reply) => {
      const params = request.params as { id: string };
      const workspaceId = request.workspace!.id;
      const existing = getWebhook(params.id, workspaceId);

      if (!existing) {
        const problem = createProblemDetails({
          status: 404,
          title: 'Webhook Not Found',
          detail: `Inscrição de webhook '${params.id}' não foi encontrada no workspace ativo.`,
          instance: request.url,
          code: 'ERR_WEBHOOK_NOT_FOUND',
        });
        return reply.code(404).header('content-type', 'application/problem+json').send(problem);
      }

      deleteWebhook(params.id, workspaceId);

      await recordAuditFromRequest(request, {
        type: 'WEBHOOK_DELETED',
        entityId: params.id,
        entityTitle: existing.targetUrl,
        status: 'DELETED',
        source: 'webhooks',
        details: { deletedBy: request.userId, targetUrl: existing.targetUrl },
      });

      return reply.send({ ok: true, deletedId: params.id });
    }
  );

  // POST /api/webhooks/:id/test: Dispatch verification ping (Requires ADMIN or OWNER)
  fastify.post(
    '/:id/test',
    {
      preHandler: [withWorkspaceContext, requireWorkspaceAdmin],
    },
    async (request, reply) => {
      const params = request.params as { id: string };
      const workspaceId = request.workspace!.id;
      const sub = getWebhook(params.id, workspaceId);

      if (!sub) {
        const problem = createProblemDetails({
          status: 404,
          title: 'Webhook Not Found',
          detail: `Inscrição de webhook '${params.id}' não foi encontrada no workspace ativo.`,
          instance: request.url,
          code: 'ERR_WEBHOOK_NOT_FOUND',
        });
        return reply.code(404).header('content-type', 'application/problem+json').send(problem);
      }

      const result = await dispatchTestPing(sub);

      await recordAuditFromRequest(request, {
        type: 'WEBHOOK_TEST_DISPATCHED',
        entityId: sub.id,
        entityTitle: sub.targetUrl,
        status: result.ok ? 'DELIVERED' : 'FAILED',
        source: 'webhooks',
        details: {
          targetUrl: sub.targetUrl,
          status: result.status,
          error: result.error,
        },
      });

      return reply.send({ ok: result.ok, delivery: result, subscription: sub });
    }
  );

  // GET /api/webhooks/deliveries: Query recent deliveries and retry queue
  fastify.get(
    '/deliveries',
    {
      preHandler: [withWorkspaceContext, requireWorkspaceViewer],
    },
    async (request, reply) => {
      const parsed = QueryDeliveriesSchema.safeParse(request.query);
      if (!parsed.success) {
        const problem = createProblemDetails({
          status: 400,
          title: 'Invalid Deliveries Filter',
          detail: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
          instance: request.url,
          code: 'ERR_DELIVERIES_FILTER_INVALID',
        });
        return reply.code(400).header('content-type', 'application/problem+json').send(problem);
      }

      const workspaceId = request.workspace!.id;
      const deliveries = listDeliveries(workspaceId, parsed.data.status).slice(0, parsed.data.limit);
      return deliveries;
    }
  );

  // GET /api/webhooks/dlq: List dead letter queue items (failed deliveries exceeding retries)
  fastify.get(
    '/dlq',
    {
      preHandler: [withWorkspaceContext, requireWorkspaceViewer],
    },
    async (request) => {
      const workspaceId = request.workspace!.id;
      return listDlq(workspaceId);
    }
  );

  // POST /api/webhooks/dlq/:deliveryId/replay: Manually replay a dead-letter delivery
  fastify.post(
    '/dlq/:deliveryId/replay',
    {
      preHandler: [
        withWorkspaceContext,
        requireWorkspaceAdmin,
        rateLimit({ max: 30, windowMs: 60000 }),
      ],
    },
    async (request, reply) => {
      const params = request.params as { deliveryId: string };
      const workspaceId = request.workspace!.id;
      const existing = getDelivery(params.deliveryId, workspaceId);

      if (!existing) {
        const problem = createProblemDetails({
          status: 404,
          title: 'Delivery Not Found',
          detail: `Entrega de webhook '${params.deliveryId}' não foi encontrada no workspace ativo.`,
          instance: request.url,
          code: 'ERR_DELIVERY_NOT_FOUND',
        });
        return reply.code(404).header('content-type', 'application/problem+json').send(problem);
      }

      const replayed = await replayDlqDelivery(params.deliveryId, workspaceId);

      await recordAuditFromRequest(request, {
        type: 'WEBHOOK_DLQ_REPLAYED',
        entityId: params.deliveryId,
        entityTitle: existing.targetUrl,
        status: replayed?.status === 'DELIVERED' ? 'DELIVERED' : 'RETRYING',
        source: 'webhooks-dlq',
        details: {
          deliveryId: params.deliveryId,
          targetUrl: existing.targetUrl,
          eventType: existing.event.type,
          replayedBy: request.userId,
        },
      });

      return reply.send({
        ok: true,
        delivery: replayed,
      });
    }
  );

  // DELETE /api/webhooks/dlq/:deliveryId: Purge dead-letter delivery record
  fastify.delete(
    '/dlq/:deliveryId',
    {
      preHandler: [withWorkspaceContext, requireWorkspaceAdmin],
    },
    async (request, reply) => {
      const params = request.params as { deliveryId: string };
      const workspaceId = request.workspace!.id;
      const existing = getDelivery(params.deliveryId, workspaceId);

      if (!existing) {
        const problem = createProblemDetails({
          status: 404,
          title: 'Delivery Not Found',
          detail: `Entrega de webhook '${params.deliveryId}' não foi encontrada no workspace ativo.`,
          instance: request.url,
          code: 'ERR_DELIVERY_NOT_FOUND',
        });
        return reply.code(404).header('content-type', 'application/problem+json').send(problem);
      }

      deleteDlqDelivery(params.deliveryId, workspaceId);

      await recordAuditFromRequest(request, {
        type: 'WEBHOOK_DLQ_PURGED',
        entityId: params.deliveryId,
        entityTitle: existing.targetUrl,
        status: 'DELETED',
        source: 'webhooks-dlq',
        details: {
          deliveryId: params.deliveryId,
          purgedBy: request.userId,
        },
      });

      return reply.send({ ok: true, deletedId: params.deliveryId });
    }
  );
};

export default webhooksRoutes;
