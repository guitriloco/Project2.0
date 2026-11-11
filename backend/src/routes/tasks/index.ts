import type { FastifyPluginAsync } from 'fastify';
import prisma from '../../lib/prisma.js';
import { recordAuditFromRequest } from '../../lib/audit.js';
import { withWorkspaceContext } from '../../lib/workspace.js';
import { workspaceEventBus } from '../../lib/events.js';
import {
  requireWorkspaceViewer,
  requireWorkspaceMember,
  requireWorkspaceAdmin,
} from '../../lib/rbac.js';
import { rateLimit } from '../../lib/rate-limiter.js';
import {
  CreateTaskSchema,
  UpdateTaskStatusSchema,
  createProblemDetails,
} from '../../lib/schemas/contracts.js';
import { isCircuitBreakerTripped } from '../../lib/policyEngine.js';

const taskRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/tasks: List all tasks scoped strictly to active workspace
  fastify.get(
    '/',
    {
      preHandler: [withWorkspaceContext, requireWorkspaceViewer],
    },
    async (request, reply) => {
      try {
        const workspaceId = request.workspace!.id;
        return await prisma.task.findMany({
          where: { workspaceId },
          orderBy: { updatedAt: 'desc' },
        });
      } catch (err: any) {
        const problem = createProblemDetails({
          status: 500,
          title: 'Error Fetching Tasks',
          detail: err?.message || 'Não foi possível listar as tarefas.',
          instance: request.url,
          code: 'ERR_TASKS_FETCH',
        });
        return reply.code(500).header('content-type', 'application/problem+json').send(problem);
      }
    }
  );

  // POST /api/tasks: Create a task in active workspace (Requires MEMBER+)
  fastify.post(
    '/',
    {
      preHandler: [
        withWorkspaceContext,
        requireWorkspaceMember,
        rateLimit({ max: 60, windowMs: 60000 }),
      ],
    },
    async (request, reply) => {
      const parsed = CreateTaskSchema.safeParse(request.body);
      if (!parsed.success) {
        const problem = createProblemDetails({
          status: 400,
          title: 'Invalid Task Payload',
          detail: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
          instance: request.url,
          code: 'ERR_TASK_VALIDATION',
          invalidParams: parsed.error.issues.map((i) => ({ name: i.path.join('.'), reason: i.message })),
        });
        return reply.code(400).header('content-type', 'application/problem+json').send(problem);
      }

      try {
        // Enforce strict workspace scoping: disregard untrusted workspaceId in body
        const workspaceId = request.workspace!.id;

        const breakerCheck = isCircuitBreakerTripped(workspaceId, 'GLOBAL_SYSTEM_FREEZE');
        if (breakerCheck.tripped) {
          const problem = createProblemDetails({
            status: 503,
            title: 'Service Blocked By Circuit Breaker',
            detail: breakerCheck.reason || 'Criação de tarefas bloqueada por Quarentena Global.',
            instance: request.url,
            code: 'ERR_CIRCUIT_BREAKER_OPEN',
          });
          return reply.code(503).header('content-type', 'application/problem+json').send(problem);
        }
        const task = await prisma.task.create({
          data: {
            title: parsed.data.title,
            description: parsed.data.description,
            status: parsed.data.status,
            workspaceId,
          },
        });

        await recordAuditFromRequest(request, {
          type: 'TASK_CREATED',
          entityId: task.id,
          entityTitle: task.title,
          status: task.status,
          source: 'tasks',
          details: { description: task.description, status: task.status },
        });

        workspaceEventBus.publish(workspaceId, 'task:created', task);

        return reply.code(201).send(task);
      } catch (err: any) {
        const problem = createProblemDetails({
          status: 500,
          title: 'Task Creation Failed',
          detail: err?.message || 'Falha ao persistir tarefa no banco de dados.',
          instance: request.url,
          code: 'ERR_TASK_CREATE',
        });
        return reply.code(500).header('content-type', 'application/problem+json').send(problem);
      }
    }
  );

  // PATCH /api/tasks/:id: Update task status/content in active workspace (Requires MEMBER+)
  fastify.patch(
    '/:id',
    {
      preHandler: [
        withWorkspaceContext,
        requireWorkspaceMember,
        rateLimit({ max: 120, windowMs: 60000 }),
      ],
    },
    async (request, reply) => {
      const params = request.params as { id?: string };
      if (!params.id || typeof params.id !== 'string') {
        const problem = createProblemDetails({
          status: 400,
          title: 'Invalid Task ID',
          detail: 'O parâmetro id é obrigatório.',
          instance: request.url,
          code: 'ERR_TASK_ID_REQUIRED',
        });
        return reply.code(400).header('content-type', 'application/problem+json').send(problem);
      }

      const parsed = UpdateTaskStatusSchema.safeParse(request.body);
      if (!parsed.success) {
        const problem = createProblemDetails({
          status: 400,
          title: 'Invalid Task Update Payload',
          detail: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
          instance: request.url,
          code: 'ERR_TASK_UPDATE_VALIDATION',
          invalidParams: parsed.error.issues.map((i) => ({ name: i.path.join('.'), reason: i.message })),
        });
        return reply.code(400).header('content-type', 'application/problem+json').send(problem);
      }

      try {
        const workspaceId = request.workspace!.id;
        const existing = await prisma.task.findFirst({
          where: { id: params.id, workspaceId },
        });

        if (!existing) {
          const problem = createProblemDetails({
            status: 404,
            title: 'Task Not Found',
            detail: `Tarefa com id '${params.id}' não foi encontrada no workspace ativo.`,
            instance: request.url,
            code: 'ERR_TASK_NOT_FOUND',
          });
          return reply.code(404).header('content-type', 'application/problem+json').send(problem);
        }

        const updateData: Record<string, any> = {};
        if (parsed.data.title !== undefined) updateData.title = parsed.data.title;
        if (parsed.data.description !== undefined) updateData.description = parsed.data.description;
        if (parsed.data.status !== undefined) updateData.status = parsed.data.status;

        const task = await prisma.task.update({
          where: { id: params.id },
          data: updateData,
        });

        await recordAuditFromRequest(request, {
          type: parsed.data.status === 'COMPLETED' ? 'TASK_COMPLETED' : 'TASK_UPDATED',
          entityId: task.id,
          entityTitle: task.title,
          status: task.status,
          source: 'tasks',
          details: { ...parsed.data, previousStatus: existing.status },
        });

        workspaceEventBus.publish(workspaceId, 'task:updated', task);

        return reply.send(task);
      } catch (err: any) {
        const problem = createProblemDetails({
          status: 500,
          title: 'Task Update Failed',
          detail: err?.message || 'Falha ao atualizar tarefa.',
          instance: request.url,
          code: 'ERR_TASK_UPDATE',
        });
        return reply.code(500).header('content-type', 'application/problem+json').send(problem);
      }
    }
  );

  // DELETE /api/tasks/:id: Delete task in active workspace (Strictly Requires ADMIN or OWNER)
  fastify.delete(
    '/:id',
    {
      preHandler: [
        withWorkspaceContext,
        requireWorkspaceAdmin,
        rateLimit({ max: 30, windowMs: 60000 }),
      ],
    },
    async (request, reply) => {
      const params = request.params as { id?: string };
      if (!params.id || typeof params.id !== 'string') {
        const problem = createProblemDetails({
          status: 400,
          title: 'Invalid Task ID',
          detail: 'O parâmetro id é obrigatório.',
          instance: request.url,
          code: 'ERR_TASK_ID_REQUIRED',
        });
        return reply.code(400).header('content-type', 'application/problem+json').send(problem);
      }

      try {
        const workspaceId = request.workspace!.id;
        const existing = await prisma.task.findFirst({
          where: { id: params.id, workspaceId },
        });

        if (!existing) {
          const problem = createProblemDetails({
            status: 404,
            title: 'Task Not Found',
            detail: `Tarefa '${params.id}' não encontrada no workspace ativo para exclusão.`,
            instance: request.url,
            code: 'ERR_TASK_NOT_FOUND',
          });
          return reply.code(404).header('content-type', 'application/problem+json').send(problem);
        }

        await prisma.task.delete({
          where: { id: params.id },
        });

        await recordAuditFromRequest(request, {
          type: 'TASK_DELETED',
          entityId: params.id,
          entityTitle: existing.title,
          status: 'DELETED',
          source: 'tasks',
          details: { deletedBy: request.userId, title: existing.title },
        });

        workspaceEventBus.publish(workspaceId, 'task:deleted', { taskId: params.id });

        return reply.send({ ok: true, deletedId: params.id });
      } catch (err: any) {
        const problem = createProblemDetails({
          status: 500,
          title: 'Task Deletion Failed',
          detail: err?.message || 'Falha ao excluir tarefa.',
          instance: request.url,
          code: 'ERR_TASK_DELETE',
        });
        return reply.code(500).header('content-type', 'application/problem+json').send(problem);
      }
    }
  );
};

export default taskRoutes;
