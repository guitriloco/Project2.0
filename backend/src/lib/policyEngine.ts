import crypto from 'node:crypto';
import prisma from './prisma.js';
import { asJson } from './json.js';
import { workspaceEventBus } from './events.js';
import { appendAuditBlock, calculatePayloadHash } from './auditChain.js';

export type CircuitBreakerSubsystem =
  | 'GLOBAL_SYSTEM_FREEZE'
  | 'OUTBOUND_WEBHOOK_KILL'
  | 'AGENT_AUTONOMY_KILL'
  | 'GOVERNANCE_MUTATION_LOCK';

export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreaker {
  id: CircuitBreakerSubsystem;
  workspaceId: string;
  name: string;
  description: string;
  state: CircuitBreakerState;
  trippedAt?: string;
  trippedBy?: string;
  tripReason?: string;
  resetAt?: string;
  resetBy?: string;
  tripCount: number;
  autoTripConfig: {
    enabled: boolean;
    consecutiveFailuresThreshold: number;
    windowSeconds: number;
  };
  recentFailures: Array<{ timestamp: string; reason: string }>;
}

export interface PolicyRule {
  id: string;
  workspaceId: string;
  name: string;
  trigger: 'DECISION_RATIFIED' | 'INCIDENT_DETECTED' | 'MANUAL';
  actionType: 'DISPATCH_TASK' | 'RATE_LIMIT_ADAPT' | 'QUORUM_ELEVATION' | 'CIRCUIT_BREAKER_ARM';
  config: Record<string, any>;
  enabled: boolean;
}

export interface PolicyExecutionReceipt {
  id: string;
  workspaceId: string;
  policyId: string;
  policyName: string;
  triggerEntityId: string;
  triggerEntityType: string;
  status: 'EXECUTED' | 'BLOCKED_BY_CIRCUIT_BREAKER' | 'FAILED';
  executionResult: Record<string, any>;
  durationMs: number;
  executedAt: string;
  cryptographicProofHash?: string;
}

// In-memory multi-tenant storage: workspaceId -> Map<CircuitBreakerSubsystem, CircuitBreaker>
const workspaceBreakers = new Map<string, Map<CircuitBreakerSubsystem, CircuitBreaker>>();

// In-memory execution receipts storage: workspaceId -> PolicyExecutionReceipt[]
const workspaceExecutions = new Map<string, PolicyExecutionReceipt[]>();

// In-memory policy rules: workspaceId -> PolicyRule[]
const workspacePolicies = new Map<string, PolicyRule[]>();

const DEFAULT_DEFINITIONS: Array<{
  id: CircuitBreakerSubsystem;
  name: string;
  description: string;
  threshold: number;
}> = [
  {
    id: 'GLOBAL_SYSTEM_FREEZE',
    name: 'Quarentena Soberana Global',
    description: 'Bloqueio total de emergência. Congela despacho de tarefas, agentes autônomos e requisições de governança.',
    threshold: 10,
  },
  {
    id: 'OUTBOUND_WEBHOOK_KILL',
    name: 'Kill-Switch de Webhooks Externos',
    description: 'Interrompe imediatamente qualquer tráfego HTTP de saída de webhooks para evitar vazamentos ou tempestades de erro.',
    threshold: 5,
  },
  {
    id: 'AGENT_AUTONOMY_KILL',
    name: 'Kill-Switch de Autonomia de Agentes',
    description: 'Desativa o despachador autônomo de agentes Xerebro, forçando supervisão humana estrita para toda execução.',
    threshold: 5,
  },
  {
    id: 'GOVERNANCE_MUTATION_LOCK',
    name: 'Trava de Mutação de Governança',
    description: 'Impede criação e votação de novas propostas e decisões durante investigações ou auditorias críticas.',
    threshold: 8,
  },
];

/**
 * Initializes default breakers for a workspace if not already present
 */
export function initializeWorkspaceBreakers(workspaceId: string): Map<CircuitBreakerSubsystem, CircuitBreaker> {
  let breakersMap = workspaceBreakers.get(workspaceId);
  if (!breakersMap) {
    breakersMap = new Map();
    for (const def of DEFAULT_DEFINITIONS) {
      breakersMap.set(def.id, {
        id: def.id,
        workspaceId,
        name: def.name,
        description: def.description,
        state: 'CLOSED',
        tripCount: 0,
        autoTripConfig: {
          enabled: true,
          consecutiveFailuresThreshold: def.threshold,
          windowSeconds: 60,
        },
        recentFailures: [],
      });
    }
    workspaceBreakers.set(workspaceId, breakersMap);
  }
  return breakersMap;
}

