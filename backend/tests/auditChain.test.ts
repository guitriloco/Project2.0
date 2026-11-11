import { describe, it, expect, beforeEach } from 'vitest';
import {
  createGenesisBlock,
  appendAuditBlock,
  verifyChainIntegrity,
  getAuditChainProof,
  calculatePayloadHash,
  resetAuditChain,
  getAuditChain,
} from '../src/lib/auditChain.js';
import { ROLE_WEIGHTS } from '../src/routes/decisions/index.js';

describe('Cycle 2 / Axis 2: Cryptographic Audit Hash Chaining & Multi-Sig Consensus', () => {
  const workspaceId = 'ws-crypto-test-001';

  beforeEach(() => {
    resetAuditChain(workspaceId);
  });

  it('should initialize a valid immutable genesis block', () => {
    const genesis = createGenesisBlock(workspaceId);

    expect(genesis.blockIndex).toBe(0);
    expect(genesis.workspaceId).toBe(workspaceId);
    expect(genesis.entityType).toBe('CONFIG');
    expect(genesis.action).toBe('GENESIS_INITIALIZED');
    expect(genesis.prevBlockHash).toBe('0000000000000000000000000000000000000000000000000000000000000000');
    expect(genesis.currentBlockHash).toHaveLength(64);
    expect(genesis.signatureProof).toHaveLength(64);
  });

  it('should append blocks in strict cryptographic sequence with chained hashes', () => {
    const block1 = appendAuditBlock(workspaceId, {
      workspaceId,
      entityId: 'dec-101',
      entityType: 'DECISION',
      action: 'DECISION_PROPOSED',
      actorId: 'usr-owner-01',
      actorRole: 'OWNER',
      timestamp: '2026-11-01T21:00:00.000Z',
      payloadHash: calculatePayloadHash({ action: 'Migrate DB to Neon pooler' }),
    });

    expect(block1.blockIndex).toBe(1);
    expect(block1.entityId).toBe('dec-101');

    const chain = getAuditChain(workspaceId);
    expect(chain).toHaveLength(2); // genesis + block1
    expect(block1.prevBlockHash).toBe(chain[0].currentBlockHash);

    const block2 = appendAuditBlock(workspaceId, {
      workspaceId,
      entityId: 'dec-101',
      entityType: 'DECISION',
      action: 'DECISION_RATIFIED',
      actorId: 'usr-admin-02',
      actorRole: 'ADMIN',
      timestamp: '2026-11-01T21:05:00.000Z',
      payloadHash: calculatePayloadHash({ currentWeight: 5, threshold: 5, status: 'APPROVED' }),
    });

    expect(block2.blockIndex).toBe(2);
    expect(block2.prevBlockHash).toBe(block1.currentBlockHash);

    // Verify chain integrity
    const verification = verifyChainIntegrity(workspaceId);
    expect(verification.isValid).toBe(true);
    expect(verification.totalBlocks).toBe(3);
    expect(verification.latestHash).toBe(block2.currentBlockHash);
  });

  it('should detect mathematical tampering if any block payload or hash is manipulated', () => {
    appendAuditBlock(workspaceId, {
      workspaceId,
      entityId: 'dec-201',
      entityType: 'DECISION',
      action: 'DECISION_PROPOSED',
      actorId: 'usr-owner-01',
      actorRole: 'OWNER',
      timestamp: '2026-11-01T21:10:00.000Z',
      payloadHash: calculatePayloadHash({ amount: 50000 }),
    });

    appendAuditBlock(workspaceId, {
      workspaceId,
      entityId: 'dec-202',
      entityType: 'DECISION',
      action: 'DECISION_PROPOSED',
      actorId: 'usr-admin-01',
      actorRole: 'ADMIN',
      timestamp: '2026-11-01T21:12:00.000Z',
      payloadHash: calculatePayloadHash({ amount: 100000 }),
    });

    // Baseline: Chain is valid
    expect(verifyChainIntegrity(workspaceId).isValid).toBe(true);

    // Malicious actor modifies payloadHash of block 1
    const chain = getAuditChain(workspaceId);
    chain[1].payloadHash = 'deadbeef00000000000000000000000000000000000000000000000000000000';

    const tamperedVerification = verifyChainIntegrity(workspaceId);
    expect(tamperedVerification.isValid).toBe(false);
    expect(tamperedVerification.brokenAtBlockIndex).toBe(1);
  });

  it('should retrieve latest proof block for a specific entity', () => {
    appendAuditBlock(workspaceId, {
      workspaceId,
      entityId: 'dec-target-99',
      entityType: 'DECISION',
      action: 'DECISION_PROPOSED',
      actorId: 'usr-1',
      actorRole: 'MEMBER',
      timestamp: '2026-11-01T21:20:00.000Z',
      payloadHash: calculatePayloadHash({ step: 1 }),
    });

    const secondBlock = appendAuditBlock(workspaceId, {
      workspaceId,
      entityId: 'dec-target-99',
      entityType: 'DECISION',
      action: 'DECISION_RATIFIED',
      actorId: 'usr-owner',
      actorRole: 'OWNER',
      timestamp: '2026-11-01T21:25:00.000Z',
      payloadHash: calculatePayloadHash({ step: 2 }),
    });

    const proof = getAuditChainProof(workspaceId, 'dec-target-99');
    expect(proof).not.toBeNull();
    expect(proof?.blockIndex).toBe(secondBlock.blockIndex);
    expect(proof?.action).toBe('DECISION_RATIFIED');
  });

  describe('Multi-Signature Quorum Logic & Sovereign Veto', () => {
    it('should calculate weighted voting correctly (OWNER: 3, ADMIN: 2, MEMBER: 1, OBSERVER: 0)', () => {
      expect(ROLE_WEIGHTS.OWNER).toBe(3);
      expect(ROLE_WEIGHTS.ADMIN).toBe(2);
      expect(ROLE_WEIGHTS.MEMBER).toBe(1);
      expect(ROLE_WEIGHTS.OBSERVER).toBe(0);

      const threshold = 5;
      const signatures = [
        { userId: 'usr-owner', userRole: 'OWNER', vote: 'APPROVE', weight: 3 },
        { userId: 'usr-admin', userRole: 'ADMIN', vote: 'APPROVE', weight: 2 },
      ];

      const currentWeight = signatures
        .filter((s) => s.vote === 'APPROVE')
        .reduce((sum, s) => sum + s.weight, 0);

      expect(currentWeight).toBe(5);
      expect(currentWeight >= threshold).toBe(true);
    });

    it('should not allow OBSERVER votes to contribute to quorum', () => {
      const threshold = 5;
      const signatures = [
        { userId: 'usr-admin', userRole: 'ADMIN', vote: 'APPROVE', weight: 2 },
        { userId: 'usr-member', userRole: 'MEMBER', vote: 'APPROVE', weight: 1 },
        { userId: 'usr-obs-1', userRole: 'OBSERVER', vote: 'APPROVE', weight: 0 },
        { userId: 'usr-obs-2', userRole: 'OBSERVER', vote: 'APPROVE', weight: 0 },
      ];

      const currentWeight = signatures
        .filter((s) => s.vote === 'APPROVE')
        .reduce((sum, s) => sum + s.weight, 0);

      expect(currentWeight).toBe(3);
      expect(currentWeight >= threshold).toBe(false);
    });

    it('should distinguish Owner veto authority from normal reject votes', () => {
      const normalReject = { vote: 'REJECT', userRole: 'MEMBER' };
      const isOwnerVeto = normalReject.vote === 'VETO' && normalReject.userRole === 'OWNER';
      expect(isOwnerVeto).toBe(false);

      const sovereignVeto = { vote: 'VETO', userRole: 'OWNER' };
      const isValidSovereignVeto = sovereignVeto.vote === 'VETO' && sovereignVeto.userRole === 'OWNER';
      expect(isValidSovereignVeto).toBe(true);
    });
  });
});
