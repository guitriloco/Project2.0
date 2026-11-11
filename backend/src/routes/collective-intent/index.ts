import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { intentExecutionService } from '../../modules/orchestration/intentExecution.service.js';

const intentsSchema = z.object({
  intents: z.array(z.object({
    entityId: z.string().trim().min(1), type: z.enum(['HUMAN', 'AI']),
    intent: z.string().min(1), intensity: z.number().finite().min(0).max(1),
  })).min(1),
});

export default async function (fastify: FastifyInstance) {
  fastify.post('/harmonize', async (request, reply) => {
    const parsed = intentsSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Intents data is required' });
    return await intentExecutionService.harmonizeIntents(parsed.data.intents);
  });

  fastify.get('/status', async () => {
    return await intentExecutionService.getCollectiveStatus();
  });
}
