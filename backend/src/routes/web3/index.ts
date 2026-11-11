import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { web3Service } from '../../modules/web3/web3.service.js';

const addressSchema = z.object({ address: z.string().trim().min(1) });
const contentSchema = z.object({ content: z.unknown().refine((value) => value !== undefined && value !== null && value !== '', 'Content is required') });

export default async function (fastify: FastifyInstance) {
  fastify.post('/resolve', async (request, reply) => {
    const parsed = addressSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Address is required' });
    return await web3Service.resolveIdentity(parsed.data.address);
  });

  fastify.post('/ipfs/upload', async (request, reply) => {
    const parsed = contentSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Content is required' });
    return await web3Service.uploadToIPFS(parsed.data.content);
  });

  fastify.get('/metrics', async () => {
    return await web3Service.getSovereigntyMetrics();
  });
}
