import { z } from 'zod';
import prisma from '../../../lib/prisma.js';

export type ToolCategory = 'AUTO_EXECUTE' | 'REQUIRES_HUMAN_APPROVAL';

export interface ExecutionProposal {
  id: string;
  tool: string;
  category: ToolCategory;
  parameters: Record<string, any>;
  rationale: string;
  workspaceId: string;
  requestedBy: string;
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'EXECUTED';
  createdAt: string;
  executedAt?: string;
  executedBy?: string;
  result?: any;
}

// In-memory proposal storage with workspace isolation
const proposalsStore = new Map<string, ExecutionProposal>();

export function createExecutionProposal(input: {
  tool: string;
  parameters: Record<string, any>;
  rationale: string;
  workspaceId: string;
  requestedBy?: string;
}): ExecutionProposal {
  const proposal: ExecutionProposal = {
    id: `prop-${crypto.randomUUID()}`,
    tool: input.tool,
    category: 'REQUIRES_HUMAN_APPROVAL',
    parameters: input.parameters,
    rationale: input.rationale,
    workspaceId: input.workspaceId,
    requestedBy: input.requestedBy || 'xerebro-agent',
    status: 'PENDING_APPROVAL',
    createdAt: new Date().toISOString(),
  };
  proposalsStore.set(proposal.id, proposal);
  return proposal;
}

export function getExecutionProposal(id: string, workspaceId: string): ExecutionProposal | null {
  const proposal = proposalsStore.get(id);
  if (!proposal || proposal.workspaceId !== workspaceId) return null;
  return proposal;
}

