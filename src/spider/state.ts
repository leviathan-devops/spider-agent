/**
 * state.ts — Spider v2.3 Session State Management
 *
 * Manages the lifecycle of spider workflow sessions, stage transitions,
 * verification results, and drift tracking.
 *
 * BUG FIXES vs v2.2.2:
 *   SPIDER-001: Consensus now uses Jaccard similarity > 0.8 instead of
 *               exact string match (lines 149-150 in v2.2.2).
 *   SPIDER-008: Removed duplicate SpiderState interface (lines 63-69 and
 *               118-124 in v2.2.2 types.ts). Single canonical definition here.
 */

import type { CompactionCheckpoint, DerailmentPattern } from '../engines/types.js';
import type { SpiderWeb } from './spiderweb-types.js';

// ---------------------------------------------------------------------------
// Spider Pipeline Stage (distinct from engines/types.ts SpiderStage which is
// the semantic-engine audit stage).  This is the autonomous-loop pipeline.
// ---------------------------------------------------------------------------

export type SpiderPipelineStage =
  | 'idle'
  | 'explore'
  | 'architect'
  | 'coder'
  | 'reviewer'
  | 'test_engineer'
  | 'critic';

// ---------------------------------------------------------------------------
// Core spider workflow types
// ---------------------------------------------------------------------------

export interface AgentResult {
  agentId: string;
  output: string;
  files: string[];
  confidence: number;
  timestamp: number;
}

export interface VerificationResult {
  taskId: string;
  stage: SpiderPipelineStage;
  agents: string[];
  results: AgentResult[];
  consensus: boolean;
  similarityScore?: number;
  resolution?: string;
}

export interface FileAuthority {
  allowRead: string[];
  allowWrite: string[];
  blockWrite: string[];
  denyDelete: string[];
}

export interface SpiderAgentProfile {
  id: string;
  name: string;
  description: string;
  instructions: string;
  mode: 'primary' | 'subagent';
  stage: SpiderPipelineStage | null;
  fileAuthority: FileAuthority;
}

export interface StageTransition {
  from: SpiderPipelineStage;
  to: SpiderPipelineStage;
  taskId: string;
  timestamp: number;
  reason: string;
}

export interface GateCondition {
  type: 'evidence' | 'consensus' | 'files_exist' | 'all_pass';
  description: string;
  met: boolean;
}

export interface StageBoundary {
  stageId: SpiderPipelineStage;
  input: StageContext;
  output: StageContext;
  verificationProof: boolean;
  drifted: boolean;
}

export interface StageContext {
  task: string;
  acceptanceCriteria: string[];
  keyDecisions: string[];
  discrepanciesResolved: string[];
  outstandingConcerns: string[];
  nextStageInput: string;
  capturedAt: string;
}

export interface DriftEvent {
  timestamp: number;
  stage: SpiderPipelineStage;
  reason: string;
  specSnapshot: string;
}

export interface WebAnchorSnapshot {
  tightness: number;
  minVerifications: number;
  driftCount: number;
  escalationCount: number;
  lastTightening: number;
}

// ---------------------------------------------------------------------------
// SpiderWorkflowSession — a single spider execution session
// ---------------------------------------------------------------------------

export interface SpiderWorkflowSession {
  sessionId: string;
  activeAgent: string;
  stage: SpiderPipelineStage;
  taskId: string;
  task: string;
  acceptanceCriteria: string[];
  verificationResults: Map<string, VerificationResult>;
  filesModified: string[];
  evidenceDir: string;
  createdAt: number;
  lastActivity: number;
  webTightness: number;
  driftEvents: DriftEvent[];
  stageBoundaries: StageBoundary[];
  escalationCount: number;
  specMemo: string;
  slopScore: number;
  lastUserMessage: string;
  activeWebId: string | null;
  previousAgent: string | null;
  isFirstSpiderMessage: boolean;
  /** Key decisions that must survive compaction (v2.3). */
  keyDecisions: string[];
  /** Outstanding concerns that must survive compaction (v2.3). */
  outstandingConcerns: string[];
  /** Checkpoints for compaction survival (v2.3). */
  checkpoints: CompactionCheckpoint[];
}

