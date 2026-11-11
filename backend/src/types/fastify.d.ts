import type { FastifyRequest } from 'fastify';

export type WorkspaceRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'OBSERVER';

export interface WorkspaceContext {
  id: string;
  role: WorkspaceRole;
  userId: string;
  workspaceName?: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    userId?: string;
    workspace?: WorkspaceContext;
  }
}