export function listExecutionProposals(workspaceId: string): ExecutionProposal[] {
  return Array.from(proposalsStore.values())
    .filter((p) => p.workspaceId === workspaceId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function updateExecutionProposal(
  id: string,
  workspaceId: string,
  updates: Partial<ExecutionProposal>
): ExecutionProposal | null {
  const proposal = getExecutionProposal(id, workspaceId);
  if (!proposal) return null;
  const updated = { ...proposal, ...updates };
  proposalsStore.set(id, updated);
  return updated;
}

// =========================================================================
// OPERATIONAL AGENT TOOL DEFINITIONS & ZOD SCHEMAS
// =========================================================================

export const GetWorkspaceSummarySchema = z.object({});

export const SearchAuditLogsSchema = z.object({
  entityId: z.string().trim().optional(),
  type: z.string().trim().optional(),
  limit: z.number().int().min(1).max(50).default(15),
});

export const ProposeOperationalTaskSchema = z.object({
  title: z.string().trim().min(3, 'O título da tarefa deve ter pelo menos 3 caracteres').max(200),
  description: z.string().trim().max(2000).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  rationale: z.string().trim().min(5, 'A justificativa para a proposta é obrigatória'),
});

export const DraftPolicyDecisionSchema = z.object({
  action: z.string().trim().min(3, 'A ação deve ter pelo menos 3 caracteres').max(200),
  rationale: z.string().trim().min(10, 'A fundamentação técnica deve ter pelo menos 10 caracteres'),
  impact: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'),
  confidence: z.number().min(0.1).max(1.0).default(0.85),
});

export const QueryWorkspaceMembersSchema = z.object({});

export interface ToolExecutionContext {
  workspaceId: string;
  userId: string;
  userRole?: string;
}

export const agentTools = {
  // Read-only tool: inspect workspace status
  getWorkspaceSummary: {
    name: 'getWorkspaceSummary',
    description: 'Recupera métricas operacionais consolidadas do workspace ativo (tarefas, decisões e atividade recente).',
    category: 'AUTO_EXECUTE' as ToolCategory,
    schema: GetWorkspaceSummarySchema,
    execute: async (_params: z.infer<typeof GetWorkspaceSummarySchema>, ctx: ToolExecutionContext) => {
      const [tasks, decisions, recentAudit] = await Promise.all([
        prisma.task.groupBy({
          by: ['status'],
          where: { workspaceId: ctx.workspaceId },
          _count: { _all: true },
        }).catch(() => []),
        prisma.decisionLog.count({ where: { workspaceId: ctx.workspaceId } }).catch(() => 0),
        prisma.auditEvent.findMany({
          where: { workspaceId: ctx.workspaceId },
          orderBy: { createdAt: 'desc' },
          take: 5,
        }).catch(() => []),
      ]);

      return {
        workspaceId: ctx.workspaceId,
        tasksSummary: tasks,
        totalDecisions: decisions,
        recentActivity: recentAudit.map((a: any) => ({
          type: a.type,
          title: a.entityTitle,
          status: a.status,
          date: a.createdAt,
        })),
      };
    },
  },

  // Read-only tool: filter audit records
  searchAuditLogs: {
    name: 'searchAuditLogs',
    description: 'Consulta a trilha imutável de auditoria do workspace ativo filtrada por tipo ou entidade.',
    category: 'AUTO_EXECUTE' as ToolCategory,
    schema: SearchAuditLogsSchema,
    execute: async (params: z.infer<typeof SearchAuditLogsSchema>, ctx: ToolExecutionContext) => {
      const where: Record<string, any> = { workspaceId: ctx.workspaceId };
      if (params.entityId) where.entityId = params.entityId;
      if (params.type) where.type = params.type;

      const events = await prisma.auditEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: params.limit || 15,
      });

      return {
        count: events.length,
        events: events.map((e: any) => ({
          id: e.id,
          type: e.type,
          entityTitle: e.entityTitle,
          status: e.status,
          createdAt: e.createdAt,
          details: e.details,
        })),
      };
    },
  },

  // Read-only tool: inspect active members
  queryWorkspaceMembers: {
    name: 'queryWorkspaceMembers',
    description: 'Lista membros e permissões ativas no workspace.',
    category: 'AUTO_EXECUTE' as ToolCategory,
    schema: QueryWorkspaceMembersSchema,
    execute: async (_params: z.infer<typeof QueryWorkspaceMembersSchema>, ctx: ToolExecutionContext) => {
      const members = await prisma.workspaceMember.findMany({
        where: { workspaceId: ctx.workspaceId },
        include: { user: { select: { id: true, name: true, email: true } } },
      });
      return {
        members: members.map((m: any) => ({
          id: m.id,
          role: m.role,
          name: m.user?.name || 'Operador',
          email: m.user?.email,
        })),
      };
    },
  },

  // Mutating tool: requires human approval
  proposeOperationalTask: {
    name: 'proposeOperationalTask',
    description: 'Propõe uma nova tarefa operacional que requer aprovação de um operador humano (Admin/Owner) antes de ser criada.',
    category: 'REQUIRES_HUMAN_APPROVAL' as ToolCategory,
    schema: ProposeOperationalTaskSchema,
    execute: async (params: z.infer<typeof ProposeOperationalTaskSchema>, ctx: ToolExecutionContext) => {
      const proposal = createExecutionProposal({
        tool: 'proposeOperationalTask',
        parameters: {
          title: params.title,
          description: params.description,
          priority: params.priority,
        },
        rationale: params.rationale,
        workspaceId: ctx.workspaceId,
        requestedBy: 'xerebro-agent',
      });

      return {
        proposalId: proposal.id,
        status: 'PENDING_APPROVAL',
        tool: 'proposeOperationalTask',
        parameters: proposal.parameters,
        rationale: proposal.rationale,
        message: `Proposta de tarefa criada [${proposal.id}]. Requer confirmação de um Administrador para execução.`,
      };
    },
  },

  // Mutating tool: requires human approval
  draftPolicyDecision: {
    name: 'draftPolicyDecision',
    description: 'Elabora uma proposta de deliberação técnica/política que requer aprovação humana para ser registrada no ledger imutável.',
    category: 'REQUIRES_HUMAN_APPROVAL' as ToolCategory,
    schema: DraftPolicyDecisionSchema,
    execute: async (params: z.infer<typeof DraftPolicyDecisionSchema>, ctx: ToolExecutionContext) => {
      const proposal = createExecutionProposal({
        tool: 'draftPolicyDecision',
        parameters: {
          action: params.action,
          rationale: params.rationale,
          impact: params.impact,
          confidence: params.confidence,
        },
        rationale: params.rationale,
        workspaceId: ctx.workspaceId,
        requestedBy: 'xerebro-agent',
      });

      return {
        proposalId: proposal.id,
        status: 'PENDING_APPROVAL',
        tool: 'draftPolicyDecision',
        parameters: proposal.parameters,
        rationale: proposal.rationale,
        message: `Proposta de deliberação criada [${proposal.id}]. Requer confirmação de um Administrador para registro.`,
      };
    },
  },
};
