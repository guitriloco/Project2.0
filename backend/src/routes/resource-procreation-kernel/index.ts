import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { resourceProcreationKernelService } from '../../modules/orchestration/resourceProcreationKernel.service.js';

const vectorSchema = z.object({
  vector: z.object({
    source: z.string().trim().min(1),
    loadBalance: z.number().finite(),
    sustainabilityRating: z.number().finite(),
  }),
});

export default async function (fastify: FastifyInstance) {
  fastify.post('/execute', async (request, reply) => {
    const parsed = vectorSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Vector data is required' });
    return await resourceProcreationKernelService.executeResourceCycle(parsed.data.vector);
  });

  fastify.get('/status', async () => {
    return await resourceProcreationKernelService.getKernelStatus();
  });
}
