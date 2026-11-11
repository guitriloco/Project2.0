import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { logicGenerationService } from '../../modules/orchestration/logicGeneration.service.js';

const seedSchema = z.object({
  seed: z.object({ seed: z.string().min(1), evolutionParameters: z.unknown() }),
});

export default async function (fastify: FastifyInstance) {
  fastify.post('/generate', async (request, reply) => {
    const parsed = seedSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Seed is required' });
    return await logicGenerationService.generateLogicBranch(parsed.data.seed);
  });

  fastify.get('/status', async () => {
    return await logicGenerationService.getEngineStatus();
  });
}