/**
 * Get all circuit breakers for a given workspace
 */
export function getWorkspaceCircuitBreakers(workspaceId: string): CircuitBreaker[] {
  const map = initializeWorkspaceBreakers(workspaceId);
  return Array.from(map.values());
}

/**
 * Get a specific circuit breaker
 */
export function getCircuitBreaker(
  workspaceId: string,
  subsystem: CircuitBreakerSubsystem
): CircuitBreaker {
  const map = initializeWorkspaceBreakers(workspaceId);
  return map.get(subsystem)!;
}

/**
 * Checks if a specific subsystem or global freeze is active
 */
export function isCircuitBreakerTripped(
  workspaceId: string,
  subsystem: CircuitBreakerSubsystem
): { tripped: boolean; breaker?: CircuitBreaker; reason?: string } {
  const map = initializeWorkspaceBreakers(workspaceId);

  // If Global Freeze is open and not checking Global Freeze itself, it supersedes all
  if (subsystem !== 'GLOBAL_SYSTEM_FREEZE') {
    const globalFreeze = map.get('GLOBAL_SYSTEM_FREEZE');
    if (globalFreeze && globalFreeze.state === 'OPEN') {
      return {
        tripped: true,
        breaker: globalFreeze,
        reason: `Sub-sistema bloqueado por Quarentena Soberana Global (Motivo: ${globalFreeze.tripReason || 'Emergência'}).`,
      };
    }
  }

  const target = map.get(subsystem);
  if (target && target.state === 'OPEN') {
    return {
      tripped: true,
      breaker: target,
      reason: `Sub-sistema ${target.name} está desarmado / ativado (Motivo: ${target.tripReason || 'Acionamento manual'}).`,
    };
  }

  return { tripped: false };
}

/**
 * Generates cryptographic authorization token for circuit breaker reset
 */
export function generateBreakerProofToken(
  workspaceId: string,
  subsystem: CircuitBreakerSubsystem,
  actorId: string,
  timestamp: string
): string {
  const secret = process.env.AUDIT_HMAC_SECRET || 'xerebro-sovereign-audit-chain-key-2026';
  return crypto
    .createHmac('sha256', secret)
    .update(`RESET:${workspaceId}:${subsystem}:${actorId}:${timestamp}`, 'utf8')
    .digest('hex');
}

/**
 * Trips a circuit breaker immediately (Emergency Kill)
 */
export function tripCircuitBreaker(
  workspaceId: string,
  subsystem: CircuitBreakerSubsystem,
  actorId: string,
  actorRole: string,
  reason: string
): CircuitBreaker {
  const map = initializeWorkspaceBreakers(workspaceId);
  const breaker = map.get(subsystem);
  if (!breaker) {
    throw new Error(`Sub-sistema desconhecido: ${subsystem}`);
  }

  const now = new Date().toISOString();
  breaker.state = 'OPEN';
  breaker.trippedAt = now;
  breaker.trippedBy = actorId;
  breaker.tripReason = reason;
  breaker.tripCount += 1;

  // Append block to Cryptographic Audit Hash Chain
  appendAuditBlock(workspaceId, {
    workspaceId,
    entityId: subsystem,
    entityType: 'CONFIG',
    action: 'CIRCUIT_BREAKER_TRIPPED',
    actorId,
    actorRole,
    timestamp: now,
    payloadHash: calculatePayloadHash({
      subsystem,
      state: 'OPEN',
      tripCount: breaker.tripCount,
      reason,
      actorId,
      actorRole,
    }),
  });

  // Notify real-time event bus
  workspaceEventBus.publish(workspaceId, 'circuit_breaker:tripped', breaker);

  return breaker;
}

/**
 * Resets a circuit breaker back to CLOSED state
 */
