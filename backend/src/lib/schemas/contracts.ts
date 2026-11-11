import { z } from 'zod';

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

export const TaskResponseSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable().optional(),
  status: z.string(),
  priority: z.string().optional(),
  workspaceId: z.string().nullable().optional(),
  createdAt: z.union([z.string(), z.date()]).optional(),
  updatedAt: z.union([z.string(), z.date()]).optional(),
});
export type TaskResponse = z.infer<typeof TaskResponseSchema>;

// ==========================================
// DECISION CONTRACTS & MULTI-SIGNATURE
// ==========================================
export const DecisionStatusEnum = z.enum(['LOGGED', 'APPROVED', 'REJECTED', 'UNDER_REVIEW']);
export type DecisionStatus = z.infer<typeof DecisionStatusEnum>;

export const DecisionVoteEnum = z.enum(['APPROVE', 'REJECT', 'VETO']);
export type DecisionVote = z.infer<typeof DecisionVoteEnum>;

export const SignDecisionSchema = z.object({
  vote: DecisionVoteEnum,
  rationale: z.string().trim().max(2000).optional(),
});
export type SignDecisionInput = z.infer<typeof SignDecisionSchema>;

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

export const DecisionResponseSchema = z.object({
  id: z.string(),
  action: z.string(),
  rationale: z.string(),
  impact: z.string().nullable().optional(),
  confidence: z.number(),
  status: z.string(),
  workspaceId: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  createdAt: z.union([z.string(), z.date()]).optional(),
});
export type DecisionResponse = z.infer<typeof DecisionResponseSchema>;

// ==========================================
// WORKSPACE CONTRACTS
// ==========================================
export const WorkspaceRoleEnum = z.enum(['OWNER', 'ADMIN', 'MEMBER', 'OBSERVER']);
export type WorkspaceRole = z.infer<typeof WorkspaceRoleEnum>;

export const CreateWorkspaceSchema = z.object({
  name: z.string().trim().min(1, 'Nome obrigatório').max(80, 'Máximo de 80 caracteres'),
});
export type CreateWorkspaceInput = z.infer<typeof CreateWorkspaceSchema>;

export const UpdateWorkspaceSchema = z.object({
  name: z.string().trim().min(1, 'Nome obrigatório').max(80, 'Máximo de 80 caracteres'),
});
export type UpdateWorkspaceInput = z.infer<typeof UpdateWorkspaceSchema>;

export const WorkspaceResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string().optional(),
  createdAt: z.union([z.string(), z.date()]).optional(),
  updatedAt: z.union([z.string(), z.date()]).optional(),
});
export type WorkspaceResponse = z.infer<typeof WorkspaceResponseSchema>;

// ==========================================
// OPERATIONS & METRICS CONTRACTS
// ==========================================
export const OperationsMetricsSchema = z.object({
  totalTasks: z.number(),
  completedTasks: z.number(),
  activeDecisions: z.number(),
  systemHealth: z.enum(['HEALTHY', 'DEGRADED', 'CRITICAL']),
  recentActivityCount: z.number(),
});
export type OperationsMetrics = z.infer<typeof OperationsMetricsSchema>;

export const OperationsSummarySchema = z.object({
  generatedAt: z.string(),
  tasks: z.object({
    total: z.number(),
    byStatus: z.array(z.any()).optional(),
    recent: z.array(TaskResponseSchema).optional(),
  }),
  decisions: z.object({
    total: z.number(),
    recent: z.array(DecisionResponseSchema).optional(),
  }),
  proposals: z.object({
    total: z.number(),
    byStatus: z.array(z.any()).optional(),
  }),
  conversations: z.number().optional(),
  audit: z.object({
    total: z.number(),
    recent: z.array(z.any()).optional(),
  }).optional(),
});
export type OperationsSummaryType = z.infer<typeof OperationsSummarySchema>;

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
