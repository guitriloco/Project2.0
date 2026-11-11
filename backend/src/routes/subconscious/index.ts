import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { collectiveSubconsciousService } from '../../modules/orchestration/subconscious.service.js';

const dreamSchema = z.object({
  dream: z.object({
    agentId: z.string().trim().min(1),
    simulationPath: z.string().min(1),
    optimizationFound: z.string().min(1),
    resonanceScore: z.number().finite(),
  }),
});

export default async function (fastify: FastifyInstance) {
  fastify.post('/dream', async (request, reply) => {
    const parsed = dreamSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Dream data is required' });
    return await collectiveSubconsciousService.shareDream(parsed.data.dream);
  });

  fastify.get('/state', async () => {
    return await collectiveSubconsciousService.getSubconsciousState();
  });
}
