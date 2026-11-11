import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { bioFeedbackService } from '../../modules/biofeedback/biofeedback.service.js';

const signalSchema = z.object({
  heartRate: z.number().finite().positive().optional(),
  focusLevel: z.number().finite().min(0).max(1).optional(),
  stressLevel: z.number().finite().min(0).max(1).optional(),
});

export default async function (fastify: FastifyInstance) {
  fastify.post('/signal', async (request, reply) => {
    const parsed = signalSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid biometric signal' });
    const { heartRate, focusLevel, stressLevel } = parsed.data;
    const result = await bioFeedbackService.processBioData({
      heartRate: heartRate ?? 70,
      focusLevel: focusLevel ?? 0.5,
      stressLevel: stressLevel ?? 0.3,
      timestamp: Date.now()
    });
    return result;
  });

  fastify.get('/state', async () => {
    return await bioFeedbackService.getCognitiveState();
  });

  fastify.get('/status', async () => {
    return {
      layer: 'Bio-Feedback & Cognitive Adaptation',
      status: 'ACTIVE',
      sensorSync: 'ESTABLISHED'
    };
  });
}
