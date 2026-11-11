import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { valueProcreationService } from '../../modules/orchestration/valueProcreation.service.js';

const matrixSchema = z.object({
  matrix: z.object({
    dimensions: z.array(z.string().min(1)),
    depth: z.number().finite(),
    targets: z.array(z.string().min(1)),
  }),
});

export default async function (fastify: FastifyInstance) {
  fastify.post('/execute', async (request, reply) => {
    const parsed = matrixSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Matrix data is required' });
    return await valueProcreationService.executeValueCycle(parsed.data.matrix);
  });

  fastify.get('/status', async () => {
    return await valueProcreationService.getTreasuryStatus();
  });
}
