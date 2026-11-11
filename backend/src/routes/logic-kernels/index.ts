import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { logicKernelsService } from '../../modules/orchestration/logicKernels.service.js';

const paradigmSchema = z.object({ paradigm: z.object({ name: z.string().trim().min(1), description: z.string().min(1), sourceCode: z.string().min(1), complexity: z.number().finite().nonnegative() }) });

export default async function (fastify: FastifyInstance) {
  fastify.post('/synthesize', async (request, reply) => {
    const parsed = paradigmSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Paradigm data is required' });
    return await logicKernelsService.synthesizeLogicKernel(parsed.data.paradigm);
  });

  fastify.get('/status', async () => {
    return await logicKernelsService.getEngineStatus();
  });
}
