import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import {
  calculateBackoffDelay,
  computeIdempotencyKey,
  registerWebhook,
  enqueueWebhookDelivery,
  processDelivery,
  listDeliveries,
  listDlq,
  getDelivery,
  replayDlqDelivery,
  deleteDlqDelivery,
  type WebhookSubscription,
} from '../src/lib/webhooks.js';
import webhooksRoutes from '../src/routes/webhooks/index.js';
import prisma from '../src/lib/prisma.js';

describe('Webhook Resilience: Exponential Backoff, Retry Queue & Dead Letter Queue (DLQ)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Mathematical Backoff & Idempotency Algorithms', () => {
    it('computes exponential backoff delays with jitter within expected bounds', () => {
      const baseMs = 1000;
      const maxMs = 60000;
      const jitterRatio = 0.2;

      // Attempt 1: base * 2^0 = 1000ms ± 200ms -> [800, 1200]
      const delay1 = calculateBackoffDelay(1, baseMs, maxMs, jitterRatio);
      expect(delay1).toBeGreaterThanOrEqual(750);
      expect(delay1).toBeLessThanOrEqual(1250);

      // Attempt 2: base * 2^1 = 2000ms ± 400ms -> [1600, 2400]
      const delay2 = calculateBackoffDelay(2, baseMs, maxMs, jitterRatio);
      expect(delay2).toBeGreaterThanOrEqual(1550);
      expect(delay2).toBeLessThanOrEqual(2450);

      // Attempt 3: base * 2^2 = 4000ms ± 800ms -> [3200, 4800]
      const delay3 = calculateBackoffDelay(3, baseMs, maxMs, jitterRatio);
      expect(delay3).toBeGreaterThanOrEqual(3150);
      expect(delay3).toBeLessThanOrEqual(4850);

      // High attempt should clamp to maxMs
      const delayMax = calculateBackoffDelay(15, baseMs, maxMs, jitterRatio);
      expect(delayMax).toBeLessThanOrEqual(maxMs * 1.25);
    });

    it('generates deterministic SHA-256 idempotency key for identical subscription and event ID', () => {
      const subId = 'whk-abc-123';
      const eventId = 'evt-xyz-789';

      const key1 = computeIdempotencyKey(subId, eventId);
      const key2 = computeIdempotencyKey(subId, eventId);
      const keyDifferent = computeIdempotencyKey(subId, 'evt-other');

      expect(key1).toBe(key2);
      expect(key1).toMatch(/^[a-f0-9]{64}$/);
      expect(key1).not.toBe(keyDifferent);
    });
  });

  describe('Delivery Queueing & State Machine Transitions', () => {
    it('enqueues deliveries and transitions from RETRYING to DEAD_LETTER upon repeated failures', async () => {
      const wsId = 'ws-resilience-1';
      const sub = registerWebhook({
        workspaceId: wsId,
        targetUrl: 'https://api.flaky-service.org/webhook',
        events: ['task:created'],
      });

      const event = {
        id: `evt-fail-${Date.now()}`,
        type: 'task:created' as const,
        workspaceId: wsId,
        timestamp: new Date().toISOString(),
        data: { title: 'Flaky task' },
      };

      // Mock fetch returning HTTP 500 error
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      } as any);

      try {
        const delivery = enqueueWebhookDelivery(sub, event, { maxAttempts: 3, immediate: false });
        expect(delivery.status).toBe('PENDING');
        expect(delivery.attempts).toHaveLength(0);

        // Attempt 1 -> Fail -> RETRYING
        const res1 = await processDelivery(delivery);
        expect(res1.ok).toBe(false);
        expect(delivery.status).toBe('RETRYING');
        expect(delivery.attempts).toHaveLength(1);
        expect(delivery.nextRetryAt).toBeDefined();

        // Attempt 2 -> Fail -> RETRYING
        const res2 = await processDelivery(delivery);
        expect(res2.ok).toBe(false);
        expect(delivery.status).toBe('RETRYING');
        expect(delivery.attempts).toHaveLength(2);

        // Attempt 3 -> Fail -> Max reached -> DEAD_LETTER
        const res3 = await processDelivery(delivery);
        expect(res3.ok).toBe(false);
        expect(delivery.status).toBe('DEAD_LETTER');
        expect(delivery.attempts).toHaveLength(3);
        expect(delivery.nextRetryAt).toBeNull();
        expect(delivery.completedAt).toBeDefined();

        // Check DLQ list
        const dlqItems = listDlq(wsId);
        expect(dlqItems.some((d) => d.id === delivery.id)).toBe(true);
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('successfully transitions to DELIVERED when upstream returns HTTP 200', async () => {
      const wsId = 'ws-success-1';
      const sub = registerWebhook({
        workspaceId: wsId,
        targetUrl: 'https://api.reliable-service.org/webhook',
        events: ['decision:logged'],
      });

      const event = {
        id: `evt-success-${Date.now()}`,
        type: 'decision:logged' as const,
        workspaceId: wsId,
        timestamp: new Date().toISOString(),
        data: { action: 'Reliable Decision' },
      };

      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
      } as any);

      try {
        const delivery = enqueueWebhookDelivery(sub, event, { maxAttempts: 5, immediate: false });
        const res = await processDelivery(delivery);

        expect(res.ok).toBe(true);
        expect(delivery.status).toBe('DELIVERED');
        expect(delivery.attempts).toHaveLength(1);
        expect(delivery.completedAt).toBeDefined();
        expect(delivery.nextRetryAt).toBeNull();
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  describe('DLQ Replay & Purge Lifecycle', () => {
    it('replays dead-letter delivery immediately and resets attempts allowance', async () => {
      const wsId = 'ws-replay-test';
      const sub = registerWebhook({
        workspaceId: wsId,
        targetUrl: 'https://api.recovered-service.org/webhook',
        events: ['task:created'],
      });

      const event = {
        id: `evt-replay-${Date.now()}`,
        type: 'task:created' as const,
        workspaceId: wsId,
        timestamp: new Date().toISOString(),
        data: { title: 'Recovered task' },
      };

      const originalFetch = global.fetch;

      // First fail to reach DEAD_LETTER
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
      } as any);

      const delivery = enqueueWebhookDelivery(sub, event, { maxAttempts: 1, immediate: false });
      await processDelivery(delivery);
      expect(delivery.status).toBe('DEAD_LETTER');

      // Now service recovers (HTTP 200)
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      } as any);

      try {
        const replayed = await replayDlqDelivery(delivery.id, wsId);
        expect(replayed).not.toBeNull();
        expect(replayed?.status).toBe('DELIVERED');
        expect(replayed?.attempts.length).toBeGreaterThan(1);
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('purges dead-letter record cleanly from delivery store', () => {
      const wsId = 'ws-purge-test';
      const sub = registerWebhook({
        workspaceId: wsId,
        targetUrl: 'https://api.purge-test.org/webhook',
        events: ['task:created'],
      });

      const event = {
        id: `evt-purge-${Date.now()}`,
        type: 'task:created' as const,
        workspaceId: wsId,
        timestamp: new Date().toISOString(),
        data: { title: 'Purge task' },
      };

      const delivery = enqueueWebhookDelivery(sub, event, { maxAttempts: 1, immediate: false });
      delivery.status = 'DEAD_LETTER';

      expect(getDelivery(delivery.id, wsId)).not.toBeNull();
      const purged = deleteDlqDelivery(delivery.id, wsId);
      expect(purged).toBe(true);
      expect(getDelivery(delivery.id, wsId)).toBeNull();
    });
  });

  describe('Fastify DLQ & Deliveries API Endpoints', () => {
    async function createTestApp() {
      const app = Fastify();
      app.addHook('onRequest', async (request: any) => {
        request.userId = 'test-admin-user';
      });

      vi.spyOn(prisma.workspaceMember, 'findFirst').mockResolvedValue({
        id: 'member-test-1',
        workspaceId: 'preview-workspace-id',
        userId: 'test-admin-user',
        role: 'OWNER',
        workspace: { id: 'preview-workspace-id', name: 'Preview Workspace' },
      } as any);

      vi.spyOn(prisma.workspaceMember, 'findUnique').mockResolvedValue({
        id: 'member-test-1',
        workspaceId: 'preview-workspace-id',
        userId: 'test-admin-user',
        role: 'OWNER',
        workspace: { id: 'preview-workspace-id', name: 'Preview Workspace' },
      } as any);

      await app.register(webhooksRoutes, { prefix: '/api/webhooks' });
      return app;
    }

    it('GET /api/webhooks/deliveries returns queued deliveries for workspace', async () => {
      const app = await createTestApp();

      const sub = registerWebhook({
        workspaceId: 'preview-workspace-id',
        targetUrl: 'https://api.sample.org/events',
        events: ['task:created'],
      });

      enqueueWebhookDelivery(sub, {
        id: `evt-api-${Date.now()}`,
        type: 'task:created',
        workspaceId: 'preview-workspace-id',
        timestamp: new Date().toISOString(),
        data: {},
      }, { immediate: false });

      const res = await app.inject({
        method: 'GET',
        url: '/api/webhooks/deliveries',
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
    });

    it('GET /api/webhooks/dlq lists only dead-letter items', async () => {
      const app = await createTestApp();

      const sub = registerWebhook({
        workspaceId: 'preview-workspace-id',
        targetUrl: 'https://api.sample-dlq.org/events',
        events: ['task:created'],
      });

      const del = enqueueWebhookDelivery(sub, {
        id: `evt-dlq-${Date.now()}`,
        type: 'task:created',
        workspaceId: 'preview-workspace-id',
        timestamp: new Date().toISOString(),
        data: {},
      }, { immediate: false });
      del.status = 'DEAD_LETTER';

      const res = await app.inject({
        method: 'GET',
        url: '/api/webhooks/dlq',
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body);
      expect(Array.isArray(data)).toBe(true);
      expect(data.some((d: any) => d.id === del.id)).toBe(true);
    });

    it('POST /api/webhooks/dlq/:deliveryId/replay triggers delivery and records audit', async () => {
      const app = await createTestApp();

      const sub = registerWebhook({
        workspaceId: 'preview-workspace-id',
        targetUrl: 'https://api.replay-api.org/events',
        events: ['task:created'],
      });

      const del = enqueueWebhookDelivery(sub, {
        id: `evt-replay-api-${Date.now()}`,
        type: 'task:created',
        workspaceId: 'preview-workspace-id',
        timestamp: new Date().toISOString(),
        data: {},
      }, { immediate: false });
      del.status = 'DEAD_LETTER';

      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      } as any);

      try {
        const res = await app.inject({
          method: 'POST',
          url: `/api/webhooks/dlq/${del.id}/replay`,
        });

        expect(res.statusCode).toBe(200);
        const data = JSON.parse(res.body);
        expect(data.ok).toBe(true);
        expect(data.delivery.status).toBe('DELIVERED');
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('DELETE /api/webhooks/dlq/:deliveryId purges DLQ item', async () => {
      const app = await createTestApp();

      const sub = registerWebhook({
        workspaceId: 'preview-workspace-id',
        targetUrl: 'https://api.purge-api.org/events',
        events: ['task:created'],
      });

      const del = enqueueWebhookDelivery(sub, {
        id: `evt-purge-api-${Date.now()}`,
        type: 'task:created',
        workspaceId: 'preview-workspace-id',
        timestamp: new Date().toISOString(),
        data: {},
      }, { immediate: false });
      del.status = 'DEAD_LETTER';

      const res = await app.inject({
        method: 'DELETE',
        url: `/api/webhooks/dlq/${del.id}`,
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.ok).toBe(true);
      expect(data.deletedId).toBe(del.id);
    });
  });
});
