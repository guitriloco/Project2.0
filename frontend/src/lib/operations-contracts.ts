import { z } from 'zod';

// ==========================================
// AUDIT EVENT CONTRACT
// ==========================================
export const AuditEventSchema = z.object({
  id: z.string(),
  type: z.string(),
  entityId: z.string(),
  entityTitle: z.string(),
  status: z.string(),
  source: z.string(),
  details: z.record(z.string(), z.unknown()).nullable().optional(),
  createdAt: z.string(),
});
export type AuditEvent = z.infer<typeof AuditEventSchema>;

// ==========================================
// TASK CONTRACTS
// ==========================================
export const TaskStatusEnum = z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'BLOCKED']);
export type TaskStatus = z.infer<typeof TaskStatusEnum>;

export const TaskPriorityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
export type TaskPriority = z.infer<typeof TaskPriorityEnum>;

export const CreateTaskSchema = z.object({
  title: z.string().trim().min(1, 'O título não pode estar vazio').max(200, 'Máximo de 200 caracteres'),
  description: z.string().trim().max(5000, 'Máximo de 5000 caracteres').nullable().optional(),
  status: TaskStatusEnum.optional().default('PENDING'),
  priority: TaskPriorityEnum.optional().default('MEDIUM'),
  workspaceId: z.string().trim().optional(),
});
export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;

export const UpdateTaskStatusSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  status: TaskStatusEnum.optional(),
  priority: TaskPriorityEnum.optional(),
});
export type UpdateTaskStatusInput = z.infer<typeof UpdateTaskStatusSchema>;

export const TaskItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable().optional(),
  status: z.string(),
  priority: z.string().optional(),
  workspaceId: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
export type TaskItem = z.infer<typeof TaskItemSchema>;
export type Task = TaskItem;

// ==========================================
// DECISION CONTRACTS & MULTI-SIGNATURE
// ==========================================
export const DecisionStatusEnum = z.enum(['LOGGED', 'APPROVED', 'REJECTED', 'UNDER_REVIEW']);
export type DecisionStatus = z.infer<typeof DecisionStatusEnum>;

export const DecisionVoteEnum = z.enum(['APPROVE', 'REJECT', 'VETO']);
export type DecisionVote = z.infer<typeof DecisionVoteEnum>;

export const DecisionSignatureSchema = z.object({
  userId: z.string(),
  userName: z.string().optional(),
  userRole: z.string(),
  vote: DecisionVoteEnum,
  weight: z.number(),
  timestamp: z.string(),
  rationale: z.string().optional(),
  cryptographicSignature: z.string(),
});
export type DecisionSignature = z.infer<typeof DecisionSignatureSchema>;

export const CreateDecisionSchema = z.object({
  action: z.string().trim().min(1, 'A ação deve ser preenchida').max(200, 'Máximo de 200 caracteres'),
  rationale: z.string().trim().min(1, 'A justificativa é obrigatória').max(10000, 'Máximo de 10000 caracteres'),
  impact: z.string().trim().max(10000).nullable().optional(),
  confidence: z.number().min(0).max(1).default(0.8),
  status: DecisionStatusEnum.optional().default('LOGGED'),
  workspaceId: z.string().trim().max(120).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  requiredWeightThreshold: z.number().min(1).max(100).optional().default(5),
});
export type CreateDecisionInput = z.infer<typeof CreateDecisionSchema>;

export interface CryptographicAuditBlock {
  blockIndex: number;
  timestamp: string;
  workspaceId: string;
  entityId: string;
  entityType: 'DECISION' | 'TASK' | 'PROPOSAL' | 'CONFIG';
  action: string;
  actorId: string;
  actorRole: string;
  payloadHash: string;
  prevBlockHash: string;
  currentBlockHash: string;
  signatureProof: string;
}

export interface DecisionProofData {
  decisionId: string;
  proof: CryptographicAuditBlock | null;
  signatures: DecisionSignature[];
  chainVerification: {
    isValid: boolean;
    brokenAtBlockIndex?: number;
    totalBlocks: number;
    latestHash: string;
    verifiedAt: string;
  };
}

export const DecisionItemSchema = z.object({
  id: z.string(),
  action: z.string(),
  title: z.string().optional(),
  rationale: z.string().optional(),
  context: z.string().optional(),
  impact: z.string().nullable().optional(),
  impactLevel: z.string().optional(),
  confidence: z.number().optional(),
  status: z.string(),
  workspaceId: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  createdAt: z.string().optional(),
});
export type DecisionItem = z.infer<typeof DecisionItemSchema>;
export type Decision = DecisionItem;

// ==========================================
// OPERATIONS SUMMARY & METRICS CONTRACTS
// ==========================================
export const OperationsSummarySchema = z.object({
  generatedAt: z.string(),
  workspace: z
    .object({
      id: z.string(),
      role: z.string().optional(),
      name: z.string().optional(),
    })
    .optional(),
  tasks: z.object({
    total: z.number(),
    byStatus: z.array(z.any()).optional(),
    recent: z.array(TaskItemSchema).optional(),
  }),
  decisions: z.object({
    total: z.number(),
    recent: z.array(DecisionItemSchema).optional(),
  }),
  proposals: z.object({
    total: z.number(),
    byStatus: z.array(z.any()).optional(),
  }),
  conversations: z.number().optional(),
  audit: z.object({
    total: z.number(),
    recent: z.array(AuditEventSchema).optional(),
  }).optional(),
});
export type OperationsSummary = z.infer<typeof OperationsSummarySchema>;

// ==========================================
// RFC 7807 PROBLEM DETAILS CONTRACT
// ==========================================
export const ProblemDetailsSchema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number(),
  detail: z.string(),
  instance: z.string(),
  timestamp: z.string(),
  code: z.string().optional(),
  invalidParams: z.array(z.object({
    name: z.string(),
    reason: z.string(),
  })).optional(),
});
export type ProblemDetails = z.infer<typeof ProblemDetailsSchema>;

export function createProblemDetails(params: {
  status: number;
  title: string;
  detail: string;
  instance?: string;
  code?: string;
  type?: string;
  invalidParams?: { name: string; reason: string }[];
}): ProblemDetails {
  return {
    type: params.type || `https://project2.internal/errors/${params.code || 'UNKNOWN_ERROR'}`,
    title: params.title,
    status: params.status,
    detail: params.detail,
    instance: params.instance || '/api',
    timestamp: new Date().toISOString(),
    code: params.code,
    invalidParams: params.invalidParams,
  };
}

// ==========================================
// CIRCUIT BREAKER & POLICY CONTRACTS
// ==========================================
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

