import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { collaborationService } from '../../modules/orchestration/collaboration.service.js';

const collaborateSchema = z.object({ from: z.string().trim().min(1), to: z.string().trim().min(1), message: z.string().min(1), priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'), context: z.unknown().optional() });

export default async function (fastify: FastifyInstance) {
  fastify.post('/collaborate', async (request, reply) => {
    const parsed = collaborateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid collaboration message' });
    const { from, to, message, priority, context } = parsed.data;
    const result = await collaborationService.routeMessage({ from, to, content: message, priority, context });
    return result;
  });

  fastify.post('/sync-tasks', async () => {
    const result = await collaborationService.synchronizeTasks();
    return result;
  });

  fastify.get('/collaboration-status', async () => {
    return {
      layer: 'Multi-Agent Dynamic Coordination',
      status: 'ACTIVE',
      protocol: 'Xerebro-Collateral-v1'
    };
  });
}
