import { describe, it, expect, vi, beforeEach } from 'vitest';
import { recordAuditEvent, recordAuditFromRequest } from '../src/lib/audit.js';
import prisma from '../src/lib/prisma.js';

describe('Audit Trail Immutability & Contextual Enrichment', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('records audit event with all required and optional attributes', async () => {
    let capturedCreateData: any = null;

    vi.spyOn(prisma.auditEvent, 'create').mockImplementation(async (args: any) => {
      capturedCreateData = args.data;
      return { ...args.data, createdAt: new Date() };
    });

    await recordAuditEvent({
      type: 'TASK_CREATED',
      entityId: 'task-100',
      entityTitle: 'Security hardening task',
      status: 'PENDING',
      source: 'tasks',
      workspaceId: 'workspace-secure-1',
      actorUserId: 'operator-1',
      ipAddress: '192.168.1.50',
      userAgent: 'Mozilla/5.0 Test Suite',
      details: { priority: 'HIGH' },
    });

    expect(capturedCreateData).not.toBeNull();
    expect(capturedCreateData.type).toBe('TASK_CREATED');
    expect(capturedCreateData.entityId).toBe('task-100');
    expect(capturedCreateData.workspaceId).toBe('workspace-secure-1');
    expect(capturedCreateData.details).not.toBeNull();

    const details = JSON.parse(JSON.stringify(capturedCreateData.details));
    expect(details.actorUserId).toBe('operator-1');
    expect(details.ipAddress).toBe('192.168.1.50');
    expect(details.userAgent).toBe('Mozilla/5.0 Test Suite');
    expect(details.priority).toBe('HIGH');
    expect(details.timestamp).toBeDefined();
  });

  it('extracts contextual actor, IP, and workspaceId seamlessly from FastifyRequest', async () => {
    let capturedCreateData: any = null;

    vi.spyOn(prisma.auditEvent, 'create').mockImplementation(async (args: any) => {
      capturedCreateData = args.data;
      return { ...args.data, createdAt: new Date() };
    });

    const mockRequest: any = {
      userId: 'user-actor-42',
      ip: '10.0.0.1',
      headers: {
        'x-forwarded-for': '203.0.113.195, 10.0.0.1',
        'user-agent': 'Chrome/124.0.0.0 Unit Test',
      },
      workspace: {
        id: 'ws-context-99',
        role: 'ADMIN',
        userId: 'user-actor-42',
      },
    };

    await recordAuditFromRequest(mockRequest, {
      type: 'DECISION_LOGGED',
      entityId: 'dec-200',
      entityTitle: 'Approve Architecture Plan',
      status: 'APPROVED',
      source: 'decisions',
      details: { impact: 'HIGH', confidence: 0.95 },
    });

    expect(capturedCreateData.workspaceId).toBe('ws-context-99');
    expect(capturedCreateData.type).toBe('DECISION_LOGGED');
    const details = capturedCreateData.details;
    expect(details.actorUserId).toBe('user-actor-42');
    expect(details.ipAddress).toBe('203.0.113.195');
    expect(details.userAgent).toBe('Chrome/124.0.0.0 Unit Test');
  });

  it('fails gracefully when workspaceId is missing from both input and request context', async () => {
    const mockRequest: any = {
      userId: 'user-actor-42',
      headers: {},
      workspace: undefined,
    };

    await expect(
      recordAuditFromRequest(mockRequest, {
        type: 'ORPHAN_EVENT',
        entityId: 'orphan-1',
        entityTitle: 'Orphan test',
        status: 'PENDING',
        source: 'test',
      })
    ).rejects.toThrow('Workspace ID is required');
  });
});
