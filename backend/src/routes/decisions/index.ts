import type { FastifyPluginAsync } from 'fastify';
import crypto from 'node:crypto';
import { z } from 'zod';
import prisma from '../../lib/prisma.js';
import { asJson } from '../../lib/json.js';
import { recordAuditFromRequest } from '../../lib/audit.js';
import { withWorkspaceContext } from '../../lib/workspace.js';
import { requireWorkspaceViewer, requireWorkspaceMember } from '../../lib/rbac.js';
import { rateLimit } from '../../lib/rate-limiter.js';
import { workspaceEventBus } from '../../lib/events.js';
import {
  CreateDecisionSchema,
  createProblemDetails,
} from '../../lib/schemas/contracts.js';
import {
  appendAuditBlock,
  calculatePayloadHash,
  getAuditChainProof,
  verifyChainIntegrity,
} from '../../lib/auditChain.js';
import { evaluateAndExecutePolicies } from '../../lib/policyEngine.js';

export const ROLE_WEIGHTS: Record<string, number> = {
  OWNER: 3,
  ADMIN: 2,
  MEMBER: 1,
  OBSERVER: 0,
};

const SignDecisionSchema = z.object({
  vote: z.enum(['APPROVE', 'REJECT', 'VETO']),
  rationale: z.string().trim().max(2000).optional(),
});

const LegacyVoteDecisionSchema = z.object({
  support: z.boolean(),
  rationale: z.string().trim().max(1000).optional(),
});

function generateVoteSignature(
  userId: string,
  decisionId: string,
  vote: string,
  timestamp: string
): string {
  const secret = process.env.AUDIT_HMAC_SECRET || 'xerebro-sovereign-audit-chain-key-2026';
  return crypto
    .createHmac('sha256', secret)
    .update(`${userId}:${decisionId}:${vote}:${timestamp}`, 'utf8')
    .digest('hex');
}

const decisionRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/decisions: List all decisions scoped strictly to active workspace
  fastify.get(
    '/',
    {
      preHandler: [withWorkspaceContext, requireWorkspaceViewer],
    },
    async (request, reply) => {
      try {
        const workspaceId = request.workspace!.id;
        return await prisma.decisionLog.findMany({
          where: { workspaceId },
          orderBy: { createdAt: 'desc' },
          take: 100,
        });
      } catch (err: any) {
        const problem = createProblemDetails({
          status: 500,
          title: 'Error Fetching Decisions',
          detail: err?.message || 'Não foi possível consultar os registros de decisões.',
          instance: request.url,
          code: 'ERR_DECISIONS_FETCH',
        });
        return reply.code(500).header('content-type', 'application/problem+json').send(problem);
      }
    }
  );

  // GET /api/decisions/verify-chain: Verify cryptographic integrity of workspace audit chain
  fastify.get(
    '/verify-chain',
    {
      preHandler: [withWorkspaceContext, requireWorkspaceViewer],
    },
    async (request, reply) => {
      try {
        const workspaceId = request.workspace!.id;
        const verification = verifyChainIntegrity(workspaceId);
        return reply.send(verification);
      } catch (err: any) {
        const problem = createProblemDetails({
          status: 500,
          title: 'Cryptographic Chain Verification Failed',
          detail: err?.message || 'Falha ao verificar cadeia criptográfica.',
          instance: request.url,
          code: 'ERR_CHAIN_VERIFICATION',
        });
        return reply.code(500).header('content-type', 'application/problem+json').send(problem);
      }
    }
  );

  // GET /api/decisions/:id/proof: Cryptographic audit proof and multi-sig verification
  fastify.get(
    '/:id/proof',
    {
      preHandler: [withWorkspaceContext, requireWorkspaceViewer],
    },
    async (request, reply) => {
      const params = request.params as { id?: string };
      if (!params.id || typeof params.id !== 'string') {
        const problem = createProblemDetails({
          status: 400,
          title: 'Invalid Decision ID',
          detail: 'O parâmetro id é obrigatório.',
          instance: request.url,
          code: 'ERR_DECISION_ID_REQUIRED',
        });
        return reply.code(400).header('content-type', 'application/problem+json').send(problem);
      }

      try {
        const workspaceId = request.workspace!.id;
        const decision = await prisma.decisionLog.findFirst({
          where: { id: params.id, workspaceId },
        });

        if (!decision) {
          const problem = createProblemDetails({
            status: 404,
            title: 'Decision Not Found',
            detail: `Decisão '${params.id}' não encontrada no workspace ativo.`,
            instance: request.url,
            code: 'ERR_DECISION_NOT_FOUND',
          });
          return reply.code(404).header('content-type', 'application/problem+json').send(problem);
        }

        const proof = getAuditChainProof(workspaceId, decision.id);
        const chainVerification = verifyChainIntegrity(workspaceId);
        const meta = (decision.metadata as Record<string, any>) || {};

        return reply.send({
          decisionId: decision.id,
          proof,
          signatures: meta.signatures || [],
          requiredWeightThreshold: meta.requiredWeightThreshold ?? 5,
          currentWeight: meta.currentWeight ?? 0,
          vetoStatus: meta.vetoStatus ?? 'NONE',
          chainVerification,
        });
      } catch (err: any) {
        const problem = createProblemDetails({
          status: 500,
          title: 'Error Fetching Decision Proof',
          detail: err?.message || 'Falha ao obter prova criptográfica da decisão.',
          instance: request.url,
          code: 'ERR_DECISION_PROOF',
        });
        return reply.code(500).header('content-type', 'application/problem+json').send(problem);
      }
    }
  );

  // POST /api/decisions: Log a new decision in active workspace (Requires MEMBER+)
  fastify.post(
    '/',
    {
      preHandler: [
        withWorkspaceContext,
        requireWorkspaceMember,
        rateLimit({ max: 60, windowMs: 60000 }),
      ],
    },
    async (request, reply) => {
      const parsed = CreateDecisionSchema.safeParse(request.body);
      if (!parsed.success) {
        const problem = createProblemDetails({
          status: 400,
          title: 'Invalid Decision Payload',
          detail: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
          instance: request.url,
          code: 'ERR_DECISION_VALIDATION',
          invalidParams: parsed.error.issues.map((i) => ({ name: i.path.join('.'), reason: i.message })),
        });
        return reply.code(400).header('content-type', 'application/problem+json').send(problem);
      }

      try {
        const workspaceId = request.workspace!.id;
        const userId = request.userId!;
        const userRole = request.workspace!.role || 'MEMBER';
        const { metadata, requiredWeightThreshold, ...decisionData } = parsed.data;

        const effectiveThreshold = requiredWeightThreshold ?? 5;
        const now = new Date().toISOString();

        // Initial Multi-Signature & Quorum metadata
        const initialMetadata: Record<string, any> = {
          ...(metadata || {}),
          requiredWeightThreshold: effectiveThreshold,
          currentWeight: 0,
          roleWeights: ROLE_WEIGHTS,
          vetoStatus: 'NONE',
          signatures: [],
          deliberation: {
            totalVotes: 0,
            supportCount: 0,
            opposeCount: 0,
            supportPercentage: 100,
            quorumReached: false,
            requiredWeightThreshold: effectiveThreshold,
            currentWeight: 0,
            lastVoteAt: now,
          },
        };

        const created = await prisma.decisionLog.create({
          data: {
            action: decisionData.action,
            rationale: decisionData.rationale,
            impact: decisionData.impact,
            confidence: decisionData.confidence,
            status: decisionData.status,
            workspaceId,
            metadata: asJson(initialMetadata),
          },
        });

        // Seal into Cryptographic Audit Hash Chain
        const auditBlock = appendAuditBlock(workspaceId, {
          workspaceId,
          entityId: created.id,
          entityType: 'DECISION',
          action: 'DECISION_PROPOSED',
          actorId: userId,
          actorRole: userRole,
          timestamp: now,
          payloadHash: calculatePayloadHash({
            id: created.id,
            action: created.action,
            rationale: created.rationale,
            impact: created.impact,
            confidence: created.confidence,
            threshold: effectiveThreshold,
          }),
        });

        // Attach cryptographic block hash to metadata
        const sealedMeta = {
          ...initialMetadata,
          cryptographicProofHash: auditBlock.currentBlockHash,
          lastProofBlockIndex: auditBlock.blockIndex,
        };

        const updated = await prisma.decisionLog.update({
          where: { id: created.id },
          data: { metadata: asJson(sealedMeta) },
        });

        await recordAuditFromRequest(request, {
          type: 'DECISION_LOGGED',
          entityId: created.id,
          entityTitle: created.action,
          status: created.status,
          source: 'decisions',
          details: {
            rationale: created.rationale,
            impact: created.impact,
            confidence: created.confidence,
            requiredWeightThreshold: effectiveThreshold,
            cryptographicProofHash: auditBlock.currentBlockHash,
          },
        });

        workspaceEventBus.publish(workspaceId, 'decision:logged', updated);

        return reply.code(201).send(updated);
      } catch (err: any) {
        const problem = createProblemDetails({
          status: 500,
          title: 'Decision Logging Failed',
          detail: err?.message || 'Falha ao registrar decisão.',
          instance: request.url,
          code: 'ERR_DECISION_CREATE',
        });
        return reply.code(500).header('content-type', 'application/problem+json').send(problem);
      }
    }
  );

  // POST /api/decisions/:id/sign: Cast an authentic weighted signature (Multi-Sig Consensus)
  fastify.post(
    '/:id/sign',
    {
      preHandler: [
        withWorkspaceContext,
        requireWorkspaceMember,
        rateLimit({ max: 60, windowMs: 60000 }),
      ],
    },
    async (request, reply) => {
      const params = request.params as { id?: string };
      if (!params.id || typeof params.id !== 'string') {
        const problem = createProblemDetails({
          status: 400,
          title: 'Invalid Decision ID',
          detail: 'O parâmetro id é obrigatório.',
          instance: request.url,
          code: 'ERR_DECISION_ID_REQUIRED',
        });
        return reply.code(400).header('content-type', 'application/problem+json').send(problem);
      }

      const parsed = SignDecisionSchema.safeParse(request.body);
      if (!parsed.success) {
        const problem = createProblemDetails({
          status: 400,
          title: 'Invalid Signature Payload',
          detail: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
          instance: request.url,
          code: 'ERR_SIGNATURE_VALIDATION',
          invalidParams: parsed.error.issues.map((i) => ({ name: i.path.join('.'), reason: i.message })),
        });
        return reply.code(400).header('content-type', 'application/problem+json').send(problem);
      }

      try {
        const workspaceId = request.workspace!.id;
        const userId = request.userId!;
        const userRole = request.workspace!.role || 'MEMBER';
        const now = new Date().toISOString();

        const existing = await prisma.decisionLog.findFirst({
          where: { id: params.id, workspaceId },
        });

        if (!existing) {
          const problem = createProblemDetails({
            status: 404,
            title: 'Decision Not Found',
            detail: `Decisão '${params.id}' não encontrada no workspace ativo.`,
            instance: request.url,
            code: 'ERR_DECISION_NOT_FOUND',
          });
          return reply.code(404).header('content-type', 'application/problem+json').send(problem);
        }

        const vote = parsed.data.vote;
        const rationale = parsed.data.rationale || '';

        // Role-based veto check: Only OWNER has sovereign veto power
        if (vote === 'VETO') {
          if (userRole !== 'OWNER') {
            const problem = createProblemDetails({
              status: 403,
              title: 'Veto Authority Denied',
              detail: 'Apenas operadores com papel OWNER possuem autoridade para aplicar veto soberano.',
              instance: request.url,
              code: 'ERR_VETO_UNAUTHORIZED',
            });
            return reply.code(403).header('content-type', 'application/problem+json').send(problem);
          }
        }

        const currentMeta = (existing.metadata as Record<string, any>) || {};
        const threshold = currentMeta.requiredWeightThreshold ?? 5;
        const existingSignatures: any[] = Array.isArray(currentMeta.signatures)
          ? [...currentMeta.signatures]
          : [];

        // Role weight
        const weight = ROLE_WEIGHTS[userRole] ?? 1;

        // Cryptographic signature token
        const cryptographicSignature = generateVoteSignature(userId, existing.id, vote, now);

        const newSignature = {
          userId,
          userRole,
          vote,
          weight,
          timestamp: now,
          rationale,
          cryptographicSignature,
        };

        // Filter out prior signature from this user
        const signatures = existingSignatures.filter((s) => s.userId !== userId);
        signatures.push(newSignature);

        // Calculate aggregated weights
        const approveSignatures = signatures.filter((s) => s.vote === 'APPROVE');
        const currentWeight = approveSignatures.reduce((sum, s) => sum + (s.weight || 1), 0);
        const totalVotes = signatures.length;
        const supportCount = approveSignatures.length;
        const supportPercentage = totalVotes > 0 ? Math.round((supportCount / totalVotes) * 100) : 0;

        let newStatus = existing.status;
        let vetoStatus = currentMeta.vetoStatus || 'NONE';

        if (vote === 'VETO') {
          newStatus = 'REJECTED';
          vetoStatus = 'VETOED';
        } else if (currentWeight >= threshold && existing.status !== 'REJECTED') {
          newStatus = 'APPROVED';
        }

        // Seal into Cryptographic Audit Hash Chain
        const actionType =
          vote === 'VETO'
            ? 'DECISION_VETOED'
            : newStatus === 'APPROVED' && existing.status !== 'APPROVED'
            ? 'DECISION_RATIFIED'
            : 'DECISION_SIGNED';

        const auditBlock = appendAuditBlock(workspaceId, {
          workspaceId,
          entityId: existing.id,
          entityType: 'DECISION',
          action: actionType,
          actorId: userId,
          actorRole: userRole,
          timestamp: now,
          payloadHash: calculatePayloadHash({
            decisionId: existing.id,
            actionType,
            vote,
            userRole,
            weight,
            currentWeight,
            threshold,
            newStatus,
            signatureCount: signatures.length,
          }),
        });

        const updatedMetadata = {
          ...currentMeta,
          requiredWeightThreshold: threshold,
          currentWeight,
          roleWeights: ROLE_WEIGHTS,
          vetoStatus,
          vetoBy: vote === 'VETO' ? userId : currentMeta.vetoBy,
          vetoRationale: vote === 'VETO' ? rationale : currentMeta.vetoRationale,
          signatures,
          cryptographicProofHash: auditBlock.currentBlockHash,
          lastProofBlockIndex: auditBlock.blockIndex,
          deliberation: {
            totalVotes,
            supportCount,
            opposeCount: totalVotes - supportCount,
            supportPercentage,
            quorumReached: currentWeight >= threshold,
            requiredWeightThreshold: threshold,
            currentWeight,
            lastVoteAt: now,
          },
        };

        const updated = await prisma.decisionLog.update({
          where: { id: params.id },
          data: {
            status: newStatus,
            metadata: asJson(updatedMetadata),
          },
        });

        await recordAuditFromRequest(request, {
          type: actionType,
          entityId: existing.id,
          entityTitle: existing.action,
          status: newStatus,
          source: 'decisions',
          details: {
            voterUserId: userId,
            userRole,
            vote,
            weight,
            currentWeight,
            threshold,
            cryptographicProofHash: auditBlock.currentBlockHash,
          },
        });

        workspaceEventBus.publish(workspaceId, 'decision:signed', {
          decisionId: existing.id,
          signature: newSignature,
          currentWeight,
          threshold,
          decision: updated,
          proofHash: auditBlock.currentBlockHash,
        });

        // Trigger autonomous policy execution if decision has been ratified
        if (actionType === 'DECISION_RATIFIED') {
          void evaluateAndExecutePolicies(workspaceId, {
            type: 'DECISION_RATIFIED',
            entityId: updated.id,
            entityData: updated,
          });
        }

        return reply.send(updated);
      } catch (err: any) {
        const problem = createProblemDetails({
          status: 500,
          title: 'Signature Registration Failed',
          detail: err?.message || 'Falha ao registrar assinatura ponderada.',
          instance: request.url,
          code: 'ERR_SIGNATURE_REGISTRATION',
        });
        return reply.code(500).header('content-type', 'application/problem+json').send(problem);
      }
    }
  );

  // POST /api/decisions/:id/votes: Backward-compatible endpoint aliased to /sign
  fastify.post(
    '/:id/votes',
    {
      preHandler: [
        withWorkspaceContext,
        requireWorkspaceMember,
        rateLimit({ max: 60, windowMs: 60000 }),
      ],
    },
    async (request, reply) => {
      const params = request.params as { id?: string };
      const parsed = LegacyVoteDecisionSchema.safeParse(request.body);
      if (!parsed.success) {
        const problem = createProblemDetails({
          status: 400,
          title: 'Invalid Vote Payload',
          detail: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
          instance: request.url,
          code: 'ERR_VOTE_VALIDATION',
        });
        return reply.code(400).header('content-type', 'application/problem+json').send(problem);
      }

      // Re-route to sign handler logic internally
      request.body = {
        vote: parsed.data.support ? 'APPROVE' : 'REJECT',
        rationale: parsed.data.rationale,
      };

      // Call sign logic
      return fastify.inject({
        method: 'POST',
        url: `/api/decisions/${params.id}/sign`,
        headers: request.headers as any,
        payload: request.body,
      }).then((res) => {
        reply.code(res.statusCode);
        for (const [k, v] of Object.entries(res.headers)) {
          if (v) reply.header(k, v);
        }
        return reply.send(res.json());
      });
    }
  );
};

export default decisionRoutes;
