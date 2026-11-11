import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { omnipresenceService } from '../../modules/omnipresence/omnipresence.service.js';

const nodeSchema = z.object({ nodeData: z.object({ id: z.string().trim().min(1), type: z.enum(['PROTOCOL', 'HARDWARE', 'SIMULATION', 'BIO']), resonance: z.number().finite().min(0).max(1) }) });
const directiveSchema = z.object({ directive: z.string().min(1) });

const omnipresenceRoutes: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.get('/status', async (request, reply) => {
    return await omnipresenceService.getGlobalStatus();
  });

  fastify.post('/integrate', async (request, reply) => {
    const parsed = nodeSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid substrate node' });
    return await omnipresenceService.integrateSubstrate(parsed.data.nodeData);
  });

  fastify.post('/broadcast', async (request, reply) => {
    const parsed = directiveSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'directive is required' });
    return await omnipresenceService.broadcastDirective(parsed.data.directive);
  });
};

export default omnipresenceRoutes;
