import { describe, it, expect, vi } from 'vitest';
import {
  ROLE_HIERARCHY,
  hasMinimumRole,
  requireRole,
  requireWorkspaceAdmin,
  requireWorkspaceMember,
} from '../src/lib/rbac.js';

describe('RBAC & Role Hierarchy Enforcement', () => {
  it('correctly orders role hierarchy: OWNER > ADMIN > MEMBER > OBSERVER', () => {
    expect(ROLE_HIERARCHY.OWNER).toBeGreaterThan(ROLE_HIERARCHY.ADMIN);
    expect(ROLE_HIERARCHY.ADMIN).toBeGreaterThan(ROLE_HIERARCHY.MEMBER);
    expect(ROLE_HIERARCHY.MEMBER).toBeGreaterThan(ROLE_HIERARCHY.OBSERVER);

    expect(hasMinimumRole('OWNER', 'ADMIN')).toBe(true);
    expect(hasMinimumRole('ADMIN', 'ADMIN')).toBe(true);
    expect(hasMinimumRole('ADMIN', 'MEMBER')).toBe(true);
    expect(hasMinimumRole('MEMBER', 'ADMIN')).toBe(false);
    expect(hasMinimumRole('OBSERVER', 'MEMBER')).toBe(false);
  });

  it('rejects OBSERVER role with 403 ERR_INSUFFICIENT_PERMISSIONS on mutation routes', async () => {
    const guard = requireRole(['OWNER', 'ADMIN', 'MEMBER']);

    const mockRequest: any = {
      userId: 'observer-user',
      url: '/api/tasks',
      workspace: {
        id: 'ws-123',
        role: 'OBSERVER',
        userId: 'observer-user',
      },
    };

    let sentCode = 0;
    let sentHeaders: Record<string, string> = {};
    let sentPayload: any = null;

    const mockReply: any = {
      code(c: number) {
        sentCode = c;
        return this;
      },
      header(k: string, v: string) {
        sentHeaders[k] = v;
        return this;
      },
      send(p: any) {
        sentPayload = p;
        return this;
      },
    };

    await guard(mockRequest, mockReply);

    expect(sentCode).toBe(403);
    expect(sentHeaders['content-type']).toBe('application/problem+json');
    expect(sentPayload.code).toBe('ERR_INSUFFICIENT_PERMISSIONS');
    expect(sentPayload.title).toBe('Insufficient Permissions');
    expect(sentPayload.detail).toContain('OBSERVER');
  });

  it('rejects MEMBER role on destructive actions requiring ADMIN/OWNER', async () => {
    const guard = requireWorkspaceAdmin;

    const mockRequest: any = {
      userId: 'member-user',
      url: '/api/tasks/task-456',
      workspace: {
        id: 'ws-123',
        role: 'MEMBER',
        userId: 'member-user',
      },
    };

    let sentCode = 0;
    let sentPayload: any = null;

    const mockReply: any = {
      code(c: number) {
        sentCode = c;
        return this;
      },
      header() {
        return this;
      },
      send(p: any) {
        sentPayload = p;
        return this;
      },
    };

    await guard(mockRequest, mockReply);

    expect(sentCode).toBe(403);
    expect(sentPayload.code).toBe('ERR_INSUFFICIENT_PERMISSIONS');
    expect(sentPayload.detail).toContain('OWNER, ADMIN');
  });

  it('allows ADMIN and OWNER roles through admin guards', async () => {
    const guard = requireWorkspaceAdmin;

    const mockAdminRequest: any = {
      userId: 'admin-user',
      url: '/api/tasks/task-789',
      workspace: {
        id: 'ws-123',
        role: 'ADMIN',
        userId: 'admin-user',
      },
    };

    const mockSend = vi.fn();
    const mockReply: any = {
      code: vi.fn().mockReturnThis(),
      header: vi.fn().mockReturnThis(),
      send: mockSend,
    };

    await guard(mockAdminRequest, mockReply);
    expect(mockSend).not.toHaveBeenCalled(); // Passes through without error
  });
});
