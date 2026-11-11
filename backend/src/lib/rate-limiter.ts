import type { FastifyRequest, FastifyReply } from 'fastify';
import { createProblemDetails } from './schemas/contracts.js';

export interface RateLimitOptions {
  max: number;
  windowMs: number;
  keyPrefix?: string;
}

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const clientRecords = new Map<string, RateLimitRecord>();

// Cleanup stale counters periodically
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, record] of clientRecords.entries()) {
    if (record.resetAt <= now) {
      clientRecords.delete(key);
    }
  }
}, 60000);

if (typeof cleanupTimer.unref === 'function') {
  cleanupTimer.unref();
}

export function resetRateLimits(): void {
  clientRecords.clear();
}

export function rateLimit(options: RateLimitOptions) {
  const { max, windowMs, keyPrefix = 'rl' } = options;

  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const identifier = request.userId || request.ip || 'anonymous';
    const path = (request as any).routerPath || request.url.split('?')[0] || '/';
    const key = `${keyPrefix}:${identifier}:${path}`;
    const now = Date.now();

    let record = clientRecords.get(key);
    if (!record || record.resetAt <= now) {
      record = { count: 1, resetAt: now + windowMs };
      clientRecords.set(key, record);
    } else {
      record.count += 1;
    }

    const remaining = Math.max(0, max - record.count);
    const retryAfterSeconds = Math.ceil((record.resetAt - now) / 1000);

    reply.header('X-RateLimit-Limit', max);
    reply.header('X-RateLimit-Remaining', remaining);
    reply.header('X-RateLimit-Reset', Math.ceil(record.resetAt / 1000));

    if (record.count > max) {
      reply.header('Retry-After', retryAfterSeconds);
      const problem = createProblemDetails({
        status: 429,
        title: 'Rate Limit Exceeded',
        detail: `Limite de requisições excedido (${max} requisições por ${Math.round(windowMs / 1000)}s). Tente novamente em ${retryAfterSeconds} segundos.`,
        instance: request.url,
        code: 'ERR_RATE_LIMIT_EXCEEDED',
      });
      return reply.code(429).header('content-type', 'application/problem+json').send(problem);
    }
  };
}
