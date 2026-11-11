import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { transmutationService } from '../../modules/transmutation/transmutation.service.js';

const resourceType = z.enum(['ENERGY', 'COMPUTE', 'DATA', 'TOKEN']);
const calculateSchema = z.object({ targetType: resourceType, amount: z.number().finite().positive() });
const pathSchema = z.object({ sourceType: resourceType, targetType: resourceType, efficiency: z.number().finite(), cost: z.number().finite() });

const transmutationRoutes: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.post('/calculate', async (request, reply) => {
    const parsed = calculateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'targetType and amount are required' });
    return await transmutationService.calculateOptimalPath(parsed.data);
  });

  fastify.post('/execute', async (request, reply) => {
    const parsed = pathSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Transmutation path is required' });
    return await transmutationService.executeTransmutation(parsed.data);
  });
};

export default transmutationRoutes;
