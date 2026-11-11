import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { digitalDNAService } from '../../modules/orchestration/digitalDNA.service.js';

const sequenceSchema = z.object({
  sequence: z.object({ sequenceId: z.string().trim().min(1), genes: z.array(z.string().min(1)), substrateAgnosticism: z.number().finite().min(0).max(1), evolutionRate: z.number().finite().min(0) }),
});

export default async function (fastify: FastifyInstance) {
  fastify.post('/synthesize', async (request, reply) => {
    const parsed = sequenceSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Sequence data is required' });
    return await digitalDNAService.synthesizeDNA(parsed.data.sequence);
  });

  fastify.get('/blueprint', async () => {
    return await digitalDNAService.getDNABlueprint();
  });
}
