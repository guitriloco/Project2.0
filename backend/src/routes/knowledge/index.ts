import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { knowledgeService } from '../../modules/knowledge/knowledge.service.js';

const factsSchema = z.object({ facts: z.array(z.object({ id: z.string().trim().min(1), source: z.string().trim().min(1), content: z.string().min(1), confidence: z.number().finite().min(0).max(1), tags: z.array(z.string()) })) });
const factSchema = z.object({ fact: z.object({ id: z.string().trim().min(1), source: z.string().trim().min(1), content: z.string().min(1), confidence: z.number().finite().min(0).max(1), tags: z.array(z.string()) }) });
const proposalSchema = z.object({ proposal: z.unknown() });
import { meaningSynthesisService } from '../../modules/knowledge/meaningSynthesis.service.js';
import { strategicIntelligenceService } from '../../modules/knowledge/strategicIntelligence.service.js';

const knowledgeRoutes: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.post('/synthesize', async (request, reply) => {
    const parsed = factsSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid facts' });
    return await knowledgeService.synthesizeAbsoluteTruth(parsed.data.facts);
  });

  fastify.post('/ingest', async (request, reply) => {
    const parsed = factSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid fact' });
    return await knowledgeService.ingestFact(parsed.data.fact);
  });

  // Meaning Synthesis: Analyze
  fastify.post('/meaning/analyze', async (request, reply) => {
    return await meaningSynthesisService.synthesizeProjectMeaning();
  });

  // Meaning Synthesis: Alignment
  fastify.get('/meaning/alignment/:proposalId', async (request, reply) => {
    const { proposalId } = request.params as { proposalId: string };
    return await meaningSynthesisService.evaluateMeaningAlignment(proposalId);
  });

  // Strategic Intelligence: Report
  fastify.get('/strategic/report', async (request, reply) => {
    return await strategicIntelligenceService.generateStrategicReport();
  });

  // Strategic Intelligence: Evaluate Proposal
  fastify.post('/strategic/evaluate', async (request, reply) => {
    const parsed = proposalSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid proposal' });
    return await strategicIntelligenceService.evaluateProposal(parsed.data.proposal);
  });
};

export default knowledgeRoutes;
