import { describe, it, expect } from 'vitest';
import {
  CreateTaskSchema,
  UpdateTaskStatusSchema,
  createProblemDetails,
  TaskStatusEnum,
} from '../src/lib/schemas/contracts.js';

describe('Task Contracts & Schema Hardening', () => {
  it('should successfully validate a well-formed task payload', () => {
    const validPayload = {
      title: 'Validar schema de governança do Core',
      description: 'Auditoria técnica de endpoints e validação de contratos Zod',
      status: 'PENDING' as const,
      priority: 'HIGH' as const,
    };

    const result = CreateTaskSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe(validPayload.title);
      expect(result.data.status).toBe('PENDING');
      expect(result.data.priority).toBe('HIGH');
    }
  });

  it('should fail when title is empty or whitespace only', () => {
    const invalidPayload = {
      title: '   ',
      status: 'PENDING' as const,
    };

    const result = CreateTaskSchema.safeParse(invalidPayload);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toContain('title');
    }
  });

  it('should reject invalid status enums', () => {
    const invalidPayload = {
      title: 'Tarefa com status desconhecido',
      status: 'NOT_A_REAL_STATUS',
    };

    const result = CreateTaskSchema.safeParse(invalidPayload);
    expect(result.success).toBe(false);
  });

  it('should validate partial updates in UpdateTaskStatusSchema', () => {
    const updatePayload = {
      status: 'COMPLETED' as const,
    };

    const result = UpdateTaskStatusSchema.safeParse(updatePayload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('COMPLETED');
    }
  });

  it('should generate RFC 7807 Problem Details compliant error objects', () => {
    const problem = createProblemDetails({
      status: 400,
      title: 'Invalid Task Payload',
      detail: 'Field title is missing',
      instance: '/api/tasks',
      code: 'ERR_TASK_VALIDATION',
    });

    expect(problem.status).toBe(400);
    expect(problem.title).toBe('Invalid Task Payload');
    expect(problem.instance).toBe('/api/tasks');
    expect(problem.code).toBe('ERR_TASK_VALIDATION');
    expect(typeof problem.timestamp).toBe('string');
  });
});
