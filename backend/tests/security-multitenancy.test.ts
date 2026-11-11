import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  resolveWorkspaceContext,
  WorkspaceAccessError,
} from '../src/lib/workspace.js';
import prisma from '../src/lib/prisma.js';

describe('Multi-Tenancy & Strict Tenant Isolation', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('resolves active workspace context when user is a valid member', async () => {
    const mockRequest: any = {
      userId: 'user-tenant-1',
      headers: { 'x-workspace-id': 'workspace-tenant-1' },
      query: {},
      url: '/api/tasks',
    };

    vi.spyOn(prisma.workspaceMember, 'findUnique').mockResolvedValue({
      id: 'member-1',
      workspaceId: 'workspace-tenant-1',
      userId: 'user-tenant-1',
      role: 'ADMIN',
      createdAt: new Date(),
      workspace: { id: 'workspace-tenant-1', name: 'Tenant Alpha Workspace', createdAt: new Date() },
    } as any);

    const context = await resolveWorkspaceContext(mockRequest);
    expect(context.id).toBe('workspace-tenant-1');
    expect(context.role).toBe('ADMIN');
    expect(context.userId).toBe('user-tenant-1');
    expect(context.workspaceName).toBe('Tenant Alpha Workspace');
  });

  it('rejects access with 403 ERR_FORBIDDEN_WORKSPACE_ACCESS when user attempts cross-tenant access', async () => {
    const mockRequest: any = {
      userId: 'attacker-user',
      headers: { 'x-workspace-id': 'victim-workspace-999' },
      query: {},
      url: '/api/tasks',
    };

    // User is NOT a member of victim-workspace-999
    vi.spyOn(prisma.workspaceMember, 'findUnique').mockResolvedValue(null);

    await expect(resolveWorkspaceContext(mockRequest)).rejects.toThrow(WorkspaceAccessError);

    try {
      await resolveWorkspaceContext(mockRequest);
    } catch (err: any) {
      expect(err).toBeInstanceOf(WorkspaceAccessError);
      expect(err.problem.status).toBe(403);
      expect(err.problem.code).toBe('ERR_FORBIDDEN_WORKSPACE_ACCESS');
      expect(err.problem.title).toBe('Workspace Access Forbidden');
      expect(err.problem.detail).toContain('victim-workspace-999');
    }
  });

  it('falls back to primary workspace when no header or query param is provided', async () => {
    const mockRequest: any = {
      userId: 'user-tenant-2',
      headers: {},
      query: {},
      url: '/api/tasks',
    };

    vi.spyOn(prisma.workspaceMember, 'findFirst').mockResolvedValue({
      id: 'member-primary',
      workspaceId: 'workspace-primary',
      userId: 'user-tenant-2',
      role: 'MEMBER',
      createdAt: new Date(),
      workspace: { id: 'workspace-primary', name: 'Primary HQ', createdAt: new Date() },
    } as any);

    const context = await resolveWorkspaceContext(mockRequest);
    expect(context.id).toBe('workspace-primary');
    expect(context.role).toBe('MEMBER');
  });

  it('auto-provisions default workspace with OWNER role for fresh users without any membership', async () => {
    const mockRequest: any = {
      userId: 'fresh-user-3',
      headers: {},
      query: {},
      url: '/api/tasks',
    };

    vi.spyOn(prisma.workspaceMember, 'findFirst').mockResolvedValue(null);
    vi.spyOn(prisma.workspace, 'create').mockResolvedValue({
      id: 'auto-created-ws',
      name: 'Meu workspace',
      createdAt: new Date(),
    } as any);

    const context = await resolveWorkspaceContext(mockRequest);
    expect(context.id).toBe('auto-created-ws');
    expect(context.role).toBe('OWNER');
    expect(context.userId).toBe('fresh-user-3');
  });
});
