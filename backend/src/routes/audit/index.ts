import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import prisma from '../../lib/prisma.js';
import { withWorkspaceContext } from '../../lib/workspace.js';
import { requireWorkspaceViewer, requireWorkspaceAdmin } from '../../lib/rbac.js';
import { recordAuditFromRequest } from '../../lib/audit.js';
import { createProblemDetails } from '../../lib/schemas/contracts.js';

function escapeCsv(val: any): string {
  if (val === null || val === undefined) return '';
  const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

const auditRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/audit: Query audit trail scoped to active workspace
  fastify.get(
    '/',
    {
      preHandler: [withWorkspaceContext, requireWorkspaceViewer],
    },
    async (request, reply) => {
      const parsed = z
        .object({
          entityId: z.string().min(1).optional(),
          limit: z.coerce.number().int().min(1).max(100).default(50),
        })
        .safeParse(request.query);

      if (!parsed.success) {
        const problem = createProblemDetails({
          status: 400,
          title: 'Invalid Audit Filter',
          detail: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
          instance: request.url,
          code: 'ERR_AUDIT_FILTER_INVALID',
        });
        return reply.code(400).header('content-type', 'application/problem+json').send(problem);
      }

      const workspaceId = request.workspace!.id;
      return prisma.auditEvent.findMany({
        where: {
          workspaceId,
          ...(parsed.data.entityId ? { entityId: parsed.data.entityId } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: parsed.data.limit,
      });
    }
  );

  // GET /api/audit/export: Export tamper-evident audit ledger in NDJSON or CSV format (Requires ADMIN or OWNER)
  fastify.get(
    '/export',
    {
      preHandler: [withWorkspaceContext, requireWorkspaceAdmin],
    },
    async (request, reply) => {
      const query = request.query as { format?: string };
      const format = query.format === 'ndjson' ? 'ndjson' : query.format === 'json' ? 'json' : 'csv';
      const workspaceId = request.workspace!.id;
      const dateStr = new Date().toISOString().slice(0, 10);

      const events = await prisma.auditEvent.findMany({
        where: { workspaceId },
        orderBy: { createdAt: 'desc' },
      });

      await recordAuditFromRequest(request, {
        type: 'AUDIT_LOG_EXPORTED',
        entityId: workspaceId,
        entityTitle: `Audit export: ${format.toUpperCase()}`,
        status: 'SUCCESS',
        source: 'audit-export',
        details: { format, exportedRecords: events.length },
      });

      if (format === 'csv') {
        const headers = ['id', 'type', 'entityId', 'entityTitle', 'status', 'source', 'workspaceId', 'createdAt', 'details'];
        const rows = events.map((e: any) =>
          [
            escapeCsv(e.id),
            escapeCsv(e.type),
            escapeCsv(e.entityId),
            escapeCsv(e.entityTitle),
            escapeCsv(e.status),
            escapeCsv(e.source),
            escapeCsv(e.workspaceId),
            escapeCsv(e.createdAt),
            escapeCsv(e.details),
          ].join(',')
        );
        const csv = [headers.join(','), ...rows].join('\n');

        return reply
          .header('content-type', 'text/csv; charset=utf-8')
          .header('content-disposition', `attachment; filename="audit-workspace-${workspaceId}-${dateStr}.csv"`)
          .send(csv);
      }

      if (format === 'ndjson') {
        const ndjson = events.map((e: any) => JSON.stringify(e)).join('\n');
        return reply
          .header('content-type', 'application/x-ndjson; charset=utf-8')
          .header('content-disposition', `attachment; filename="audit-workspace-${workspaceId}-${dateStr}.ndjson"`)
          .send(ndjson);
      }

      return reply
        .header('content-type', 'application/json; charset=utf-8')
        .header('content-disposition', `attachment; filename="audit-workspace-${workspaceId}-${dateStr}.json"`)
        .send(events);
    }
  );

  // Enforce append-only immutability contract: mutating or deleting audit trail is strictly rejected
  const rejectAuditMutation = async (request: FastifyRequest, reply: FastifyReply) => {
    const problem = createProblemDetails({
      status: 405,
      title: 'Audit Trail Immutable',
      detail: 'Os registros de auditoria operacional são estritamente imutáveis e protegidos contra modificação ou exclusão.',
      instance: request.url,
      code: 'ERR_AUDIT_LOG_IMMUTABLE',
    });
    return reply
      .code(405)
      .header('content-type', 'application/problem+json')
      .header('Allow', 'GET')
      .send(problem);
  };

  fastify.post('/', rejectAuditMutation);
  fastify.put('/', rejectAuditMutation);
  fastify.patch('/:id', rejectAuditMutation);
  fastify.delete('/:id', rejectAuditMutation);
};

export default auditRoutes;
