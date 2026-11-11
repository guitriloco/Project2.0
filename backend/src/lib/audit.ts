import type { FastifyRequest } from 'fastify';
import prisma from './prisma.js';
import { asJson } from './json.js';

export type AuditInput = {
  type: string;
  entityId: string;
  entityTitle: string;
  status: string;
  source: string;
  workspaceId: string;
  actorUserId?: string;
  ipAddress?: string;
  userAgent?: string;
  details?: Record<string, unknown>;
};

export async function recordAuditEvent(input: AuditInput) {
  const mergedDetails = {
    ...(input.details || {}),
    actorUserId: input.actorUserId,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    timestamp: new Date().toISOString(),
  };

  const event = await prisma.auditEvent.create({
    data: {
      id: crypto.randomUUID(),
      type: input.type,
      entityId: input.entityId,
      entityTitle: input.entityTitle,
      status: input.status,
      source: input.source,
      workspaceId: input.workspaceId,
      details: asJson(mergedDetails),
    },
  });

  try {
    const { workspaceEventBus } = await import('./events.js');
    workspaceEventBus.publish(input.workspaceId, 'audit:recorded', event);
  } catch {
    // Non-blocking telemetry emission
  }

  return event;
}

export async function recordAuditFromRequest(
  request: FastifyRequest,
  input: {
    type: string;
    entityId: string;
    entityTitle: string;
    status: string;
    source: string;
    workspaceId?: string;
    details?: Record<string, unknown>;
  }
) {
  const workspaceId = input.workspaceId || request.workspace?.id;
  if (!workspaceId) {
    throw new Error('Workspace ID is required to record an audit event.');
  }

  const rawIp =
    (request.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ||
    request.ip;
  const userAgent = request.headers['user-agent'] as string | undefined;

  return recordAuditEvent({
    ...input,
    workspaceId,
    actorUserId: request.userId,
    ipAddress: rawIp,
    userAgent,
  });
}
