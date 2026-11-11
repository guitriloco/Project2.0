import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { energySovereigntyService } from '../../modules/orchestration/energySovereignty.service.js';

const telemetrySchema = z.object({
  telemetry: z.array(z.object({
    nodeId: z.string().trim().min(1),
    consumptionKw: z.number().finite().nonnegative(),
    renewableRatio: z.number().finite().min(0).max(1),
    carbonOffsetTons: z.number().finite().nonnegative(),
  })).min(1),
});

export default async function (fastify: FastifyInstance) {
  fastify.post('/optimize', async (request, reply) => {
    const parsed = telemetrySchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Telemetry data is required' });
    return await energySovereigntyService.optimizeEnergyUsage(parsed.data.telemetry);
  });

  fastify.get('/status', async () => {
    return await energySovereigntyService.getSovereigntyStatus();
  });
}
