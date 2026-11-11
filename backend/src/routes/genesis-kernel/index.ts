import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { genesisKernelService } from '../../modules/orchestration/genesisKernel.service.js';

const seedSchema = z.object({
  seed: z.object({
    realityParameters: z.unknown(),
    coreInvariants: z.array(z.string().min(1)),
  }),
});

export default async function (fastify: FastifyInstance) {
  fastify.post('/spawn', async (request, reply) => {
    const parsed = seedSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Seed is required' });
    return await genesisKernelService.spawnReality(parsed.data.seed);
  });

  fastify.get('/status', async () => {
    return await genesisKernelService.getGenesisStatus();
  });
}
