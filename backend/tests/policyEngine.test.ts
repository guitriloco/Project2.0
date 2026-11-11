import { describe, it, expect, beforeEach } from 'vitest';
import {
  initializeWorkspaceBreakers,
  getWorkspaceCircuitBreakers,
  getCircuitBreaker,
  isCircuitBreakerTripped,
  tripCircuitBreaker,
  resetCircuitBreaker,
  recordFailureAndEvaluateAutoTrip,
  evaluateAndExecutePolicies,
  getWorkspacePolicyExecutions,
} from '../src/lib/policyEngine.js';
import { verifyChainIntegrity } from '../src/lib/auditChain.js';

describe('Sovereign Policy Engine & Circuit Breakers (Cycle 2 / Axis 3)', () => {
  const workspaceId = `test-policy-ws-${Date.now()}`;

  beforeEach(() => {
    initializeWorkspaceBreakers(workspaceId);
  });

  it('initializes default circuit breakers in CLOSED state', () => {
    const breakers = getWorkspaceCircuitBreakers(workspaceId);
    expect(breakers).toHaveLength(4);

    const subsystems = breakers.map((b) => b.id);
    expect(subsystems).toContain('GLOBAL_SYSTEM_FREEZE');
    expect(subsystems).toContain('OUTBOUND_WEBHOOK_KILL');
    expect(subsystems).toContain('AGENT_AUTONOMY_KILL');
    expect(subsystems).toContain('GOVERNANCE_MUTATION_LOCK');

    for (const b of breakers) {
      expect(b.state).toBe('CLOSED');
      expect(b.tripCount).toBe(0);
    }
  });

  it('trips a circuit breaker, increments count, and records audit block', () => {
    const breaker = tripCircuitBreaker(
      workspaceId,
      'OUTBOUND_WEBHOOK_KILL',
      'operator-001',
      'OWNER',
      'Vazamento anômalo detectado em endpoint externo'
    );

    expect(breaker.state).toBe('OPEN');
    expect(breaker.tripCount).toBe(1);
    expect(breaker.tripReason).toContain('Vazamento anômalo');
    expect(breaker.trippedBy).toBe('operator-001');

    const check = isCircuitBreakerTripped(workspaceId, 'OUTBOUND_WEBHOOK_KILL');
    expect(check.tripped).toBe(true);
    expect(check.reason).toContain('Vazamento anômalo');

    // Cryptographic chain verification
    const verification = verifyChainIntegrity(workspaceId);
    expect(verification.isValid).toBe(true);
    expect(verification.totalBlocks).toBeGreaterThan(0);
  });

  it('supersedes all subsystems when GLOBAL_SYSTEM_FREEZE is tripped', () => {
    // Subsystem breaker is closed
    expect(isCircuitBreakerTripped(workspaceId, 'AGENT_AUTONOMY_KILL').tripped).toBe(false);

    // Trip global freeze
    tripCircuitBreaker(
      workspaceId,
      'GLOBAL_SYSTEM_FREEZE',
      'operator-owner',
      'OWNER',
      'Ataque de negação de serviço em andamento'
    );

    // Now all other subsystems report tripped
    const agentCheck = isCircuitBreakerTripped(workspaceId, 'AGENT_AUTONOMY_KILL');
    expect(agentCheck.tripped).toBe(true);
    expect(agentCheck.reason).toContain('Quarentena Soberana Global');

    const webhookCheck = isCircuitBreakerTripped(workspaceId, 'OUTBOUND_WEBHOOK_KILL');
    expect(webhookCheck.tripped).toBe(true);
  });

  it('resets a circuit breaker back to CLOSED state', () => {
    const reset = resetCircuitBreaker(
      workspaceId,
      'OUTBOUND_WEBHOOK_KILL',
      'operator-owner',
      'OWNER'
    );

    expect(reset.state).toBe('CLOSED');
    expect(isCircuitBreakerTripped(workspaceId, 'OUTBOUND_WEBHOOK_KILL').tripped).toBe(true); // Still blocked by GLOBAL_SYSTEM_FREEZE
    
    // Reset global freeze too
    resetCircuitBreaker(workspaceId, 'GLOBAL_SYSTEM_FREEZE', 'operator-owner', 'OWNER');
    expect(isCircuitBreakerTripped(workspaceId, 'OUTBOUND_WEBHOOK_KILL').tripped).toBe(false);

    const verification = verifyChainIntegrity(workspaceId);
    expect(verification.isValid).toBe(true);
  });

  it('auto-trips circuit breaker when consecutive failure threshold is exceeded', () => {
    const autoWs = `auto-ws-${Date.now()}`;
    initializeWorkspaceBreakers(autoWs);

    // Threshold is 5 failures
    for (let i = 0; i < 4; i++) {
      const tripped = recordFailureAndEvaluateAutoTrip(
        autoWs,
        'OUTBOUND_WEBHOOK_KILL',
        `Network error ${i}`
      );
      expect(tripped).toBe(false);
    }

    // 5th failure should trigger auto-trip
    const tripped = recordFailureAndEvaluateAutoTrip(
      autoWs,
      'OUTBOUND_WEBHOOK_KILL',
      'Fatal 504 Gateway Timeout'
    );
    expect(tripped).toBe(true);

    const breaker = getCircuitBreaker(autoWs, 'OUTBOUND_WEBHOOK_KILL');
    expect(breaker.state).toBe('OPEN');
    expect(breaker.tripReason).toContain('Auto-acionamento: 5 falhas consecutivas');
  });

  it('evaluates and executes policies on DECISION_RATIFIED, generating tasks and receipts', async () => {
    const policyWs = `pol-exec-ws-${Date.now()}`;
    initializeWorkspaceBreakers(policyWs);

    const receipts = await evaluateAndExecutePolicies(policyWs, {
      type: 'DECISION_RATIFIED',
      entityId: 'dec-1001',
      entityData: {
        action: 'DECRETO_EXPANSAO_SUB_KERNEL',
        impact: 'HIGH',
        rationale: 'Quórum estrito atingido com 6 votos ponderados.',
      },
    });

    expect(receipts.length).toBeGreaterThan(0);
    const taskReceipt = receipts.find((r) => r.policyName.includes('Despacho Automatizado'));
    expect(taskReceipt).toBeDefined();
    expect(taskReceipt!.status).toBe('EXECUTED');
    expect(taskReceipt!.executionResult.taskId).toBeDefined();
    expect(taskReceipt!.cryptographicProofHash).toBeDefined();

    const stored = getWorkspacePolicyExecutions(policyWs);
    expect(stored.length).toBeGreaterThan(0);

    const verification = verifyChainIntegrity(policyWs);
    expect(verification.isValid).toBe(true);
  });

  it('blocks policy execution when GLOBAL_SYSTEM_FREEZE is active', async () => {
    const freezeWs = `pol-freeze-ws-${Date.now()}`;
    initializeWorkspaceBreakers(freezeWs);

    tripCircuitBreaker(
      freezeWs,
      'GLOBAL_SYSTEM_FREEZE',
      'sec-officer',
      'OWNER',
      'Contenção total preventiva'
    );

    const receipts = await evaluateAndExecutePolicies(freezeWs, {
      type: 'DECISION_RATIFIED',
      entityId: 'dec-9999',
      entityData: { action: 'ACAO_EMERGENCIA' },
    });

    for (const r of receipts) {
      expect(r.status).toBe('BLOCKED_BY_CIRCUIT_BREAKER');
    }
  });
});
