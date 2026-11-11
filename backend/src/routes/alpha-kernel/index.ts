import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { alphaKernelService } from '../../modules/orchestration/alphaKernel.service.js';

const consolidateSchema = z.object({
  source: z.object({
    coreAxioms: z.array(z.string().min(1)),
    universalConstants: z.record(z.string(), z.number().finite()),
    logicBase: z.string().min(1),
  }),
});

export default async function (fastify: FastifyInstance) {
  fastify.post('/consolidate', async (request, reply) => {
    const parsed = consolidateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Source is required' });
    return await alphaKernelService.consolidateAlphaKernel(parsed.data.source);
  });

  fastify.get('/status', async () => {
    return await alphaKernelService.getAlphaStatus();
  });
}
