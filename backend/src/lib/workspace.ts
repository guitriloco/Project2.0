import type { FastifyRequest, FastifyReply } from 'fastify';
import prisma from './prisma.js';
import { createProblemDetails, type ProblemDetails } from './schemas/contracts.js';

export type WorkspaceRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'OBSERVER';

export interface WorkspaceContext {
  id: string;
  role: WorkspaceRole;
  userId: string;
  workspaceName?: string;
}

export class WorkspaceAccessError extends Error {
  public problem: ProblemDetails;

  constructor(status: number, code: string, title: string, detail: string, instance?: string) {
    super(detail);
    this.name = 'WorkspaceAccessError';
    this.problem = createProblemDetails({
      status,
      code,
      title,
      detail,
      instance,
    });
  }
}

export async function resolveWorkspaceContext(
  request: FastifyRequest,
  forcedWorkspaceId?: string
): Promise<WorkspaceContext> {
  const userId = request.userId;
  if (!userId) {
    throw new WorkspaceAccessError(
      401,
      'ERR_UNAUTHENTICATED',
      'Authentication Required',
      'Usuário não autenticado para resolver contexto de workspace.',
      request.url
    );
  }

  const headerWorkspaceId = request.headers['x-workspace-id'];
  const queryWorkspaceId = (request.query as Record<string, unknown> | undefined)?.workspaceId;
  const targetWorkspaceId =
    forcedWorkspaceId ||
    (typeof headerWorkspaceId === 'string' && headerWorkspaceId.trim() ? headerWorkspaceId.trim() : undefined) ||
    (typeof queryWorkspaceId === 'string' && queryWorkspaceId.trim() ? queryWorkspaceId.trim() : undefined);

  if (targetWorkspaceId) {
    const membership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: targetWorkspaceId,
          userId,
        },
      },
      include: { workspace: true },
    });

    if (!membership) {
      throw new WorkspaceAccessError(
        403,
        'ERR_FORBIDDEN_WORKSPACE_ACCESS',
        'Workspace Access Forbidden',
        `Acesso negado: o usuário não é membro do workspace '${targetWorkspaceId}'.`,
        request.url
      );
    }

    return {
      id: targetWorkspaceId,
      role: (membership.role as WorkspaceRole) || 'MEMBER',
      userId,
      workspaceName: membership.workspace?.name,
    };
  }

  // Fallback to user's primary/active workspace membership
  const primaryMembership = await prisma.workspaceMember.findFirst({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    include: { workspace: true },
  });

  if (primaryMembership) {
    return {
      id: primaryMembership.workspaceId,
      role: (primaryMembership.role as WorkspaceRole) || 'MEMBER',
      userId,
      workspaceName: primaryMembership.workspace?.name,
    };
  }

  // If no workspace exists yet for the user, create default
  const createdWorkspace = await prisma.workspace.create({
    data: {
      name: 'Meu workspace',
      members: {
        create: {
          userId,
          role: 'OWNER',
        },
      },
    },
  });

  return {
    id: createdWorkspace.id,
    role: 'OWNER',
    userId,
    workspaceName: createdWorkspace.name,
  };
}

export async function withWorkspaceContext(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    request.workspace = await resolveWorkspaceContext(request);
  } catch (err: any) {
    if (err instanceof WorkspaceAccessError) {
      return reply
        .code(err.problem.status)
        .header('content-type', 'application/problem+json')
        .send(err.problem);
    }
    const problem = createProblemDetails({
      status: 403,
      title: 'Workspace Access Denied',
      detail: err?.message || 'Não foi possível validar o acesso ao workspace.',
      instance: request.url,
      code: 'ERR_FORBIDDEN_WORKSPACE_ACCESS',
    });
    return reply.code(403).header('content-type', 'application/problem+json').send(problem);
  }
}

/**
 * Backwards compatible helper returning workspaceId for a given userId
 */
export async function getWorkspaceId(userId: string): Promise<string> {
  const membership = await prisma.workspaceMember.findFirst({
    where: { userId },
    orderBy: { createdAt: 'asc' },
  });
  if (membership) return membership.workspaceId;
  const workspace = await prisma.workspace.create({
    data: {
      name: 'Meu workspace',
      members: { create: { userId, role: 'OWNER' } },
    },
  });
  return workspace.id;
}
