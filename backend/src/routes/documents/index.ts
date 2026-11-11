import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import prisma from '../../lib/prisma.js';
import { getWorkspaceId } from '../../lib/workspace.js';

const documentInput = z.object({
  title: z.string().trim().min(1).max(200),
  content: z.string().min(1).max(100000),
  version: z.string().trim().min(1).max(40),
  type: z.string().trim().min(1).max(80),
  workspaceId: z.string().trim().min(1).max(120),
});

const documentRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', async (request, reply) => {
    const parsed = z.object({ workspaceId: z.string().trim().min(1).max(120).optional() }).safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: 'Filtro inválido.' });
    const workspaceId = await getWorkspaceId((request as typeof request & { userId: string }).userId);
    return prisma.legalDocument.findMany({
      where: { workspaceId },
      orderBy: { updatedAt: 'desc' },
    });
  });

  fastify.post('/', async (request, reply) => {
    const parsed = documentInput.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Documento inválido.' });
    const workspaceId = await getWorkspaceId((request as typeof request & { userId: string }).userId);
    return prisma.legalDocument.create({ data: { ...parsed.data, workspaceId } });
  });

  fastify.patch('/:id', async (request, reply) => {
    const params = z.object({ id: z.string().min(1) }).safeParse(request.params);
    const parsed = documentInput.partial().safeParse(request.body);
    if (!params.success || !parsed.success) return reply.code(400).send({ error: 'Documento inválido.' });
    try {
      const workspaceId = await getWorkspaceId((request as typeof request & { userId: string }).userId);
      const existing = await prisma.legalDocument.findFirst({ where: { id: params.data.id, workspaceId } });
      if (!existing) return reply.code(404).send({ error: 'Documento não encontrado.' });
      const { workspaceId: _ignored, ...updates } = parsed.data;
      return await prisma.legalDocument.update({ where: { id: params.data.id }, data: updates });
    } catch {
      return reply.code(404).send({ error: 'Documento não encontrado.' });
    }
  });
};

export default documentRoutes;
