import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  agentTools,
  ProposeOperationalTaskSchema,
  DraftPolicyDecisionSchema,
  createExecutionProposal,
  getExecutionProposal,
  listExecutionProposals,
  updateExecutionProposal,
} from '../src/modules/xerebro/tools/registry.js';
import prisma from '../src/lib/prisma.js';

describe('Xerebro Autonomous Agent & HITL Tool Execution Engine', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('validates tool parameter schemas strictly with Zod', () => {
    // Valid task proposal
    const validTask = {
      title: 'Otimizar pool de conexões do Neon',
      description: 'Aumentar connection pool size para 30 em horários de pico.',
      priority: 'HIGH' as const,
      rationale: 'Latência média de queries aumentou 15% nos últimos 10 minutos.',
    };
    expect(ProposeOperationalTaskSchema.safeParse(validTask).success).toBe(true);

    // Invalid task proposal: title too short, missing rationale
    expect(
      ProposeOperationalTaskSchema.safeParse({
        title: 'AB',
        priority: 'HIGH',
      }).success
    ).toBe(false);

    // Valid policy decision
    const validDecision = {
      action: 'Adotar políticas de rate limiting por IP/Workspace',
      rationale: 'Prevenção de exaustão de requisições no endpoint de chat e streaming SSE.',
      impact: 'HIGH' as const,
      confidence: 0.9,
    };
    expect(DraftPolicyDecisionSchema.safeParse(validDecision).success).toBe(true);

    // Invalid policy decision: confidence out of bounds
    expect(
      DraftPolicyDecisionSchema.safeParse({
        action: 'Ação válida de teste',
        rationale: 'Fundamentação com mais de dez caracteres',
        confidence: 1.5,
      }).success
    ).toBe(false);
  });

  it('classifies read-only tools as AUTO_EXECUTE and mutation tools as REQUIRES_HUMAN_APPROVAL', () => {
    expect(agentTools.getWorkspaceSummary.category).toBe('AUTO_EXECUTE');
    expect(agentTools.searchAuditLogs.category).toBe('AUTO_EXECUTE');
    expect(agentTools.queryWorkspaceMembers.category).toBe('AUTO_EXECUTE');

    expect(agentTools.proposeOperationalTask.category).toBe('REQUIRES_HUMAN_APPROVAL');
    expect(agentTools.draftPolicyDecision.category).toBe('REQUIRES_HUMAN_APPROVAL');
  });

  it('creates execution proposal in PENDING_APPROVAL status instead of immediate DB mutation', async () => {
    const ctx = {
      workspaceId: 'ws-hitl-alpha',
      userId: 'agent-operator-1',
    };

    const result = await agentTools.proposeOperationalTask.execute(
      {
        title: 'Renovar certificados TLS do gateway',
        description: 'Automação via cert-manager',
        priority: 'CRITICAL',
        rationale: 'Certificados expiram em menos de 72 horas.',
      },
      ctx
    );

    expect(result.status).toBe('PENDING_APPROVAL');
    expect(result.proposalId).toBeDefined();
    expect(result.parameters.title).toBe('Renovar certificados TLS do gateway');

    const stored = getExecutionProposal(result.proposalId, 'ws-hitl-alpha');
    expect(stored).not.toBeNull();
    expect(stored?.status).toBe('PENDING_APPROVAL');
    expect(stored?.parameters.priority).toBe('CRITICAL');
  });

  it('enforces strict tenant isolation on execution proposals', () => {
    const ws1 = 'ws-tenant-alpha-9';
    const ws2 = 'ws-tenant-beta-8';

    const p1 = createExecutionProposal({
      tool: 'proposeOperationalTask',
      parameters: { title: 'Tarefa Alpha Confidencial' },
      rationale: 'Apenas para tenant Alpha',
      workspaceId: ws1,
    });

    // p1 exists in Alpha
    expect(getExecutionProposal(p1.id, ws1)).not.toBeNull();

    // p1 MUST NOT be accessible from Beta
    expect(getExecutionProposal(p1.id, ws2)).toBeNull();

    const listBeta = listExecutionProposals(ws2);
    expect(listBeta.some((p) => p.id === p1.id)).toBe(false);
  });

  it('updates proposal lifecycle from PENDING_APPROVAL to EXECUTED upon operator sign-off', () => {
    const ws = 'ws-lifecycle-test';
    const proposal = createExecutionProposal({
      tool: 'draftPolicyDecision',
      parameters: { action: 'Migrar para arquitetura de microsserviços' },
      rationale: 'Isolamento de gargalos de processamento',
      workspaceId: ws,
    });

    expect(proposal.status).toBe('PENDING_APPROVAL');

    const updated = updateExecutionProposal(proposal.id, ws, {
      status: 'EXECUTED',
      executedAt: new Date().toISOString(),
      executedBy: 'operator-admin-uuid',
      result: { id: 'task-created-real' },
    });

    expect(updated?.status).toBe('EXECUTED');
    expect(updated?.executedBy).toBe('operator-admin-uuid');
    expect(updated?.result.id).toBe('task-created-real');
  });
});
