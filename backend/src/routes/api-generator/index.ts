import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { apiGeneratorService } from '../../modules/orchestration/apiGenerator.service.js';

const generateSchema = z.object({
  spec: z.object({
    name: z.string().trim().min(1),
    method: z.enum(['GET', 'POST', 'PUT', 'DELETE']),
    path: z.string().trim().min(1),
    description: z.string().min(1),
    requiredData: z.array(z.string().min(1)),
  }),
});

export default async function (fastify: FastifyInstance) {
  fastify.post('/generate', async (request, reply) => {
    const parsed = generateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'API specification is required' });
    return await apiGeneratorService.generateAPI(parsed.data.spec);
  });

  fastify.get('/needs', async () => {
    return await apiGeneratorService.scanForIntegrationNeeds();
  });

  fastify.get('/status', async () => {
    return {
      layer: 'Self-Generating API Engine',
      status: 'ACTIVE',
      dynamicRegistration: 'ENABLED'
    };
  });
}
