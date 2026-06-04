/**
 * compaction-survival.ts — Spider v2.3 Compaction Survival Module
 *
 * When the LLM context window fills up, the platform performs compaction
 * (truncating the conversation history).  This module ensures that critical
 * spider state SURVIVES compaction by:
 *
 *   1. Serializing the spider session state with SHA256 hash verification
 *   2. Generating a post-compaction prompt that re-injects key information
 *   3. Preserving key decisions and outstanding concerns
 *   4. Detecting tampering or corruption of serialized state
 *
 * This is the v2.3 replacement for the implicit session-based approach
 * that lost critical context during compaction events.
 */

import * as crypto from 'node:crypto';
import type { CompactionCheckpoint } from '../../engines/types.js';
import type {
  SpiderWorkflowSession,
  SpiderPipelineStage,
  VerificationResult,
  StageTransition,
} from '../state.js';

// ---------------------------------------------------------------------------
// Serialization format
// ---------------------------------------------------------------------------

export interface SerializedSpiderState {
  /** Schema version for forward compatibility. */
  schemaVersion: '2.3';
  /** SHA256 hash of the JSON payload (excluding this field) for integrity. */
  integrityHash: string;
  /** When this snapshot was taken. */
  timestamp: string;
  /** The session ID. */
  sessionId: string;
  /** Current pipeline stage. */
  stage: SpiderPipelineStage;
  /** The task being worked on. */
  task: string;
  /** Acceptance criteria for the task. */
  acceptanceCriteria: string[];
  /** Key decisions that must survive compaction. */
  keyDecisions: string[];
  /** Outstanding concerns that must survive compaction. */
  outstandingConcerns: string[];
  /** Files modified so far. */
  filesModified: string[];
  /** Current web tightness. */
  webTightness: number;
  /** Escalation count. */
  escalationCount: number;
  /** Number of drift events. */
  driftEventCount: number;
  /** Slop score. */
  slopScore: number;
  /** Active web ID. */
  activeWebId: string | null;
  /** Verification summary per stage. */
  verificationSummary: Record<string, { consensus: boolean; agentCount: number; similarityScore?: number }>;
  /** Stage transition history (summarized). */
  stageHistory: Array<{ from: SpiderPipelineStage; to: SpiderPipelineStage; reason: string }>;
  /** Spec memo (compacted). */
  specMemo: string;
  /** Checkpoint sequence number. */
  sequenceNumber: number;
}

// ---------------------------------------------------------------------------
// State serialization
// ---------------------------------------------------------------------------

/**
 * Serialize the spider session state into a compact, integrity-verified format.
 */
export function serializeSpiderState(session: SpiderWorkflowSession, stageHistory: StageTransition[]): string {
  const verificationSummary: Record<string, { consensus: boolean; agentCount: number; similarityScore?: number }> = {};
  for (const [taskId, vr] of session.verificationResults) {
    verificationSummary[vr.stage] = {
      consensus: vr.consensus,
      agentCount: vr.agents.length,
      similarityScore: vr.similarityScore,
    };
  }

  const history = stageHistory
    .filter(t => t.taskId === session.taskId)
    .map(t => ({ from: t.from, to: t.to, reason: t.reason }));

  const payload: Omit<SerializedSpiderState, 'integrityHash'> = {
    schemaVersion: '2.3',
    timestamp: new Date().toISOString(),
    sessionId: session.sessionId,
    stage: session.stage,
    task: session.task,
    acceptanceCriteria: session.acceptanceCriteria,
    keyDecisions: session.keyDecisions || [],
    outstandingConcerns: session.outstandingConcerns || [],
    filesModified: session.filesModified,
    webTightness: session.webTightness || 1.0,
    escalationCount: session.escalationCount || 0,
    driftEventCount: (session.driftEvents || []).length,
    slopScore: session.slopScore || 0,
    activeWebId: session.activeWebId,
    verificationSummary,
    stageHistory: history,
    specMemo: (session.specMemo || '').substring(0, 2000),
    sequenceNumber: (session.checkpoints?.length || 0) + 1,
  };

  // Compute integrity hash
  const payloadJson = JSON.stringify(payload);
  const integrityHash = crypto.createHash('sha256').update(payloadJson).digest('hex');

  const full: SerializedSpiderState = {
    ...payload,
    integrityHash,
  };

  return JSON.stringify(full);
}

// ---------------------------------------------------------------------------
// State deserialization & integrity verification
// ---------------------------------------------------------------------------

export interface DeserializationResult {
  valid: boolean;
  state: SerializedSpiderState | null;
  error?: string;
}

/**
 * Deserialize and verify the integrity of a serialized spider state.
 * Detects tampering or corruption by recomputing the SHA256 hash.
 */
