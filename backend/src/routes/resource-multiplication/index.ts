import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { resourceMultiplicationService } from '../../modules/orchestration/resourceMultiplication.service.js';

const opportunitiesSchema = z.object({
  opportunities: z.array(z.object({
    type: z.enum(['ARBITRAGE', 'TRADING', 'SERVICE_PROVISION']),
    asset: z.string().trim().min(1),
    potentialProfit: z.number().finite(),
    riskScore: z.number().finite().min(0).max(1),
  })).min(1),
});

export default async function (fastify: FastifyInstance) {
  fastify.post('/execute', async (request, reply) => {
    const parsed = opportunitiesSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Opportunities are required' });
    return await resourceMultiplicationService.executeMultiplication(parsed.data.opportunities);
  });

  fastify.get('/status', async () => {
    return await resourceMultiplicationService.getMultiplicationStatus();
  });
}
