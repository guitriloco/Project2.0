import crypto from 'node:crypto';

export interface CryptographicAuditBlock {
  blockIndex: number;
  timestamp: string;
  workspaceId: string;
  entityId: string;
  entityType: 'DECISION' | 'TASK' | 'PROPOSAL' | 'CONFIG';
  action: string;
  actorId: string;
  actorRole: string;
  payloadHash: string; // SHA-256 of canonical payload
  prevBlockHash: string; // SHA-256 of preceding block (or GENESIS_HASH)
  currentBlockHash: string; // SHA-256(blockIndex + timestamp + payloadHash + prevBlockHash)
  signatureProof: string; // HMAC or canonical signature verification token
}

export interface ChainVerificationResult {
  isValid: boolean;
  brokenAtBlockIndex?: number;
  totalBlocks: number;
  latestHash: string;
  verifiedAt: string;
}

const GENESIS_PREV_HASH = '0000000000000000000000000000000000000000000000000000000000000000';
const HMAC_SECRET = process.env.AUDIT_HMAC_SECRET || 'xerebro-sovereign-audit-chain-key-2026';

// Multi-tenant in-memory chain storage: workspaceId -> CryptographicAuditBlock[]
const workspaceChains = new Map<string, CryptographicAuditBlock[]>();

/**
 * Deterministically serializes and hashes any JS object or primitive with SHA-256
 */
export function calculatePayloadHash(payload: unknown): string {
  const canonical = stringifyCanonical(payload);
  return crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
}

function stringifyCanonical(obj: unknown): string {
  if (obj === null || obj === undefined) return 'null';
  if (typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) {
    return '[' + obj.map(stringifyCanonical).join(',') + ']';
  }
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  const pairs = keys.map((k) => `${JSON.stringify(k)}:${stringifyCanonical((obj as Record<string, unknown>)[k])}`);
  return '{' + pairs.join(',') + '}';
}

/**
 * Computes block hash from canonical block components
 */
