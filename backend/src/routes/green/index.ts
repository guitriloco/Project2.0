import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { greenComputingService } from '../../modules/green/green-computing.service.js';

const scheduleSchema = z.object({
  taskName: z.string().trim().min(1),
  resourceRequirement: z.number().finite().positive(),
});

const greenRoutes: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.post('/schedule', async (request, reply) => {
    const parsed = scheduleSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'taskName and resourceRequirement are required' });
    const result = await greenComputingService.scheduleGreenTask(parsed.data.taskName, parsed.data.resourceRequirement);
    return result;
  });

  fastify.get('/nodes', async (request, reply) => {
    const nodes = await greenComputingService.getAvailableNodes();
    return { nodes };
  });
};

export default greenRoutes;
