import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { codeSynthesisService } from '../../modules/science/codeSynthesis.service.js';

const optimizeSchema = z.object({ modulePath: z.string().trim().min(1), code: z.string().min(1) });

export default async function (fastify: FastifyInstance) {
  fastify.post('/optimize', async (request, reply) => {
    const parsed = optimizeSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'modulePath and code are required' });
    return await codeSynthesisService.optimizeLogic(parsed.data.modulePath, parsed.data.code);
  });

  fastify.get('/status', async () => {
    return await codeSynthesisService.scanStructuralRedundancies();
  });
}
