import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { latencyService } from '../../modules/latency/latency.service.js';

const causalEventSchema = z.object({ id: z.string().trim().min(1).optional(), sourceNode: z.string().trim().min(1), causalParents: z.array(z.string()), payload: z.unknown(), timestamp: z.number().finite() });
const eventSchema = z.object({ eventData: causalEventSchema.omit({ id: true }) });
const resolveSchema = z.object({ eventA: causalEventSchema.required({ id: true }), eventB: causalEventSchema.required({ id: true }) });
const nodeParamsSchema = z.object({ nodeId: z.string().trim().min(1) });

const latencyRoutes: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.post('/event', async (request, reply) => {
    const parsed = eventSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid causal event' });
    return await latencyService.registerCausalEvent(parsed.data.eventData);
  });

  fastify.post('/resolve', async (request, reply) => {
    const parsed = resolveSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid causal events' });
    return await latencyService.resolveDivergence(parsed.data.eventA, parsed.data.eventB);
  });

  fastify.get('/status/:nodeId', async (request, reply) => {
    const parsed = nodeParamsSchema.safeParse(request.params);
    if (!parsed.success) return reply.code(400).send({ error: 'nodeId is required' });
    return latencyService.getLightConeStatus(parsed.data.nodeId);
  });
};

export default latencyRoutes;