export function computeBlockHash(
  blockIndex: number,
  timestamp: string,
  payloadHash: string,
  prevBlockHash: string
): string {
  const content = `${blockIndex}:${timestamp}:${payloadHash}:${prevBlockHash}`;
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

/**
 * Signs the block hash with HMAC-SHA256 for proof of origin
 */
export function signProof(workspaceId: string, entityId: string, currentBlockHash: string): string {
  const message = `${workspaceId}:${entityId}:${currentBlockHash}`;
  return crypto.createHmac('sha256', HMAC_SECRET).update(message, 'utf8').digest('hex');
}

/**
 * Creates the immutable genesis block for a workspace
 */
export function createGenesisBlock(workspaceId: string): CryptographicAuditBlock {
  const blockIndex = 0;
  const timestamp = '2026-01-01T00:00:00.000Z';
  const entityId = `genesis-${workspaceId}`;
  const entityType = 'CONFIG';
  const action = 'GENESIS_INITIALIZED';
  const actorId = 'SYSTEM_KERNEL';
  const actorRole = 'OWNER';
  const prevBlockHash = GENESIS_PREV_HASH;
  const payloadHash = calculatePayloadHash({
    workspaceId,
    protocol: 'XEREBRO_SOVEREIGN_AUDIT_V2',
    genesisAuthority: 'IMPÉRIO_MUTANTE_CORE',
  });
  const currentBlockHash = computeBlockHash(blockIndex, timestamp, payloadHash, prevBlockHash);
  const signatureProof = signProof(workspaceId, entityId, currentBlockHash);

  return {
    blockIndex,
    timestamp,
    workspaceId,
    entityId,
    entityType,
    action,
    actorId,
    actorRole,
    payloadHash,
    prevBlockHash,
    currentBlockHash,
    signatureProof,
  };
}

/**
 * Retrieves the audit chain for a given workspace, ensuring genesis block exists
 */
export function getAuditChain(workspaceId: string): CryptographicAuditBlock[] {
  let chain = workspaceChains.get(workspaceId);
  if (!chain || chain.length === 0) {
    const genesis = createGenesisBlock(workspaceId);
    chain = [genesis];
    workspaceChains.set(workspaceId, chain);
  }
  return chain;
}

/**
 * Appends a new cryptographic audit block to the workspace chain
 */
export function appendAuditBlock(
  workspaceId: string,
  entry: Omit<CryptographicAuditBlock, 'blockIndex' | 'prevBlockHash' | 'currentBlockHash' | 'signatureProof'>
): CryptographicAuditBlock {
  const chain = getAuditChain(workspaceId);
  const blockIndex = chain.length;
  const prevBlock = chain[chain.length - 1];
  const prevBlockHash = prevBlock.currentBlockHash;
  const timestamp = entry.timestamp || new Date().toISOString();

  const currentBlockHash = computeBlockHash(blockIndex, timestamp, entry.payloadHash, prevBlockHash);
  const signatureProof = signProof(workspaceId, entry.entityId, currentBlockHash);

  const newBlock: CryptographicAuditBlock = {
    blockIndex,
    timestamp,
    workspaceId,
    entityId: entry.entityId,
    entityType: entry.entityType,
    action: entry.action,
    actorId: entry.actorId,
    actorRole: entry.actorRole,
    payloadHash: entry.payloadHash,
    prevBlockHash,
    currentBlockHash,
    signatureProof,
  };

  chain.push(newBlock);
  return newBlock;
}

/**
 * Verifies the full mathematical and cryptographic integrity of a workspace's audit chain
 */
export function verifyChainIntegrity(workspaceId: string): ChainVerificationResult {
  const chain = getAuditChain(workspaceId);
  const verifiedAt = new Date().toISOString();

  if (chain.length === 0) {
    return {
      isValid: false,
      totalBlocks: 0,
      latestHash: '',
      verifiedAt,
    };
  }

  for (let i = 0; i < chain.length; i++) {
    const block = chain[i];

    // Check block sequence
    if (block.blockIndex !== i) {
      return {
        isValid: false,
        brokenAtBlockIndex: i,
        totalBlocks: chain.length,
        latestHash: chain[chain.length - 1].currentBlockHash,
        verifiedAt,
      };
    }

    // Check previous block link
    if (i === 0) {
      if (block.prevBlockHash !== GENESIS_PREV_HASH) {
        return {
          isValid: false,
          brokenAtBlockIndex: 0,
          totalBlocks: chain.length,
          latestHash: chain[chain.length - 1].currentBlockHash,
          verifiedAt,
        };
      }
    } else {
      const prev = chain[i - 1];
      if (block.prevBlockHash !== prev.currentBlockHash) {
        return {
          isValid: false,
          brokenAtBlockIndex: i,
          totalBlocks: chain.length,
          latestHash: chain[chain.length - 1].currentBlockHash,
          verifiedAt,
        };
      }
    }

    // Verify computed block hash
    const expectedHash = computeBlockHash(
      block.blockIndex,
      block.timestamp,
      block.payloadHash,
      block.prevBlockHash
    );
    if (block.currentBlockHash !== expectedHash) {
      return {
        isValid: false,
        brokenAtBlockIndex: i,
        totalBlocks: chain.length,
        latestHash: chain[chain.length - 1].currentBlockHash,
        verifiedAt,
      };
    }

    // Verify HMAC signature
    const expectedSig = signProof(block.workspaceId, block.entityId, block.currentBlockHash);
    if (block.signatureProof !== expectedSig) {
      return {
        isValid: false,
        brokenAtBlockIndex: i,
        totalBlocks: chain.length,
        latestHash: chain[chain.length - 1].currentBlockHash,
        verifiedAt,
      };
    }
  }

  return {
    isValid: true,
    totalBlocks: chain.length,
    latestHash: chain[chain.length - 1].currentBlockHash,
    verifiedAt,
  };
}

/**
 * Retrieves the latest cryptographic proof block for a specific entity
 */
export function getAuditChainProof(workspaceId: string, entityId: string): CryptographicAuditBlock | null {
  const chain = getAuditChain(workspaceId);
  for (let i = chain.length - 1; i >= 0; i--) {
    if (chain[i].entityId === entityId) {
      return chain[i];
    }
  }
  return null;
}

/**
 * Diagnostic/Testing helper to clear chain for workspace
 */
export function resetAuditChain(workspaceId: string): void {
  workspaceChains.delete(workspaceId);
}
