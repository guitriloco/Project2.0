import { describe, it, expect } from 'vitest';
import {
  OperationsMetricsSchema,
  OperationsSummarySchema,
  createProblemDetails,
} from '../src/lib/schemas/contracts.js';

describe('Operations Contracts & Metrics Hardening', () => {
  it('should validate structured operations metrics payload', () => {
    const validMetrics = {
      totalTasks: 24,
      completedTasks: 18,
      activeDecisions: 7,
      systemHealth: 'HEALTHY' as const,
      recentActivityCount: 15,
    };

    const result = OperationsMetricsSchema.safeParse(validMetrics);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.systemHealth).toBe('HEALTHY');
      expect(result.data.totalTasks).toBe(24);
    }
  });

  it('should validate an operations summary with nested tasks and decisions', () => {
    const summaryPayload = {
      generatedAt: new Date().toISOString(),
      tasks: {
        total: 10,
        recent: [
          {
            id: 'task-1',
            title: 'Configurar schemas Zod',
            status: 'COMPLETED',
          },
        ],
      },
      decisions: {
        total: 5,
        recent: [
          {
            id: 'dec-1',
            action: 'Desacoplar componentes de UI',
            rationale: 'Modularidade e facilidade de testes unitários',
            confidence: 0.9,
            status: 'LOGGED',
          },
        ],
      },
      proposals: {
        total: 2,
      },
    };

    const result = OperationsSummarySchema.safeParse(summaryPayload);
    expect(result.success).toBe(true);
  });

  it('should format RFC 7807 problem details with invalidParams list', () => {
    const problem = createProblemDetails({
      status: 400,
      title: 'Bad Request',
      detail: 'Validation failed for 2 fields',
      instance: '/api/operations/summary',
      code: 'ERR_VALIDATION_FAILED',
      invalidParams: [
        { name: 'title', reason: 'Field cannot be empty' },
        { name: 'status', reason: 'Invalid enum value' },
      ],
    });

    expect(problem.status).toBe(400);
    expect(problem.invalidParams).toHaveLength(2);
    expect(problem.type).toBe('https://project2.internal/errors/ERR_VALIDATION_FAILED');
  });
});
