import { describe, it, expect, beforeEach } from 'vitest';
import { rateLimit, resetRateLimits } from '../src/lib/rate-limiter.js';

describe('Rate Limiting & Abuse Prevention', () => {
  beforeEach(() => {
    resetRateLimits();
  });

  it('allows requests within threshold and sets standard rate limit headers', async () => {
    const limiter = rateLimit({ max: 3, windowMs: 10000, keyPrefix: 'test-limit' });

    const mockRequest: any = {
      userId: 'user-normal',
      url: '/api/tasks',
      routerPath: '/api/tasks',
    };

    const headers: Record<string, any> = {};
    const mockReply: any = {
      header(key: string, value: any) {
        headers[key] = value;
        return this;
      },
      code() {
        return this;
      },
      send() {
        return this;
      },
    };

    // Request 1
    await limiter(mockRequest, mockReply);
    expect(headers['X-RateLimit-Limit']).toBe(3);
    expect(headers['X-RateLimit-Remaining']).toBe(2);

    // Request 2
    await limiter(mockRequest, mockReply);
    expect(headers['X-RateLimit-Remaining']).toBe(1);

    // Request 3
    await limiter(mockRequest, mockReply);
    expect(headers['X-RateLimit-Remaining']).toBe(0);
  });

  it('blocks excess requests with 429 ERR_RATE_LIMIT_EXCEEDED and Retry-After header', async () => {
    const limiter = rateLimit({ max: 2, windowMs: 5000, keyPrefix: 'test-block' });

    const mockRequest: any = {
      userId: 'user-spammer',
      url: '/api/decisions',
      routerPath: '/api/decisions',
    };

    let sentCode = 0;
    let sentPayload: any = null;
    const headers: Record<string, any> = {};

    const mockReply: any = {
      header(key: string, value: any) {
        headers[key] = value;
        return this;
      },
      code(c: number) {
        sentCode = c;
        return this;
      },
      send(p: any) {
        sentPayload = p;
        return this;
      },
    };

    // Req 1 & 2 pass
    await limiter(mockRequest, mockReply);
    await limiter(mockRequest, mockReply);

    // Req 3 should be blocked
    await limiter(mockRequest, mockReply);

    expect(sentCode).toBe(429);
    expect(headers['Retry-After']).toBeDefined();
    expect(headers['content-type']).toBe('application/problem+json');
    expect(sentPayload.code).toBe('ERR_RATE_LIMIT_EXCEEDED');
    expect(sentPayload.status).toBe(429);
    expect(sentPayload.title).toBe('Rate Limit Exceeded');
  });
});
