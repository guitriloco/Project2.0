import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { realityGenerationService } from '../../modules/orchestration/realityGeneration.service.js';

const blueprintSchema = z.object({
  blueprint: z.object({
    realityName: z.string().trim().min(1),
    physicsConstants: z.record(z.string(), z.number().finite()),
    initialEntropy: z.number().finite(),
  }),
});

export default async function (fastify: FastifyInstance) {
  fastify.post('/generate', async (request, reply) => {
    const parsed = blueprintSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Blueprint is required' });
    return await realityGenerationService.generateRealityKernel(parsed.data.blueprint);
  });

  fastify.get('/status', async () => {
    return await realityGenerationService.getEngineStatus();
  });
}
