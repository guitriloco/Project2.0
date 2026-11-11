import type { FastifyPluginAsync } from 'fastify';
import prisma from '../../lib/prisma.js';
import { recordAuditFromRequest } from '../../lib/audit.js';
import { createProblemDetails } from '../../lib/schemas/contracts.js';
import crypto from 'node:crypto';

const routes: FastifyPluginAsync = async (fastify) => {
  // GET /api/workspaces: List all workspaces current user belongs to
  fastify.get('/', async (request) => {
    const userId = (request as typeof request & { userId: string }).userId;
    const memberships = await prisma.workspaceMember.findMany({
      where: { userId },
      include: { workspace: true },
      orderBy: { createdAt: 'asc' },
    });
    return (memberships as Array<{ workspace: Record<string, unknown>; role: string }>).map(
      ({ workspace, role }) => ({ ...workspace, role })
    );
  });

  // POST /api/workspaces: Create new workspace and assign caller as OWNER
  fastify.post('/', async (request, reply) => {
    const userId = (request as typeof request & { userId: string }).userId;
    const body = request.body as { name?: string };
    const name = body?.name?.trim();
    if (!name || name.length > 80) {
      const problem = createProblemDetails({
        status: 400,
        title: 'Invalid Workspace Name',
        detail: 'O nome do workspace deve ter entre 1 e 80 caracteres.',
        instance: request.url,
        code: 'ERR_WORKSPACE_NAME_INVALID',
      });
      return reply.code(400).header('content-type', 'application/problem+json').send(problem);
    }

    const workspace = await prisma.workspace.create({
      data: {
        name,
        members: {
          create: { userId, role: 'OWNER' },
        },
      },
      include: { members: true },
    });

    await recordAuditFromRequest(request, {
      type: 'WORKSPACE_CREATED',
      entityId: workspace.id,
      entityTitle: workspace.name,
      status: 'ACTIVE',
      source: 'workspaces',
      workspaceId: workspace.id,
      details: { ownerUserId: userId },
    });

    return reply.code(201).send({ ...workspace, role: 'OWNER' });
  });

  // PATCH /api/workspaces/:id: Update workspace name (Requires OWNER or ADMIN)
  fastify.patch('/:id', async (request, reply) => {
    const userId = (request as typeof request & { userId: string }).userId;
    const params = request.params as { id: string };

    const member = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: params.id, userId } },
    });

    if (!member) {
      const problem = createProblemDetails({
        status: 403,
        title: 'Access Denied',
        detail: 'Você não possui acesso a este workspace.',
        instance: request.url,
        code: 'ERR_FORBIDDEN_WORKSPACE_ACCESS',
      });
      return reply.code(403).header('content-type', 'application/problem+json').send(problem);
    }

    if (member.role !== 'OWNER' && member.role !== 'ADMIN') {
      const problem = createProblemDetails({
        status: 403,
        title: 'Insufficient Permissions',
        detail: 'Somente administradores ou proprietários podem renomear o workspace.',
        instance: request.url,
        code: 'ERR_INSUFFICIENT_PERMISSIONS',
      });
      return reply.code(403).header('content-type', 'application/problem+json').send(problem);
    }

    const name = (request.body as { name?: string })?.name?.trim();
    if (!name || name.length > 80) {
      const problem = createProblemDetails({
        status: 400,
        title: 'Invalid Workspace Name',
        detail: 'O nome do workspace deve ter entre 1 e 80 caracteres.',
        instance: request.url,
        code: 'ERR_WORKSPACE_NAME_INVALID',
      });
      return reply.code(400).header('content-type', 'application/problem+json').send(problem);
    }

    const updated = await prisma.workspace.update({
      where: { id: params.id },
      data: { name },
    });

    await recordAuditFromRequest(request, {
      type: 'WORKSPACE_RENAMED',
      entityId: updated.id,
      entityTitle: updated.name,
      status: 'ACTIVE',
      source: 'workspaces',
      workspaceId: params.id,
      details: { newName: name },
    });

    return reply.send(updated);
  });

  // GET /api/workspaces/:id/members: List all members of a workspace
  fastify.get('/:id/members', async (request, reply) => {
    const userId = (request as typeof request & { userId: string }).userId;
    const params = request.params as { id: string };

    const membership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: params.id, userId } },
    });

    if (!membership) {
      const problem = createProblemDetails({
        status: 403,
        title: 'Access Denied',
        detail: 'Você não é membro deste workspace.',
        instance: request.url,
        code: 'ERR_FORBIDDEN_WORKSPACE_ACCESS',
      });
      return reply.code(403).header('content-type', 'application/problem+json').send(problem);
    }

    return prisma.workspaceMember.findMany({
      where: { workspaceId: params.id },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  });

  // POST /api/workspaces/:id/invitations: Invite member (Requires OWNER or ADMIN)
  fastify.post('/:id/invitations', async (request, reply) => {
    const userId = (request as typeof request & { userId: string }).userId;
    const params = request.params as { id: string };

    const membership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: params.id, userId } },
    });

    if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) {
      const problem = createProblemDetails({
        status: 403,
        title: 'Insufficient Permissions',
        detail: 'Permissão insuficiente para convidar membros para este workspace.',
        instance: request.url,
        code: 'ERR_INSUFFICIENT_PERMISSIONS',
      });
      return reply.code(403).header('content-type', 'application/problem+json').send(problem);
    }

    const body = request.body as { email?: string; role?: string };
    const email = body?.email?.trim().toLowerCase();
    const role = body?.role === 'ADMIN' ? 'ADMIN' : 'MEMBER';

    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      const problem = createProblemDetails({
        status: 400,
        title: 'Invalid Email',
        detail: 'Endereço de email inválido para convite.',
        instance: request.url,
        code: 'ERR_INVALID_EMAIL',
      });
      return reply.code(400).header('content-type', 'application/problem+json').send(problem);
    }

    const invitation = await prisma.workspaceInvitation.create({
      data: {
        workspaceId: params.id,
        email,
        role,
        token: crypto.randomBytes(24).toString('hex'),
        expiresAt: new Date(Date.now() + 7 * 86400000),
      },
    });

    await recordAuditFromRequest(request, {
      type: 'MEMBER_INVITED',
      entityId: invitation.id,
      entityTitle: email,
      status: 'INVITED',
      source: 'workspaces',
      workspaceId: params.id,
      details: { invitedEmail: email, role },
    });

    return reply.code(201).send({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
    });
  });

  // PATCH /api/workspaces/:id/members/:memberId: Change member role (Requires OWNER)
  fastify.patch('/:id/members/:memberId', async (request, reply) => {
    const userId = (request as typeof request & { userId: string }).userId;
    const params = request.params as { id: string; memberId: string };

    const membership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: params.id, userId } },
    });

    if (!membership || membership.role !== 'OWNER') {
      const problem = createProblemDetails({
        status: 403,
        title: 'Owner Permission Required',
        detail: 'Somente o proprietário do workspace pode alterar papéis de membros.',
        instance: request.url,
        code: 'ERR_INSUFFICIENT_PERMISSIONS',
      });
      return reply.code(403).header('content-type', 'application/problem+json').send(problem);
    }

    const role = (request.body as { role?: string })?.role;
    if (!role || !['ADMIN', 'MEMBER', 'OBSERVER'].includes(role)) {
      const problem = createProblemDetails({
        status: 400,
        title: 'Invalid Role',
        detail: "Papel inválido. Opções permitidas: 'ADMIN', 'MEMBER', 'OBSERVER'.",
        instance: request.url,
        code: 'ERR_INVALID_ROLE',
      });
      return reply.code(400).header('content-type', 'application/problem+json').send(problem);
    }

    const updatedMember = await prisma.workspaceMember.update({
      where: { id: params.memberId },
      data: { role },
    });

    await recordAuditFromRequest(request, {
      type: 'MEMBER_ROLE_CHANGED',
      entityId: updatedMember.id,
      entityTitle: `User ${updatedMember.userId}`,
      status: 'UPDATED',
      source: 'workspaces',
      workspaceId: params.id,
      details: { targetMemberId: params.memberId, newRole: role },
    });

    return reply.send(updatedMember);
  });
};

export default routes;
