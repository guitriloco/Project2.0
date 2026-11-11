import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { governanceService } from '../../modules/governance/governance.service.js';

const proposalParamsSchema = z.object({ id: z.string().trim().min(1) });
const proposalSchema = z.object({ title: z.string().trim().min(1), description: z.string().min(1), creatorId: z.string().trim().min(1) });
const voteSchema = z.object({ voterId: z.string().trim().min(1), votes: z.number().int().positive(), support: z.boolean() });
const layerSchema = z.object({ layer: z.enum(['CORE', 'INFRA', 'ECONOMIC']) });
const legalUpdateSchema = z.object({ docType: z.string().trim().min(1), requirements: z.string().min(1) });
const legalSignSchema = z.object({ docId: z.string().trim().min(1), rationale: z.string().min(1) });
import { legalDefenseService } from '../../modules/governance/legalDefense.service.js';
import { legalPersonalityService } from '../../modules/governance/legalPersonality.service.js';
import { estateManager } from '../../modules/finance/estateManager.service.js';
import { heritagePreserverService } from '../../modules/governance/heritagePreserver.service.js';
import prisma from '../../lib/prisma.js';
import { getWorkspaceId } from '../../lib/workspace.js';
import { verifyChainIntegrity } from '../../lib/auditChain.js';

const governanceRoutes: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  // GET /api/governance/verify-chain: Cryptographic chain verification
  fastify.get('/verify-chain', async (request, reply) => {
    const userId = (request as typeof request & { userId: string }).userId;
    const workspaceId = await getWorkspaceId(userId);
    const verification = verifyChainIntegrity(workspaceId);
    return reply.send(verification);
  });

  // Proposals
  fastify.get('/proposals', async (request, reply) => {
    const workspaceId = await getWorkspaceId((request as typeof request & { userId: string }).userId);
    return await prisma.proposal.findMany({
      where: { workspaceId },
      include: { creator: true, _count: { select: { votes: true } } }
    });
  });

  fastify.get('/proposals/:id', async (request, reply) => {
    const parsedParams = proposalParamsSchema.safeParse(request.params);
    if (!parsedParams.success) return reply.code(400).send({ error: 'Proposal id is required' });
    const { id } = parsedParams.data;
    const workspaceId = await getWorkspaceId((request as typeof request & { userId: string }).userId);
    return await prisma.proposal.findFirst({
      where: { id, workspaceId },
      include: { creator: true, votes: true }
    });
  });

  fastify.post('/proposals', async (request, reply) => {
    const parsed = proposalSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'title, description and creatorId are required' });
    const userId = (request as typeof request & { userId: string }).userId;
    const workspaceId = await getWorkspaceId(userId);
    const proposal = await prisma.proposal.create({
      data: { ...parsed.data, creatorId: userId, workspaceId }
    });
    // Trigger AI moderation automatically
    await governanceService.analyzeProposal(proposal.id);
    return proposal;
  });

  // Moderation
  fastify.post('/proposals/:id/analyze', async (request, reply) => {
    const parsedParams = proposalParamsSchema.safeParse(request.params);
    if (!parsedParams.success) return reply.code(400).send({ error: 'Proposal id is required' });
    const { id } = parsedParams.data;
    return await governanceService.analyzeProposal(id);
  });

  // Voting
  fastify.post('/proposals/:id/vote', async (request, reply) => {
    const parsedParams = proposalParamsSchema.safeParse(request.params);
    const parsedBody = voteSchema.safeParse(request.body);
    if (!parsedParams.success || !parsedBody.success) return reply.code(400).send({ error: 'Invalid proposal vote' });
    const { id } = parsedParams.data;
    const { voterId, votes, support } = parsedBody.data;
    return await governanceService.castHumanVote(id, voterId, votes, support);
  });

  fastify.post('/proposals/:id/evaluate', async (request, reply) => {
    const parsedParams = proposalParamsSchema.safeParse(request.params);
    if (!parsedParams.success) return reply.code(400).send({ error: 'Proposal id is required' });
    const { id } = parsedParams.data;
    return await governanceService.evaluateProposal(id);
  });

  fastify.post('/proposals/:id/autonomous-vote', async (request, reply) => {
    const parsedParams = proposalParamsSchema.safeParse(request.params);
    const parsedBody = layerSchema.safeParse(request.body);
    if (!parsedParams.success || !parsedBody.success) return reply.code(400).send({ error: 'Invalid governance layer' });
    return await governanceService.castAutonomousVote(parsedParams.data.id, parsedBody.data.layer);
  });

  // Legal Defense: Scan
  fastify.get('/legal/scan', async (request, reply) => {
    return await legalDefenseService.scanLegalLandscape();
  });

  // Legal Defense: Update Document
  fastify.post('/legal/update-doc', async (request, reply) => {
    const parsed = legalUpdateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'docType and requirements are required' });
    return await legalDefenseService.updateLegalDocument(parsed.data.docType, parsed.data.requirements);
  });

  // Legal Personality: Sign
  fastify.post('/legal/sign', async (request, reply) => {
    const parsed = legalSignSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'docId and rationale are required' });
    return await legalPersonalityService.signSovereignDocument(parsed.data.docId, parsed.data.rationale);
  });

  // Legal Personality: Scout IP
  fastify.get('/legal/scout-ip', async (request, reply) => {
    return await legalPersonalityService.scoutPatentableIP();
  });

  // Digital Estate: Scout Assets
  fastify.get('/estate/scout', async (request, reply) => {
    return await estateManager.scoutAssets();
  });

  // Digital Estate: Lifecycle
  fastify.post('/estate/manage/:assetId', async (request, reply) => {
    const parsedParams = z.object({ assetId: z.string().trim().min(1) }).safeParse(request.params);
    if (!parsedParams.success) return reply.code(400).send({ error: 'assetId is required' });
    return await estateManager.manageAssetLifecycle(parsedParams.data.assetId);
  });

  // Digital Estate: Brand Monitor
  fastify.get('/estate/brand-monitor', async (request, reply) => {
    return await estateManager.monitorBrandSovereignty();
  });

  // Heritage: Archive
  fastify.post('/heritage/archive', async (request, reply) => {
    return await heritagePreserverService.archiveProjectWisdom();
  });

  // Heritage: Status
  fastify.get('/heritage/status', async (request, reply) => {
    return await heritagePreserverService.getHeritageStatus();
  });

  // Events
  fastify.get('/events', async (request, reply) => {
    return await prisma.governanceEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50
    });
  });
};

export default governanceRoutes;
