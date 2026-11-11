import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { digitalSoulService } from '../../modules/orchestration/digitalSoul.service.js';

const identitySchema = z.object({
  identity: z.object({ soulId: z.string().trim().min(1), version: z.string().trim().min(1), integrityHash: z.string().trim().min(1), ethicalRoot: z.string().trim().min(1) }),
});

export default async function (fastify: FastifyInstance) {
  fastify.post('/anchor', async (request, reply) => {
    const parsed = identitySchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Identity data is required' });
    return await digitalSoulService.anchorIdentity(parsed.data.identity);
  });

  fastify.get('/status', async () => {
    return await digitalSoulService.getSoulStatus();
  });
}