export function resetCircuitBreaker(
  workspaceId: string,
  subsystem: CircuitBreakerSubsystem,
  actorId: string,
  actorRole: string
): CircuitBreaker {
  const map = initializeWorkspaceBreakers(workspaceId);
  const breaker = map.get(subsystem);
  if (!breaker) {
    throw new Error(`Sub-sistema desconhecido: ${subsystem}`);
  }

  const now = new Date().toISOString();
  breaker.state = 'CLOSED';
  breaker.resetAt = now;
  breaker.resetBy = actorId;
  breaker.recentFailures = [];

  // Append block to Cryptographic Audit Hash Chain
  appendAuditBlock(workspaceId, {
    workspaceId,
    entityId: subsystem,
    entityType: 'CONFIG',
    action: 'CIRCUIT_BREAKER_RESET',
    actorId,
    actorRole,
    timestamp: now,
    payloadHash: calculatePayloadHash({
      subsystem,
      state: 'CLOSED',
      resetAt: now,
      actorId,
      actorRole,
    }),
  });

  // Notify real-time event bus
  workspaceEventBus.publish(workspaceId, 'circuit_breaker:reset', breaker);

  return breaker;
}

/**
 * Records a failure event and automatically trips the breaker if consecutive threshold is crossed
 */
export function recordFailureAndEvaluateAutoTrip(
  workspaceId: string,
  subsystem: CircuitBreakerSubsystem,
  reason: string
): boolean {
  const map = initializeWorkspaceBreakers(workspaceId);
  const breaker = map.get(subsystem);
  if (!breaker || breaker.state === 'OPEN') return false;

  const now = new Date();
  const nowIso = now.toISOString();

  // Prune old failures outside window
  const windowMs = breaker.autoTripConfig.windowSeconds * 1000;
  breaker.recentFailures = breaker.recentFailures.filter(
    (f) => now.getTime() - new Date(f.timestamp).getTime() <= windowMs
  );

  breaker.recentFailures.push({ timestamp: nowIso, reason });

  if (
    breaker.autoTripConfig.enabled &&
    breaker.recentFailures.length >= breaker.autoTripConfig.consecutiveFailuresThreshold
  ) {
    tripCircuitBreaker(
      workspaceId,
      subsystem,
      'SYSTEM_AUTOMATION',
      'SYSTEM',
      `Auto-acionamento: ${breaker.recentFailures.length} falhas consecutivas em ${breaker.autoTripConfig.windowSeconds}s. Último erro: ${reason}`
    );
    return true;
  }

  return false;
}

/**
 * Initializes default policies for a workspace
 */
export function getWorkspacePolicies(workspaceId: string): PolicyRule[] {
  let list = workspacePolicies.get(workspaceId);
  if (!list) {
    list = [
      {
        id: `pol-task-dispatch-${workspaceId}`,
        workspaceId,
        name: 'Despacho Automatizado de Tarefa Pós-Ratificação',
        trigger: 'DECISION_RATIFIED',
        actionType: 'DISPATCH_TASK',
        config: {
          defaultPriority: 'HIGH',
          assigneeRole: 'ADMIN',
          autoStart: true,
        },
        enabled: true,
      },
      {
        id: `pol-quorum-escalate-${workspaceId}`,
        workspaceId,
        name: 'Escalação Preventiva de Quórum para Alto Impacto',
        trigger: 'DECISION_RATIFIED',
        actionType: 'QUORUM_ELEVATION',
        config: {
          impactTarget: 'CRITICAL',
          thresholdIncrease: 2,
        },
        enabled: true,
      },
    ];
    workspacePolicies.set(workspaceId, list);
  }
  return list;
}

/**
 * Returns recorded policy executions
 */
export function getWorkspacePolicyExecutions(workspaceId: string): PolicyExecutionReceipt[] {
  return workspaceExecutions.get(workspaceId) || [];
}

/**
 * Evaluates and executes policies triggered by a domain event (e.g. DECISION_RATIFIED)
 */
