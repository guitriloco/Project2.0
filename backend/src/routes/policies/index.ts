import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { withWorkspaceContext } from '../../lib/workspace.js';
import {
  requireWorkspaceViewer,
  requireWorkspaceAdmin,
} from '../../lib/rbac.js';
import { rateLimit } from '../../lib/rate-limiter.js';
import { createProblemDetails } from '../../lib/schemas/contracts.js';
import {
  getWorkspaceCircuitBreakers,
  getCircuitBreaker,
  tripCircuitBreaker,
  resetCircuitBreaker,
  getWorkspacePolicies,
  getWorkspacePolicyExecutions,
  evaluateAndExecutePolicies,
  generateBreakerProofToken,
  type CircuitBreakerSubsystem,
} from '../../lib/policyEngine.js';

const TripBreakerSchema = z.object({
  reason: z.string().trim().min(3).max(1000),
});

const ResetBreakerSchema = z.object({
  resetProofToken: z.string().trim().optional(),
});

const ManualExecutePolicySchema = z.object({
  decisionId: z.string().trim().min(1),
  action: z.string().trim().min(1),
  impact: z.string().trim().optional(),
  rationale: z.string().trim().optional(),
});

const VALID_SUBSYSTEMS: CircuitBreakerSubsystem[] = [
  'GLOBAL_SYSTEM_FREEZE',
  'OUTBOUND_WEBHOOK_KILL',
  'AGENT_AUTONOMY_KILL',
  'GOVERNANCE_MUTATION_LOCK',
];

const policiesRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/policies/circuit-breakers: List all circuit breakers with live statuses
  fastify.get(
    '/circuit-breakers',
    {
      preHandler: [withWorkspaceContext, requireWorkspaceViewer],
    },
    async (request, reply) => {
      try {
        const workspaceId = request.workspace!.id;
        const breakers = getWorkspaceCircuitBreakers(workspaceId);
        return reply.send(breakers);
      } catch (err: any) {
        const problem = createProblemDetails({
          status: 500,
          title: 'Error Listing Circuit Breakers',
          detail: err?.message || 'Falha ao consultar estado dos disjuntores soberanos.',
          instance: request.url,
          code: 'ERR_CIRCUIT_BREAKERS_FETCH',
        });
        return reply.code(500).header('content-type', 'application/problem+json').send(problem);
      }
    }
  );

  // POST /api/policies/circuit-breakers/:id/trip: Emergency trip of a circuit breaker
  fastify.post(
    '/circuit-breakers/:id/trip',
    {
      preHandler: [
        withWorkspaceContext,
        requireWorkspaceAdmin,
        rateLimit({ max: 30, windowMs: 60000 }),
      ],
    },
    async (request, reply) => {
      const params = request.params as { id?: string };
      const subsystem = params.id as CircuitBreakerSubsystem;

      if (!subsystem || !VALID_SUBSYSTEMS.includes(subsystem)) {
        const problem = createProblemDetails({
          status: 400,
          title: 'Invalid Circuit Breaker ID',
          detail: `ID inválido. Válidos: ${VALID_SUBSYSTEMS.join(', ')}`,
          instance: request.url,
          code: 'ERR_INVALID_BREAKER_ID',
        });
        return reply.code(400).header('content-type', 'application/problem+json').send(problem);
      }

      const parsed = TripBreakerSchema.safeParse(request.body);
      if (!parsed.success) {
        const problem = createProblemDetails({
          status: 400,
          title: 'Invalid Trip Payload',
          detail: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
          instance: request.url,
          code: 'ERR_VALIDATION_FAILED',
        });
        return reply.code(400).header('content-type', 'application/problem+json').send(problem);
      }

      try {
        const workspaceId = request.workspace!.id;
        const userId = request.userId!;
        const userRole = request.workspace!.role || 'ADMIN';

        const updated = tripCircuitBreaker(
          workspaceId,
          subsystem,
          userId,
          userRole,
          parsed.data.reason
        );

        return reply.send(updated);
      } catch (err: any) {
        const problem = createProblemDetails({
          status: 500,
          title: 'Circuit Breaker Trip Failed',
          detail: err?.message || 'Falha ao acionar disjuntor de emergência.',
          instance: request.url,
          code: 'ERR_BREAKER_TRIP_FAILED',
        });
        return reply.code(500).header('content-type', 'application/problem+json').send(problem);
      }
    }
  );

  // POST /api/policies/circuit-breakers/:id/reset: Reset a circuit breaker
  fastify.post(
    '/circuit-breakers/:id/reset',
    {
      preHandler: [
        withWorkspaceContext,
        requireWorkspaceAdmin,
        rateLimit({ max: 30, windowMs: 60000 }),
      ],
    },
    async (request, reply) => {
      const params = request.params as { id?: string };
      const subsystem = params.id as CircuitBreakerSubsystem;

      if (!subsystem || !VALID_SUBSYSTEMS.includes(subsystem)) {
        const problem = createProblemDetails({
          status: 400,
          title: 'Invalid Circuit Breaker ID',
          detail: `ID inválido. Válidos: ${VALID_SUBSYSTEMS.join(', ')}`,
          instance: request.url,
          code: 'ERR_INVALID_BREAKER_ID',
        });
        return reply.code(400).header('content-type', 'application/problem+json').send(problem);
      }

      const userRole = request.workspace!.role || 'MEMBER';
      // Only OWNER or ADMIN can reset
      if (userRole !== 'OWNER' && userRole !== 'ADMIN') {
        const problem = createProblemDetails({
          status: 403,
          title: 'Reset Authorization Denied',
          detail: 'Apenas operadores com autoridade OWNER ou ADMIN podem rearmar disjuntores soberanos.',
          instance: request.url,
          code: 'ERR_BREAKER_RESET_UNAUTHORIZED',
        });
        return reply.code(403).header('content-type', 'application/problem+json').send(problem);
      }

      try {
        const workspaceId = request.workspace!.id;
        const userId = request.userId!;

        const resetResult = resetCircuitBreaker(workspaceId, subsystem, userId, userRole);
        return reply.send(resetResult);
      } catch (err: any) {
        const problem = createProblemDetails({
          status: 500,
          title: 'Circuit Breaker Reset Failed',
          detail: err?.message || 'Falha ao rearmar disjuntor.',
          instance: request.url,
          code: 'ERR_BREAKER_RESET_FAILED',
        });
        return reply.code(500).header('content-type', 'application/problem+json').send(problem);
      }
    }
  );

  // GET /api/policies/rules: List workspace policy rules
  fastify.get(
    '/rules',
    {
      preHandler: [withWorkspaceContext, requireWorkspaceViewer],
    },
    async (request, reply) => {
      const workspaceId = request.workspace!.id;
      const policies = getWorkspacePolicies(workspaceId);
      return reply.send(policies);
    }
  );

  // GET /api/policies/executions: List policy execution receipts
  fastify.get(
    '/executions',
    {
      preHandler: [withWorkspaceContext, requireWorkspaceViewer],
    },
    async (request, reply) => {
      const workspaceId = request.workspace!.id;
      const executions = getWorkspacePolicyExecutions(workspaceId);
      return reply.send(executions);
    }
  );

  // POST /api/policies/execute: Test or manual execution of policies against a decision
  fastify.post(
    '/execute',
    {
      preHandler: [
        withWorkspaceContext,
        requireWorkspaceAdmin,
        rateLimit({ max: 20, windowMs: 60000 }),
      ],
    },
    async (request, reply) => {
      const parsed = ManualExecutePolicySchema.safeParse(request.body);
      if (!parsed.success) {
        const problem = createProblemDetails({
          status: 400,
          title: 'Invalid Execution Payload',
          detail: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
          instance: request.url,
          code: 'ERR_VALIDATION_FAILED',
        });
        return reply.code(400).header('content-type', 'application/problem+json').send(problem);
      }

      try {
        const workspaceId = request.workspace!.id;
        const receipts = await evaluateAndExecutePolicies(workspaceId, {
          type: 'DECISION_RATIFIED',
          entityId: parsed.data.decisionId,
          entityData: {
            action: parsed.data.action,
            impact: parsed.data.impact || 'MEDIUM',
            rationale: parsed.data.rationale || 'Manual Policy Trigger',
          },
        });

        return reply.code(200).send(receipts);
      } catch (err: any) {
        const problem = createProblemDetails({
          status: 500,
          title: 'Manual Policy Execution Failed',
          detail: err?.message || 'Falha ao executar políticas.',
          instance: request.url,
          code: 'ERR_POLICY_EXECUTION',
        });
        return reply.code(500).header('content-type', 'application/problem+json').send(problem);
      }
    }
  );
};

export default policiesRoutes;
