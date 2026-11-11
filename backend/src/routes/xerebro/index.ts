import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import prisma from '../../lib/prisma.js';
import { withWorkspaceContext } from '../../lib/workspace.js';
import { requireWorkspaceViewer, requireWorkspaceAdmin } from '../../lib/rbac.js';
import { rateLimit } from '../../lib/rate-limiter.js';
import { recordAuditFromRequest } from '../../lib/audit.js';
import { workspaceEventBus } from '../../lib/events.js';
import {
  listExecutionProposals,
  getExecutionProposal,
  updateExecutionProposal,
} from '../../modules/xerebro/tools/registry.js';
import { xerebroOrchestrator } from '../../modules/xerebro/orchestrator.js';
import { createProblemDetails } from '../../lib/schemas/contracts.js';

const chatRequestSchema = z.object({
  conversationId: z.string().uuid().nullable().optional(),
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant', 'system']),
        content: z.string().min(1).max(20000),
      })
    )
    .min(1)
    .max(100),
});

const xerebroRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/xerebro/proposals: List pending human-in-the-loop proposals for active workspace
  fastify.get(
    '/proposals',
    {
      preHandler: [withWorkspaceContext, requireWorkspaceViewer],
    },
    async (request) => {
      const workspaceId = request.workspace!.id;
      return listExecutionProposals(workspaceId);
    }
  );

  // POST /api/xerebro/proposals/:id/execute: Operator sign-off and execution (Requires ADMIN or OWNER)
  fastify.post(
    '/proposals/:id/execute',
    {
      preHandler: [
        withWorkspaceContext,
        requireWorkspaceAdmin,
        rateLimit({ max: 30, windowMs: 60000 }),
      ],
    },
    async (request, reply) => {
      const params = request.params as { id: string };
      const workspaceId = request.workspace!.id;
      const proposal = getExecutionProposal(params.id, workspaceId);

      if (!proposal) {
        const problem = createProblemDetails({
          status: 404,
          title: 'Proposal Not Found',
          detail: `Proposta de execução '${params.id}' não foi encontrada no workspace ativo.`,
          instance: request.url,
          code: 'ERR_PROPOSAL_NOT_FOUND',
        });
        return reply.code(404).header('content-type', 'application/problem+json').send(problem);
      }

      if (proposal.status !== 'PENDING_APPROVAL') {
        const problem = createProblemDetails({
          status: 400,
          title: 'Invalid Proposal State',
          detail: `Proposta já foi processada anteriormente com status: '${proposal.status}'.`,
          instance: request.url,
          code: 'ERR_PROPOSAL_ALREADY_PROCESSED',
        });
        return reply.code(400).header('content-type', 'application/problem+json').send(problem);
      }

      try {
        let executionResult: any = null;

        if (proposal.tool === 'proposeOperationalTask') {
          const { title, description, priority } = proposal.parameters;
          const task = await prisma.task.create({
            data: {
              title,
              description: description || null,
              status: 'PENDING',
              workspaceId,
            },
          });

          await recordAuditFromRequest(request, {
            type: 'XEREBRO_AGENT_EXECUTION',
            entityId: task.id,
            entityTitle: task.title,
            status: 'EXECUTED_BY_OPERATOR',
            source: 'xerebro-hitl',
            details: {
              proposalId: proposal.id,
              tool: proposal.tool,
              priority,
              rationale: proposal.rationale,
              operatorUserId: request.userId,
            },
          });

          workspaceEventBus.publish(workspaceId, 'task:created', task);
          executionResult = task;
        } else if (proposal.tool === 'draftPolicyDecision') {
          const { action, rationale, impact, confidence } = proposal.parameters;
          const decision = await prisma.decisionLog.create({
            data: {
              action,
              rationale,
              impact: impact || 'MEDIUM',
              confidence: confidence ?? 0.85,
              status: 'APPROVED',
              workspaceId,
            },
          });

          await recordAuditFromRequest(request, {
            type: 'XEREBRO_AGENT_EXECUTION',
            entityId: decision.id,
            entityTitle: decision.action,
            status: 'EXECUTED_BY_OPERATOR',
            source: 'xerebro-hitl',
            details: {
              proposalId: proposal.id,
              tool: proposal.tool,
              rationale: proposal.rationale,
              operatorUserId: request.userId,
            },
          });

          workspaceEventBus.publish(workspaceId, 'decision:logged', decision);
          executionResult = decision;
        } else {
          throw new Error(`Tool desconhecida para execução: '${proposal.tool}'`);
        }

        const updatedProposal = updateExecutionProposal(proposal.id, workspaceId, {
          status: 'EXECUTED',
          executedAt: new Date().toISOString(),
          executedBy: request.userId,
          result: executionResult,
        });

        return reply.send({
          ok: true,
          proposal: updatedProposal,
          result: executionResult,
        });
      } catch (err: any) {
        const problem = createProblemDetails({
          status: 500,
          title: 'Proposal Execution Failed',
          detail: err?.message || 'Falha ao executar ação aprovada pelo operador.',
          instance: request.url,
          code: 'ERR_PROPOSAL_EXECUTION',
        });
        return reply.code(500).header('content-type', 'application/problem+json').send(problem);
      }
    }
  );

  // POST /api/xerebro/proposals/:id/reject: Operator rejection (Requires ADMIN or OWNER)
  fastify.post(
    '/proposals/:id/reject',
    {
      preHandler: [
        withWorkspaceContext,
        requireWorkspaceAdmin,
        rateLimit({ max: 30, windowMs: 60000 }),
      ],
    },
    async (request, reply) => {
      const params = request.params as { id: string };
      const workspaceId = request.workspace!.id;
      const proposal = getExecutionProposal(params.id, workspaceId);

      if (!proposal) {
        const problem = createProblemDetails({
          status: 404,
          title: 'Proposal Not Found',
          detail: `Proposta de execução '${params.id}' não foi encontrada no workspace ativo.`,
          instance: request.url,
          code: 'ERR_PROPOSAL_NOT_FOUND',
        });
        return reply.code(404).header('content-type', 'application/problem+json').send(problem);
      }

      const updated = updateExecutionProposal(proposal.id, workspaceId, {
        status: 'REJECTED',
        executedAt: new Date().toISOString(),
        executedBy: request.userId,
      });

      await recordAuditFromRequest(request, {
        type: 'AGENT_PROPOSAL_REJECTED',
        entityId: proposal.id,
        entityTitle: `Proposta rejeitada: ${proposal.tool}`,
        status: 'REJECTED_BY_OPERATOR',
        source: 'xerebro-hitl',
        details: {
          proposalId: proposal.id,
          tool: proposal.tool,
          rejectedBy: request.userId,
        },
      });

      return reply.send({ ok: true, proposal: updated });
    }
  );

  // POST /api/xerebro/chat: Agent deliberation with operational RAG
  fastify.post(
    '/chat',
    {
      preHandler: [withWorkspaceContext, requireWorkspaceViewer],
    },
    async (request, reply) => {
      const parsed = chatRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        const problem = createProblemDetails({
          status: 400,
          title: 'Invalid Chat Payload',
          detail: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
          instance: request.url,
          code: 'ERR_CHAT_VALIDATION',
        });
        return reply.code(400).header('content-type', 'application/problem+json').send(problem);
      }

      const { conversationId, messages } = parsed.data;
      const userId = request.userId!;
      const workspace = request.workspace!;

      // Retrieve or create conversation
      const conversation = conversationId
        ? await prisma.xerebroConversation.findFirst({ where: { id: conversationId, userId } })
        : await prisma.xerebroConversation.create({
            data: {
              userId,
              title: messages.find((m) => m.role === 'user')?.content.slice(0, 80) ?? 'Novo contexto',
            },
          });

      if (!conversation) {
        const problem = createProblemDetails({
          status: 404,
          title: 'Conversation Not Found',
          detail: 'A conversa solicitada não foi localizada.',
          instance: request.url,
          code: 'ERR_CONVERSATION_NOT_FOUND',
        });
        return reply.code(404).header('content-type', 'application/problem+json').send(problem);
      }

      // Persist user messages
      const persistedCount = await prisma.xerebroMessage.count({
        where: { conversationId: conversation.id },
      });
      const newMessages = messages.slice(persistedCount);
      if (newMessages.length) {
        await prisma.xerebroMessage.createMany({
          data: newMessages.map((m) => ({
            conversationId: conversation.id,
            role: m.role,
            content: m.content,
          })),
        });
      }

      // Execute agent reasoning with workspace RAG context
      const response = await xerebroOrchestrator.chatWithContext(messages as any, {
        workspaceId: workspace.id,
        workspaceName: workspace.workspaceName || 'Core Workspace',
        userId,
        userRole: workspace.role,
      });

      // Persist assistant message
      await prisma.xerebroMessage.create({
        data: {
          conversationId: conversation.id,
          role: 'assistant',
          content: response.text,
        },
      });

      await prisma.xerebroConversation.update({
        where: { id: conversation.id },
        data: { updatedAt: new Date() },
      });

      // Include any pending proposals generated in this turn
      const currentProposals = listExecutionProposals(workspace.id);

      return reply.send({
        ...response,
        conversationId: conversation.id,
        proposals: currentProposals,
      });
    }
  );
};

export default xerebroRoutes;
