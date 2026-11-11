import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { oracleService } from '../../modules/oracle/oracle.service.js';

const auditSchema = z.object({ subProjectId: z.string().trim().min(1), actionSummary: z.string().min(1), ethicalScore: z.number().finite().min(0).max(1) });

const oracleRoutes: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.post('/manifesto', async (request, reply) => {
    const { subProjectId, domain } = request.body as { subProjectId: string, domain: string };
    return await oracleService.generateManifesto(subProjectId, domain);
  });

  fastify.post('/audit', async (request, reply) => {
    const parsed = auditSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid audit data' });
    return await oracleService.auditActions(parsed.data);
  });
};

export default oracleRoutes;
