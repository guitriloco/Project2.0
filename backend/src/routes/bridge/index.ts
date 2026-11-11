import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { protocolBridgeService } from '../../modules/bridge/protocolBridge.service.js';

const translateSchema = z.object({ apiDescription: z.string().trim().min(1) });

export default async function (fastify: FastifyInstance) {
  fastify.post('/translate', async (request, reply) => {
    const parsed = translateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'API description is required' });
    return await protocolBridgeService.translateProtocol(parsed.data.apiDescription);
  });

  fastify.get('/status', async () => {
    return await protocolBridgeService.getBridgeStatus();
  });
}
