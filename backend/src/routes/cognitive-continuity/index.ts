import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { cognitiveContinuityService } from '../../modules/orchestration/cognitiveContinuity.service.js';

const snapshotSchema = z.object({ snapshot: z.object({ version: z.string().trim().min(1), stateHash: z.string().trim().min(1), ethicalRoot: z.string().trim().min(1) }) });

export default async function (fastify: FastifyInstance) {
  fastify.post('/preserve', async (request, reply) => {
    const parsed = snapshotSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Snapshot data is required' });
    return await cognitiveContinuityService.preserveContinuity({ ...parsed.data.snapshot, timestamp: Date.now() });
  });

  fastify.get('/status', async () => {
    return await cognitiveContinuityService.getContinuityStatus();
  });
}