// ---------------------------------------------------------------------------
// SpiderWorkflowState — top-level state (no duplicate definition)
// ---------------------------------------------------------------------------

export interface SpiderWorkflowState {
  sessions: Map<string, SpiderWorkflowSession>;
  stageHistory: StageTransition[];
  webs: Map<string, SpiderWeb>;
  webToSession: Map<string, string>;
  activeSpiderSessionId: string | null;
  derailmentPatterns: DerailmentPattern[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SPIDER_DIR = '.spider-v2';
const STALE_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

/** Minimum Jaccard similarity for consensus (SPIDER-001 fix). */
const CONSENSUS_JACCARD_THRESHOLD = 0.8;

// ---------------------------------------------------------------------------
// Valid stage transitions (gate-enforced)
// ---------------------------------------------------------------------------

const VALID_TRANSITIONS: Record<string, Set<string>> = {
  idle:          new Set(['explore', 'idle']),
  explore:       new Set(['architect', 'explore', 'idle']),
  architect:     new Set(['coder', 'architect', 'idle']),
  coder:         new Set(['reviewer', 'coder', 'idle']),
  reviewer:      new Set(['test_engineer', 'reviewer', 'idle']),
  test_engineer: new Set(['critic', 'test_engineer', 'idle']),
  critic:        new Set(['critic', 'idle']),
};

// ---------------------------------------------------------------------------
// Jaccard similarity
// ---------------------------------------------------------------------------

/**
 * Compute Jaccard similarity between two strings by tokenising into
 * word-level sets (words longer than 2 chars, case-insensitive).
 *
 * Jaccard(A, B) = |A ∩ B| / |A ∪ B|
 *
 * SPIDER-001 FIX: This replaces the old exact-string-match consensus check.
 */
export function jaccardSimilarity(a: string, b: string): number {
  if (!a && !b) return 1.0;
  if (!a || !b) return 0.0;

  const setA = new Set(a.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  const setB = new Set(b.toLowerCase().split(/\s+/).filter(w => w.length > 2));

  if (setA.size === 0 && setB.size === 0) return 1.0;
  if (setA.size === 0 || setB.size === 0) return 0.0;

  let intersection = 0;
  setA.forEach(w => {
    if (setB.has(w)) intersection++;
  });

  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0.0 : intersection / union;
}

/**
 * Compute pairwise minimum Jaccard similarity across all agent outputs.
 * Returns the minimum similarity score found between any pair.
 */
export function minPairwiseJaccard(outputs: string[]): number {
  if (outputs.length < 2) return 1.0;

  let minSim = 1.0;
  for (let i = 0; i < outputs.length; i++) {
    for (let j = i + 1; j < outputs.length; j++) {
      const sim = jaccardSimilarity(outputs[i], outputs[j]);
      if (sim < minSim) minSim = sim;
    }
  }
  return minSim;
}

// ---------------------------------------------------------------------------
// State creation
// ---------------------------------------------------------------------------

export function createSpiderState(): SpiderWorkflowState {
  return {
    sessions: new Map(),
    stageHistory: [],
    webs: new Map(),
    webToSession: new Map(),
    activeSpiderSessionId: null,
    derailmentPatterns: [],
  };
}

export function createSession(
  state: SpiderWorkflowState,
  sessionId: string,
  task: string,
  acceptanceCriteria: string[],
): SpiderWorkflowSession {
  const session: SpiderWorkflowSession = {
    sessionId,
    activeAgent: 'spider',
    stage: 'idle',
    taskId: `task_${Date.now()}`,
    task,
    acceptanceCriteria,
    verificationResults: new Map(),
    filesModified: [],
    evidenceDir: `${SPIDER_DIR}/evidence/${sessionId}`,
    createdAt: Date.now(),
    lastActivity: Date.now(),
    webTightness: 1.0,
    driftEvents: [],
    stageBoundaries: [],
    escalationCount: 0,
    specMemo: '',
    slopScore: 0,
    lastUserMessage: '',
    activeWebId: null,
    previousAgent: null,
    isFirstSpiderMessage: true,
    keyDecisions: [],
    outstandingConcerns: [],
    checkpoints: [],
  };
  state.sessions.set(sessionId, session);
  return session;
}

// ---------------------------------------------------------------------------
// Session lookups
// ---------------------------------------------------------------------------

export function getSession(state: SpiderWorkflowState, sessionId: string): SpiderWorkflowSession | undefined {
  return state.sessions.get(sessionId);
}

export function getActiveSession(state: SpiderWorkflowState): SpiderWorkflowSession | undefined {
  const sessions = Array.from(state.sessions.values());
  return sessions.length > 0 ? sessions[sessions.length - 1] : undefined;
}

export function getActiveSpiderSession(state: SpiderWorkflowState): SpiderWorkflowSession | undefined {
  return state.activeSpiderSessionId
    ? state.sessions.get(state.activeSpiderSessionId)
    : getActiveSession(state);
}

export function setActiveSpiderSession(state: SpiderWorkflowState, sessionId: string): void {
  state.activeSpiderSessionId = sessionId;
}

// ---------------------------------------------------------------------------
// Stale session cleanup
// ---------------------------------------------------------------------------

export function cleanupStaleSessions(state: SpiderWorkflowState): number {
  const now = Date.now();
  let removed = 0;
  for (const [id, session] of state.sessions) {
    if (now - session.lastActivity > STALE_SESSION_TTL_MS) {
      // Clean up web-to-session mappings for this session
      for (const [webId, sessId] of state.webToSession) {
        if (sessId === id) {
          state.webToSession.delete(webId);
        }
      }
      state.sessions.delete(id);
      removed++;
    }
  }
  return removed;
}

/**
 * Clear ALL sessions (used during compaction — SPIDER-007 fix).
 * Preserves the active session if specified.
 */
export function clearAllSessions(state: SpiderWorkflowState, preserveSessionId?: string): void {
  if (preserveSessionId) {
    const preserved = state.sessions.get(preserveSessionId);
    state.sessions.clear();
    state.webToSession.clear();
    if (preserved) {
      state.sessions.set(preserveSessionId, preserved);
      // Rebuild web-to-session mapping for preserved session
      if (preserved.activeWebId) {
        state.webToSession.set(preserved.activeWebId, preserveSessionId);
      }
    }
  } else {
    state.sessions.clear();
    state.webToSession.clear();
  }
}

// ---------------------------------------------------------------------------
// Slop score management
// ---------------------------------------------------------------------------

export function incrementSlopScore(state: SpiderWorkflowState, sessionId: string, amount: number = 1): void {
  const session = state.sessions.get(sessionId);
  if (session) {
    session.slopScore = (session.slopScore || 0) + amount;
  }
}

export function getSlopScore(state: SpiderWorkflowState, sessionId: string): number {
  const session = state.sessions.get(sessionId);
  return session?.slopScore || 0;
}

export function setLastUserMessage(state: SpiderWorkflowState, sessionId: string, message: string): void {
  const session = state.sessions.get(sessionId);
  if (session) {
    session.lastUserMessage = message;
  }
}

// ---------------------------------------------------------------------------
// Web ↔ Session linking
// ---------------------------------------------------------------------------

export function linkWebToSession(state: SpiderWorkflowState, webId: string, sessionId: string): void {
  state.webToSession.set(webId, sessionId);
  const session = state.sessions.get(sessionId);
  if (session) {
    session.activeWebId = webId;
  }
}

export function getSessionByWeb(state: SpiderWorkflowState, webId: string): SpiderWorkflowSession | undefined {
  const sessionId = state.webToSession.get(webId);
  if (!sessionId) return undefined;
  return state.sessions.get(sessionId);
}

// ---------------------------------------------------------------------------
// Stage transitions (with gate-enforced validation)
// ---------------------------------------------------------------------------

/**
 * Transition the session to a new stage.
 *
 * Throws if the transition is not in VALID_TRANSITIONS.
 * The caller (coordinator) is responsible for checking canProceed() BEFORE
 * calling this — the coordinator enforces the gate (SPIDER-002 fix).
 */
export function transitionStage(
  state: SpiderWorkflowState,
  session: SpiderWorkflowSession,
  to: SpiderPipelineStage,
  reason: string,
): void {
  const allowed = VALID_TRANSITIONS[session.stage];
  if (allowed && !allowed.has(to)) {
    throw new Error(
      `Invalid transition: ${session.stage} → ${to}. Allowed: ${Array.from(allowed).join(', ')}`,
    );
  }

  const transition: StageTransition = {
    from: session.stage,
    to,
    taskId: session.taskId,
    timestamp: Date.now(),
    reason,
  };

  session.stage = to;
  session.lastActivity = Date.now();
  state.stageHistory.push(transition);
}

// ---------------------------------------------------------------------------
// Verification results (SPIDER-001 fix: Jaccard similarity > 0.8)
// ---------------------------------------------------------------------------

/**
 * Add a verification result for a task, using Jaccard similarity for
 * consensus determination instead of exact string match.
 *
 * SPIDER-001 FIX: Consensus requires min pairwise Jaccard > 0.8,
 * not exact string equality.
 */
export function addVerificationResult(
  session: SpiderWorkflowSession,
  taskId: string,
  stage: SpiderPipelineStage,
  agents: string[],
  agentResults: AgentResult[],
): VerificationResult {
  const outputs = agentResults.map(r => r.output);

  let consensus = false;
  let similarityScore = 1.0;

  if (agentResults.length >= 2) {
    similarityScore = minPairwiseJaccard(outputs);
    consensus = similarityScore >= CONSENSUS_JACCARD_THRESHOLD;
  } else {
    // Single agent always "consensus" by default
    consensus = true;
  }

  const result: VerificationResult = {
    taskId,
    stage,
    agents,
    results: agentResults,
    consensus,
    similarityScore,
  };

  if (!consensus) {
    const uniqueCount = new Set(outputs.map(o => o.trim())).size;
    result.resolution =
      `DISCREPANCY: ${agentResults.length} agents produced ${uniqueCount} distinct outputs ` +
      `(min Jaccard similarity: ${similarityScore.toFixed(3)}, threshold: ${CONSENSUS_JACCARD_THRESHOLD})`;
  }

  session.verificationResults.set(taskId, result);
  return result;
}

// ---------------------------------------------------------------------------
// File modification tracking
// ---------------------------------------------------------------------------

export function trackFileModification(session: SpiderWorkflowSession, filePath: string): void {
  if (!session.filesModified.includes(filePath)) {
    session.filesModified.push(filePath);
  }
}

// ---------------------------------------------------------------------------
// Stage boundary management
// ---------------------------------------------------------------------------

export function addStageBoundary(
  session: SpiderWorkflowSession,
  input: StageContext,
  output: StageContext,
  verificationProof: boolean,
): void {
  session.stageBoundaries = session.stageBoundaries || [];
  session.stageBoundaries.push({
    stageId: session.stage,
    input,
    output,
    verificationProof,
    drifted: false,
  });
}

// ---------------------------------------------------------------------------
// Drift tracking
// ---------------------------------------------------------------------------

export function recordDriftEvent(
  session: SpiderWorkflowSession,
  reason: string,
  specSnapshot: string,
): void {
  session.driftEvents = session.driftEvents || [];
  session.driftEvents.push({
    timestamp: Date.now(),
    stage: session.stage,
    reason,
    specSnapshot,
  });
}

/**
 * Record a key decision that must survive compaction.
 */
export function recordKeyDecision(session: SpiderWorkflowSession, decision: string): void {
  if (!session.keyDecisions) session.keyDecisions = [];
  if (!session.keyDecisions.includes(decision)) {
    session.keyDecisions.push(decision);
  }
}

/**
 * Record an outstanding concern that must survive compaction.
 */
export function recordOutstandingConcern(session: SpiderWorkflowSession, concern: string): void {
  if (!session.outstandingConcerns) session.outstandingConcerns = [];
  if (!session.outstandingConcerns.includes(concern)) {
    session.outstandingConcerns.push(concern);
  }
}

/**
 * Resolve an outstanding concern, removing it from the list.
 */
export function resolveOutstandingConcern(session: SpiderWorkflowSession, concern: string): void {
  if (!session.outstandingConcerns) return;
  session.outstandingConcerns = session.outstandingConcerns.filter(c => c !== concern);
}
