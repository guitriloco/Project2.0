import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { cognitiveBridgeService } from '../../modules/science/bridge.service.js';

const quantumSchema = z.object({ intent: z.string().trim().min(1), targetReality: z.enum(['DIGITAL', 'PHYSICAL', 'QUANTUM', 'BIO']), stateData: z.unknown() });

const bridgeRoutes: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.get('/status', async (request, reply) => {
    return await cognitiveBridgeService.getSyncStatus();
  });

  fastify.post('/translocate', async (request, reply) => {
    const parsed = quantumSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid quantum data' });
    return await cognitiveBridgeService.translocateCognition(parsed.data);
  });
};

export default bridgeRoutes;
