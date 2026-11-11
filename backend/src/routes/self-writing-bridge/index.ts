import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { selfWritingBridgeService } from '../../modules/orchestration/selfWritingBridge.service.js';

const sampleSchema = z.object({
  sample: z.object({
    protocolId: z.string().trim().min(1),
    rawData: z.string().min(1),
    context: z.string().min(1),
  }),
});

export default async function (fastify: FastifyInstance) {
  fastify.post('/synthesize', async (request, reply) => {
    const parsed = sampleSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Protocol sample is required' });
    return await selfWritingBridgeService.synthesizeTranslator(parsed.data.sample);
  });

  fastify.get('/status', async () => {
    return await selfWritingBridgeService.getKernelStatus();
  });
}
