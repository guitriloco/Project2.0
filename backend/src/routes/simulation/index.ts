import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { simulationService } from '../../modules/simulation/simulation.service.js';

const scenarioSchema = z.object({
  name: z.string().trim().min(1),
  governanceModel: z.string().trim().min(1),
  environmentalConstraints: z.array(z.string().min(1)),
  economicParameters: z.record(z.string(), z.unknown()),
});

const simulationRoutes: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.post('/run', async (request, reply) => {
    const parsed = scenarioSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Simulation scenario is invalid' });
    const result = await simulationService.runSimulation({
      id: Math.random().toString(36).substring(7),
      ...parsed.data,
    });
    return result;
  });

  fastify.get('/list', async (request, reply) => {
    const simulations = await simulationService.listActiveSimulations();
    return { simulations };
  });
};

export default simulationRoutes;
