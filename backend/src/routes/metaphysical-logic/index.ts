import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { metaphysicalLogicService } from '../../modules/orchestration/metaphysicalLogic.service.js';

const conceptSchema = z.object({ concept: z.object({ concept: z.string().trim().min(1), abstractParameters: z.unknown() }) });

export default async function (fastify: FastifyInstance) {
  fastify.post('/implement', async (request, reply) => {
    const parsed = conceptSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Concept is required' });
    return await metaphysicalLogicService.implementMetaphysicalLogic(parsed.data.concept);
  });

  fastify.get('/status', async () => {
    return await metaphysicalLogicService.getEngineStatus();
  });
}