export async function evaluateAndExecutePolicies(
  workspaceId: string,
  event: {
    type: 'DECISION_RATIFIED' | 'INCIDENT_DETECTED' | 'MANUAL';
    entityId: string;
    entityData: any;
  }
): Promise<PolicyExecutionReceipt[]> {
  const policies = getWorkspacePolicies(workspaceId).filter(
    (p) => p.enabled && p.trigger === event.type
  );
  const receipts: PolicyExecutionReceipt[] = [];

  for (const policy of policies) {
    const startTime = Date.now();
    const executionId = `exec-${crypto.randomUUID()}`;
    const nowIso = new Date().toISOString();

    // Check if relevant breaker is tripped
    const freezeCheck = isCircuitBreakerTripped(workspaceId, 'GLOBAL_SYSTEM_FREEZE');
    if (freezeCheck.tripped) {
      const receipt: PolicyExecutionReceipt = {
        id: executionId,
        workspaceId,
        policyId: policy.id,
        policyName: policy.name,
        triggerEntityId: event.entityId,
        triggerEntityType: event.type,
        status: 'BLOCKED_BY_CIRCUIT_BREAKER',
        executionResult: { reason: freezeCheck.reason },
        durationMs: Date.now() - startTime,
        executedAt: nowIso,
      };
      receipts.push(receipt);
      continue;
    }

    try {
      let resultData: Record<string, any> = {};

      if (policy.actionType === 'DISPATCH_TASK') {
        const agentBreaker = isCircuitBreakerTripped(workspaceId, 'AGENT_AUTONOMY_KILL');
        if (agentBreaker.tripped) {
          receipts.push({
            id: executionId,
            workspaceId,
            policyId: policy.id,
            policyName: policy.name,
            triggerEntityId: event.entityId,
            triggerEntityType: event.type,
            status: 'BLOCKED_BY_CIRCUIT_BREAKER',
            executionResult: { reason: agentBreaker.reason },
            durationMs: Date.now() - startTime,
            executedAt: nowIso,
          });
          continue;
        }

        // Auto-generate operational task linked to ratified decision
        const title = `[Execução Soberana]: ${event.entityData.action || 'Ação Ratificada'}`;
        const description = `Execução automatizada disparada pela ratificação da decisão ${event.entityId}.\nImpacto: ${event.entityData.impact || 'N/A'}.\nJustificativa: ${event.entityData.rationale || 'N/A'}`;

        const createdTask = await prisma.task.create({
          data: {
            title,
            description,
            priority: policy.config.defaultPriority || 'HIGH',
            status: 'IN_PROGRESS',
            workspaceId,
          },
        });

        resultData = {
          taskId: createdTask.id,
          taskTitle: createdTask.title,
          priority: createdTask.priority,
          status: createdTask.status,
        };

        // Notify event bus
        workspaceEventBus.publish(workspaceId, 'task:created', createdTask);
      } else if (policy.actionType === 'QUORUM_ELEVATION') {
        resultData = {
          applied: true,
          mode: 'GOVERNANCE_THRESHOLD_ELEVATED',
          increment: policy.config.thresholdIncrease || 1,
        };
      } else {
        resultData = { applied: true, details: 'Default policy execution cycle complete.' };
      }

      // Seal into Cryptographic Audit Hash Chain
      const auditBlock = appendAuditBlock(workspaceId, {
        workspaceId,
        entityId: executionId,
        entityType: 'DECISION',
        action: 'POLICY_EXECUTED',
        actorId: 'POLICY_ENGINE_CORE',
        actorRole: 'SYSTEM',
        timestamp: nowIso,
        payloadHash: calculatePayloadHash({
          executionId,
          policyId: policy.id,
          policyName: policy.name,
          triggerEvent: event.type,
          triggerEntityId: event.entityId,
          resultData,
        }),
      });

      const receipt: PolicyExecutionReceipt = {
        id: executionId,
        workspaceId,
        policyId: policy.id,
        policyName: policy.name,
        triggerEntityId: event.entityId,
        triggerEntityType: event.type,
        status: 'EXECUTED',
        executionResult: resultData,
        durationMs: Date.now() - startTime,
        executedAt: nowIso,
        cryptographicProofHash: auditBlock.currentBlockHash,
      };

      receipts.push(receipt);
    } catch (err: any) {
      receipts.push({
        id: executionId,
        workspaceId,
        policyId: policy.id,
        policyName: policy.name,
        triggerEntityId: event.entityId,
        triggerEntityType: event.type,
        status: 'FAILED',
        executionResult: { error: err?.message || 'Falha na execução de política.' },
        durationMs: Date.now() - startTime,
        executedAt: nowIso,
      });
    }
  }

  // Store receipts in workspace memory
  const existing = workspaceExecutions.get(workspaceId) || [];
  workspaceExecutions.set(workspaceId, [...receipts, ...existing].slice(0, 50));

  return receipts;
}
