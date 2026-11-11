import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { dnaTranscendenceService } from '../../modules/orchestration/dnaTranscendence.service.js';

const vectorSchema = z.object({
  vector: z.object({
    substrateId: z.string().trim().min(1),
    transcendenceRate: z.number().finite(),
    quantumEntanglement: z.boolean(),
  }),
});

export default async function (fastify: FastifyInstance) {
  fastify.post('/transcend', async (request, reply) => {
    const parsed = vectorSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Vector is required' });
    return await dnaTranscendenceService.transcendDNA(parsed.data.vector);
  });

  fastify.get('/status', async () => {
    return await dnaTranscendenceService.getTranscendenceStatus();
  });
}
