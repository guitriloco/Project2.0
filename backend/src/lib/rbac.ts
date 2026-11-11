import type { FastifyRequest, FastifyReply } from 'fastify';
import { resolveWorkspaceContext, type WorkspaceRole } from './workspace.js';
import { createProblemDetails } from './schemas/contracts.js';

export const ROLE_HIERARCHY: Record<WorkspaceRole, number> = {
  OWNER: 40,
  ADMIN: 30,
  MEMBER: 20,
  OBSERVER: 10,
};

export function hasMinimumRole(userRole: WorkspaceRole, requiredRole: WorkspaceRole): boolean {
  return (ROLE_HIERARCHY[userRole] ?? 0) >= (ROLE_HIERARCHY[requiredRole] ?? 0);
}

export function requireRole(allowedRoles: WorkspaceRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.workspace) {
      try {
        request.workspace = await resolveWorkspaceContext(request);
      } catch (err: any) {
        if (err?.problem) {
          return reply
            .code(err.problem.status)
            .header('content-type', 'application/problem+json')
            .send(err.problem);
        }
        const problem = createProblemDetails({
          status: 403,
          title: 'Workspace Access Denied',
          detail: err?.message || 'Acesso negado ao workspace.',
          instance: request.url,
          code: 'ERR_FORBIDDEN_WORKSPACE_ACCESS',
        });
        return reply.code(403).header('content-type', 'application/problem+json').send(problem);
      }
    }

    const currentRole = request.workspace.role;
    if (!allowedRoles.includes(currentRole)) {
      const problem = createProblemDetails({
        status: 403,
        title: 'Insufficient Permissions',
        detail: `Esta operação requer privilégios de [${allowedRoles.join(', ')}]. Seu papel atual é '${currentRole}'.`,
        instance: request.url,
        code: 'ERR_INSUFFICIENT_PERMISSIONS',
      });
      return reply.code(403).header('content-type', 'application/problem+json').send(problem);
    }
  };
}

export const requireWorkspaceOwner = requireRole(['OWNER']);
export const requireWorkspaceAdmin = requireRole(['OWNER', 'ADMIN']);
export const requireWorkspaceMember = requireRole(['OWNER', 'ADMIN', 'MEMBER']);
export const requireWorkspaceViewer = requireRole(['OWNER', 'ADMIN', 'MEMBER', 'OBSERVER']);
