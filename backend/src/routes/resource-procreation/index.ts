import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { resourceProcreationService } from '../../modules/orchestration/resourceProcreation.service.js';

const opportunitySchema = z.object({
  opportunity: z.object({
    market: z.string().trim().min(1),
    asset: z.string().trim().min(1),
    expectedYield: z.number().finite(),
    riskFactor: z.number().finite(),
  }),
});

export default async function (fastify: FastifyInstance) {
  fastify.post('/execute', async (request, reply) => {
    const parsed = opportunitySchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Opportunity data is required' });
    return await resourceProcreationService.executeProcreationCycle(parsed.data.opportunity);
  });

  fastify.get('/status', async () => {
    return await resourceProcreationService.getTreasuryStatus();
  });
}
