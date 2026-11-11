import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { communicationService } from '../../modules/communication/communication.service.js';

const decodeSchema = z.object({ signal: z.string().min(1), medium: z.string().trim().min(1) });
const translateSchema = z.object({
  directive: z.string().min(1),
  speciesProfile: z.object({
    id: z.string().trim().min(1), name: z.string().trim().min(1),
    type: z.enum(['BIOLOGICAL', 'SYNTHETIC', 'UNKNOWN']),
    medium: z.string().trim().min(1), ethicalAlignment: z.number().finite().min(0).max(1),
  }),
});

const communicationRoutes: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.post('/decode', async (request, reply) => {
    const parsed = decodeSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'signal and medium are required' });
    return await communicationService.decodeSignal(parsed.data.signal, parsed.data.medium);
  });

  fastify.post('/translate', async (request, reply) => {
    const parsed = translateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'directive and speciesProfile are required' });
    return await communicationService.translateToSpecies(parsed.data.directive, parsed.data.speciesProfile);
  });
};

export default communicationRoutes;
