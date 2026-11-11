import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { logicOptimizationService } from '../../modules/orchestration/logicOptimization.service.js';

const circuitSchema = z.object({ circuit: z.object({ circuitId: z.string().trim().min(1), modulePath: z.string().trim().min(1), complexity: z.number().finite().nonnegative(), logicPath: z.string().min(1) }) });

export default async function (fastify: FastifyInstance) {
  fastify.post('/optimize', async (request, reply) => {
    const parsed = circuitSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Circuit data is required' });
    return await logicOptimizationService.optimizeCircuit(parsed.data.circuit);
  });

  fastify.get('/status', async () => {
    return await logicOptimizationService.scanForRedundancies();
  });
}
