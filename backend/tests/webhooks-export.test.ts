import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'node:crypto';
import Fastify from 'fastify';
import {
  signWebhookPayload,
  registerWebhook,
  listWebhooks,
  getWebhook,
  deleteWebhook,
  dispatchWebhookDelivery,
  dispatchTestPing,
} from '../src/lib/webhooks.js';
import auditRoutes from '../src/routes/audit/index.js';
import sandboxRoutes from '../src/routes/sandbox/index.js';
import webhooksRoutes from '../src/routes/webhooks/index.js';
import prisma from '../src/lib/prisma.js';

describe('Ecosystem Extensions: Webhooks, Ledger Export & Enterprise Sandbox', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('HMAC-SHA256 Signatures & Webhook Subscriptions', () => {
    it('generates consistent HMAC-SHA256 signature using secret and UTF-8 payload', () => {
      const payload = JSON.stringify({ id: 'evt-1', type: 'task:created', data: { title: 'Test Task' } });
      const secret = 'test-secret-key-12345';
      const sig = signWebhookPayload(payload, secret);

      const expected = crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
      expect(sig).toBe(expected);
      expect(sig).toMatch(/^[a-f0-9]{64}$/);
    });

    it('registers, lists, and isolates webhook subscriptions strictly by workspace', () => {
      const wsA = 'ws-test-alpha';
      const wsB = 'ws-test-beta';

      const subA = registerWebhook({
        workspaceId: wsA,
        targetUrl: 'https://api.external-alpha.com/webhook',
        events: ['task:created', 'decision:logged'],
      });

      const subB = registerWebhook({
        workspaceId: wsB,
        targetUrl: 'https://api.external-beta.com/events',
        events: ['audit:recorded'],
      });

      expect(subA.id).toMatch(/^whk-/);
      expect(subA.workspaceId).toBe(wsA);
      expect(subA.secret).toBeDefined();

      const listA = listWebhooks(wsA);
      expect(listA.some((s) => s.id === subA.id)).toBe(true);
      expect(listA.some((s) => s.id === subB.id)).toBe(false);

      const listB = listWebhooks(wsB);
      expect(listB.some((s) => s.id === subB.id)).toBe(true);
      expect(listB.some((s) => s.id === subA.id)).toBe(false);

      // Retrieval and cross-tenant guard
      expect(getWebhook(subA.id, wsA)).not.toBeNull();
      expect(getWebhook(subA.id, wsB)).toBeNull();

      // Deletion
      expect(deleteWebhook(subA.id, wsB)).toBe(false);
      expect(deleteWebhook(subA.id, wsA)).toBe(true);
      expect(getWebhook(subA.id, wsA)).toBeNull();
    });

    it('dispatches webhook delivery with cryptographic signature and delivery headers', async () => {
      const sub = registerWebhook({
        workspaceId: 'ws-dispatch-test',
        targetUrl: 'https://api.partner.org/webhook',
        events: ['task:created'],
        secret: 'fixed-delivery-secret',
      });

      let capturedUrl = '';
      let capturedHeaders: Record<string, string> = {};
      let capturedBody = '';

      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockImplementation(async (url: string, opts: any) => {
        capturedUrl = url;
        capturedHeaders = opts.headers;
        capturedBody = opts.body;
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
        } as any;
      });

      try {
        const testEvent = {
          id: 'evt-100',
          type: 'task:created' as const,
          workspaceId: 'ws-dispatch-test',
          timestamp: new Date().toISOString(),
          data: { id: 'task-1', title: 'Webhook dispatch item' },
        };

        const result = await dispatchWebhookDelivery(sub, testEvent);

        expect(result.ok).toBe(true);
        expect(result.status).toBe(200);
        expect(capturedUrl).toBe('https://api.partner.org/webhook');
        expect(capturedHeaders['x-project2-event']).toBe('task:created');
        expect(capturedHeaders['x-project2-signature']).toContain('sha256=');
        expect(capturedHeaders['user-agent']).toBe('Xerebro-Webhook-Worker/2.0');

        // Verify signature in header matches payload
        const sigPart = capturedHeaders['x-project2-signature'].replace('sha256=', '');
        const expectedSig = signWebhookPayload(capturedBody, 'fixed-delivery-secret');
        expect(sigPart).toBe(expectedSig);
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('dispatches test ping verification properly', async () => {
      const sub = registerWebhook({
        workspaceId: 'ws-ping-test',
        targetUrl: 'https://api.partner.org/ping',
        events: ['audit:recorded'],
      });

      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 202,
        statusText: 'Accepted',
      } as any);

      try {
        const pingResult = await dispatchTestPing(sub);
        expect(pingResult.ok).toBe(true);
        expect(pingResult.status).toBe(202);
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  describe('Tamper-Evident Audit Ledger Export (CSV, NDJSON, JSON)', () => {
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

      await app.register(auditRoutes, { prefix: '/api/audit' });
      await app.register(webhooksRoutes, { prefix: '/api/webhooks' });
      await app.register(sandboxRoutes, { prefix: '/api/sandbox' });
      return app;
    }

    it('exports audit ledger as RFC-compliant CSV with attachment headers', async () => {
      const app = await createTestApp();

      vi.spyOn(prisma.auditEvent, 'findMany').mockResolvedValue([
        {
          id: 'audit-1',
          type: 'TASK_CREATED',
          entityId: 'task-1',
          entityTitle: 'Test, with "quotes" and commas',
          status: 'SUCCESS',
          source: 'tasks',
          workspaceId: 'preview-workspace-id',
          createdAt: new Date('2026-10-30T10:00:00Z'),
          details: { priority: 'HIGH' },
        } as any,
      ]);

      const res = await app.inject({
        method: 'GET',
        url: '/api/audit/export?format=csv',
      });

      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain('attachment; filename="audit-workspace-');
      expect(res.body).toContain('id,type,entityId,entityTitle,status,source,workspaceId,createdAt,details');
      expect(res.body).toContain('"Test, with ""quotes"" and commas"');
    });

    it('exports audit ledger as NDJSON stream', async () => {
      const app = await createTestApp();

      vi.spyOn(prisma.auditEvent, 'findMany').mockResolvedValue([
        {
          id: 'audit-nd-1',
          type: 'DECISION_LOGGED',
          workspaceId: 'preview-workspace-id',
          createdAt: new Date(),
        } as any,
        {
          id: 'audit-nd-2',
          type: 'DECISION_VOTED',
          workspaceId: 'preview-workspace-id',
          createdAt: new Date(),
        } as any,
      ]);

      const res = await app.inject({
        method: 'GET',
        url: '/api/audit/export?format=ndjson',
      });

      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toContain('application/x-ndjson');
      const lines = res.body.trim().split('\n');
      expect(lines.length).toBe(2);
      expect(JSON.parse(lines[0]).id).toBe('audit-nd-1');
      expect(JSON.parse(lines[1]).id).toBe('audit-nd-2');
    });
  });

  describe('Enterprise Sandbox Prototype Isolation', () => {
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

      await app.register(sandboxRoutes, { prefix: '/api/sandbox' });
      return app;
    }

    it('exposes isolated prototype catalog with SANDBOX_ISOLATED status', async () => {
      const app = await createTestApp();

      const res = await app.inject({
        method: 'GET',
        url: '/api/sandbox/modules',
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.environment).toBe('ENTERPRISE_SANDBOX');
      expect(data.isolationStatus).toBe('STRICTLY_ISOLATED');
      expect(data.modules.length).toBeGreaterThan(0);
      expect(data.modules.every((m: any) => m.status === 'SANDBOX_ISOLATED')).toBe(true);
    });

    it('executes isolated dry-run simulation without mutating production state', async () => {
      const app = await createTestApp();

      const res = await app.inject({
        method: 'POST',
        url: '/api/sandbox/simulate/consciousness',
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.module.id).toBe('consciousness');
      expect(data.result.executionMode).toBe('DRY_RUN_SANDBOX');
      expect(data.result.safetyInvariantsHold).toBe(true);
    });

    it('returns 404 for unknown sandbox modules', async () => {
      const app = await createTestApp();

      const res = await app.inject({
        method: 'POST',
        url: '/api/sandbox/simulate/non-existent-module',
      });

      expect(res.statusCode).toBe(404);
    });
  });
});
