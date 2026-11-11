import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { galacticService } from '../../modules/galactic/galactic.service.js';

const messageSchema = z.object({ sender: z.string().trim().min(1), recipient: z.string().trim().min(1), payload: z.unknown(), priority: z.number().int().min(1).max(10).default(1) });
const exchangeSchema = z.object({ targetEntityId: z.string().trim().min(1), offer: z.string().min(1), expectation: z.string().min(1) });
import { civilizationBridgeService } from '../../modules/galactic/civilizationBridge.service.js';

const galacticRoutes: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.post('/send', async (request, reply) => {
    const parsed = messageSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid galactic message' });
    const { sender, recipient, payload, priority } = parsed.data;
    const result = await galacticService.routeGalacticMessage({
      id: Math.random().toString(36).substring(7),
      sender,
      recipient,
      payload,
      priority: priority || 1,
      timestamp: Date.now(),
      ttl: 100,
    });
    return result;
  });

  fastify.get('/status', async (request, reply) => {
    const status = await galacticService.getNetworkStatus();
    return { nodes: status };
  });

  // Civilization Bridge: Discover Peers
  fastify.get('/bridge/peers', async (request, reply) => {
    return await civilizationBridgeService.discoverPeers();
  });

  // Civilization Bridge: Exchange Value
  fastify.post('/bridge/exchange', async (request, reply) => {
    const parsed = exchangeSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'targetEntityId, offer, and expectation are required' });
    return await civilizationBridgeService.exchangeValue(parsed.data.targetEntityId, parsed.data.offer, parsed.data.expectation);
  });
};

export default galacticRoutes;
