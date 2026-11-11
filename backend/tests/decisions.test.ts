import { describe, it, expect } from 'vitest';
import {
  CreateDecisionSchema,
  DecisionStatusEnum,
  createProblemDetails,
} from '../src/lib/schemas/contracts.js';

describe('Decision Contracts & Schema Hardening', () => {
  it('should validate a valid decision with confidence and rationale', () => {
    const validDecision = {
      action: 'Aprovar política de rate limiting por IP/Workspace',
      rationale: 'Mitigar exaustão de conexões no backend Fastify e proteger banco Neon',
      confidence: 0.95,
      status: 'APPROVED' as const,
    };

    const result = CreateDecisionSchema.safeParse(validDecision);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.action).toBe(validDecision.action);
      expect(result.data.confidence).toBe(0.95);
      expect(result.data.status).toBe('APPROVED');
    }
  });

  it('should reject decision with missing rationale', () => {
    const invalid = {
      action: 'Ação sem justificativa',
      rationale: '',
      confidence: 0.8,
    };

    const result = CreateDecisionSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should reject confidence values outside [0, 1] range', () => {
    const outOfBoundsHigh = {
      action: 'Ação de teste',
      rationale: 'Racional válido',
      confidence: 1.5,
    };

    const outOfBoundsLow = {
      action: 'Ação de teste',
      rationale: 'Racional válido',
      confidence: -0.1,
    };

    expect(CreateDecisionSchema.safeParse(outOfBoundsHigh).success).toBe(false);
    expect(CreateDecisionSchema.safeParse(outOfBoundsLow).success).toBe(false);
  });

  it('should handle optional metadata without breaking strict parsing', () => {
    const withMetadata = {
      action: 'Adotar contratos Zod v4',
      rationale: 'Unificar contratos entre Fastify e Next.js',
      confidence: 0.9,
      metadata: { author: 'Lead Architect', ticket: 'PRJ-102' },
    };

    const result = CreateDecisionSchema.safeParse(withMetadata);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.metadata).toEqual({ author: 'Lead Architect', ticket: 'PRJ-102' });
    }
  });
});
