import { FastifyInstance } from 'fastify';
import { z } from 'zod';

const syncSchema = z.object({ collaborators: z.array(z.object({ id: z.string(), type: z.enum(['HUMAN', 'AI']), focusLevel: z.number(), currentTask: z.string(), neuralResonance: z.number().min(0).max(1) })) });
import { workflowSyncService, type CollaboratorState } from '../../modules/orchestration/workflowSync.service.js';
import { asJson } from '../../lib/json.js';

export default async function (fastify: FastifyInstance) {
  fastify.post('/sync', async (request, reply) => {
    const parsed = syncSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Collaborator states are required' });
    const collaborators: CollaboratorState[] = parsed.data.collaborators;
    return await workflowSyncService.synchronizeWorkflows(collaborators);
  });

  fastify.get('/status', async () => {
    return await workflowSyncService.getSyncStatus();
  });
}