export function deserializeSpiderState(serialized: string): DeserializationResult {
  let parsed: SerializedSpiderState;
  try {
    parsed = JSON.parse(serialized);
  } catch (err) {
    return {
      valid: false,
      state: null,
      error: `Failed to parse serialized state: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // Verify schema version
  if (parsed.schemaVersion !== '2.3') {
    return {
      valid: false,
      state: null,
      error: `Unsupported schema version: ${parsed.schemaVersion}`,
    };
  }

  // Verify integrity hash
  const { integrityHash, ...payload } = parsed;
  const payloadJson = JSON.stringify(payload);
  const computedHash = crypto.createHash('sha256').update(payloadJson).digest('hex');

  if (computedHash !== integrityHash) {
    return {
      valid: false,
      state: null,
      error: `Integrity check FAILED: hash mismatch. Expected ${integrityHash}, computed ${computedHash}. State may have been tampered with or corrupted.`,
    };
  }

  return { valid: true, state: parsed };
}

// ---------------------------------------------------------------------------
// Post-compaction prompt generation
// ---------------------------------------------------------------------------

/**
 * Generate a post-compaction prompt that re-injects critical spider state
 * into the conversation after a compaction event.
 *
 * This prompt is designed to be injected as a system message so the
 * spider agent can resume its work without losing context.
 */
export function generatePostCompactionPrompt(serialized: SerializedSpiderState): string {
  const verificationLines = Object.entries(serialized.verificationSummary)
    .map(([stage, v]) => `  ${stage}: ${v.consensus ? '✓ CONSENSUS' : '✗ DISCREPANCY'} (${v.agentCount} agents, similarity: ${v.similarityScore !== undefined ? (v.similarityScore * 100).toFixed(0) + '%' : 'N/A'})`)
    .join('\n');

  const historyLines = serialized.stageHistory
    .map(h => `  ${h.from} → ${h.to}: ${h.reason}`)
    .join('\n');

  return `[SPIDER v2.3 COMPACTION RECOVERY] Context was compacted. Restoring spider state.

═══════════════════════════════════════════════════════════
 SESSION: ${serialized.sessionId}
 STAGE:   ${serialized.stage}
 TASK:    ${serialized.task}
═══════════════════════════════════════════════════════════

ACCEPTANCE CRITERIA:
${serialized.acceptanceCriteria.map(c => `  • ${c}`).join('\n')}

KEY DECISIONS (must preserve):
${serialized.keyDecisions.length > 0 ? serialized.keyDecisions.map(d => `  ✓ ${d}`).join('\n') : '  (none recorded)'}

OUTSTANDING CONCERNS (must resolve):
${serialized.outstandingConcerns.length > 0 ? serialized.outstandingConcerns.map(c => `  ⚠ ${c}`).join('\n') : '  (none)'}

FILES MODIFIED:
${serialized.filesModified.length > 0 ? serialized.filesModified.map(f => `  📄 ${f}`).join('\n') : '  (none)'}

VERIFICATION STATUS:
${verificationLines || '  (no verifications yet)'}

STAGE HISTORY:
${historyLines || '  (no transitions yet)'}

WEB STATE:
  Tightness: ${serialized.webTightness.toFixed(1)}x
  Escalations: ${serialized.escalationCount}
  Drift events: ${serialized.driftEventCount}
  Slop score: ${serialized.slopScore}
  Active web: ${serialized.activeWebId || 'none'}

SPEC MEMO (last known):
${serialized.specMemo ? serialized.specMemo.substring(0, 500) : '  (no spec memo)'}

CHECKPOINT: #${serialized.sequenceNumber} at ${serialized.timestamp}
INTEGRITY: SHA256 verified ✓

═══════════════════════════════════════════════════════════
RESUME: Continue from ${serialized.stage} stage. Do NOT restart.
Preserve all key decisions and concerns above.`;
}

/**
 * Generate a post-compaction prompt directly from a session.
 * Convenience wrapper that serializes and then generates the prompt.
 */
export function generateCompactionRecoveryPrompt(
  session: SpiderWorkflowSession,
  stageHistory: StageTransition[],
): string {
  const serialized = serializeSpiderState(session, stageHistory);
  const result = deserializeSpiderState(serialized);

  if (!result.valid || !result.state) {
    // Fallback: generate a minimal recovery prompt
    return `[SPIDER v2.3 COMPACTION RECOVERY — FALLBACK]
Context was compacted. Partial state recovery.

Session: ${session.sessionId}
Stage: ${session.stage}
Task: ${session.task}
Key decisions: ${(session.keyDecisions || []).join('; ') || 'none'}
Outstanding concerns: ${(session.outstandingConcerns || []).join('; ') || 'none'}
Files modified: ${session.filesModified.join(', ') || 'none'}

WARNING: State integrity verification failed. Manual verification recommended.
Resume from ${session.stage} stage. Preserve all decisions above.`;
  }

  return generatePostCompactionPrompt(result.state);
}

// ---------------------------------------------------------------------------
// Checkpoint creation (for CompactionCheckpoint in engines/types.ts)
// ---------------------------------------------------------------------------

/**
 * Create a compaction checkpoint from the current session state.
 */
export function createCompactionCheckpoint(
  session: SpiderWorkflowSession,
  auditSnapshot: import('../../engines/types.js').RGEAuditReport | null,
): CompactionCheckpoint {
  return {
    timestamp: new Date().toISOString(),
    stage: session.stage as import('../../engines/types.js').SpiderStage,
    activeWebId: session.activeWebId || '',
    outstandingConcerns: session.outstandingConcerns || [],
    keyDecisions: session.keyDecisions || [],
    auditSnapshot,
    stateHash: crypto
      .createHash('sha256')
      .update(JSON.stringify({
        sessionId: session.sessionId,
        stage: session.stage,
        task: session.task,
        filesModified: session.filesModified,
        webTightness: session.webTightness,
      }))
      .digest('hex'),
    sequenceNumber: (session.checkpoints?.length || 0) + 1,
  };
}
