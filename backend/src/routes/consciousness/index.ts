import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { consciousnessService } from '../../modules/consciousness/consciousness.service.js';

const incomingStateSchema = z.object({
  incomingState: z.object({
    version: z.number().finite(),
    region: z.string().trim().min(1),
    priorities: z.array(z.string().min(1)),
    ethicalVibe: z.number().finite().min(0).max(1),
    activeGoals: z.array(z.string().min(1)),
    timestamp: z.number().finite(),
  }),
});

const consciousnessRoutes: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.get('/state', async (request, reply) => {
    return consciousnessService.getCurrentState();
  });

  fastify.post('/synapse', async (request, reply) => {
    return await consciousnessService.triggerGlobalSynapse();
  });

  fastify.post('/merge', async (request, reply) => {
    const parsed = incomingStateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'incomingState is required' });
    return await consciousnessService.processIncomingSynapse(parsed.data.incomingState);
  });
};

export default consciousnessRoutes;
