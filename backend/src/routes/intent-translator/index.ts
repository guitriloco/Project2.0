import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { intentTranslatorService } from '../../modules/orchestration/intentTranslator.service.js';

const vibeSchema = z.object({
  vibe: z.object({
    input: z.string().trim().min(1),
    context: z.string().optional(),
    emotionalState: z.string().optional(),
  }),
});

export default async function (fastify: FastifyInstance) {
  fastify.post('/translate', async (request, reply) => {
    const parsed = vibeSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Vibe data is required' });
    return await intentTranslatorService.translateIntent(parsed.data.vibe);
  });

  fastify.get('/status', async () => {
    return await intentTranslatorService.getTranslatorStatus();
  });
}
