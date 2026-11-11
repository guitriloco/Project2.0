import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { finalLogicKernelService } from '../../modules/orchestration/finalLogicKernel.service.js';

const updateSchema = z.object({ update: z.object({ contextId: z.string().trim().min(1), requiredOptimization: z.string().min(1), latencyConstraint: z.number().finite() }) });

export default async function (fastify: FastifyInstance) {
  fastify.post('/adapt', async (request, reply) => {
    const parsed = updateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Update context is required' });
    return await finalLogicKernelService.adaptLogic(parsed.data.update);
  });

  fastify.get('/status', async () => {
    return await finalLogicKernelService.getKernelStatus();
  });
}
