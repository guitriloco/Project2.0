import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { intentHarmonizationService } from '../../modules/orchestration/intentHarmonization.service.js';

const intentsSchema = z.object({
  intents: z.array(z.object({
    id: z.string().trim().min(1),
    type: z.enum(['HUMAN', 'AI']),
    intentVector: z.array(z.number().finite()),
    timestamp: z.number().finite(),
  })).min(1),
});

export default async function (fastify: FastifyInstance) {
  fastify.post('/harmonize', async (request, reply) => {
    const parsed = intentsSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Intents data is required' });
    return await intentHarmonizationService.harmonizeField(parsed.data.intents);
  });

  fastify.get('/status', async () => {
    return await intentHarmonizationService.getFieldStatus();
  });
}
