/**
 * context-manager.ts — Spider v2.3 Explicit Context Management
 *
 * Replaces the implicit session-based approach of v2.2 with explicit
 * context window tracking, priority-based context pruning, state
 * checkpoint/restore, and compaction-aware state preservation.
 *
 * This module is the bridge between the spider session state and the
 * LLM's context window, ensuring that the most important information
 * stays in context while less important information is pruned.
 */

import type {
  SpiderWorkflowSession,
  SpiderPipelineStage,
  StageContext,
  StageBoundary,
} from './state.js';
import { jaccardSimilarity } from './state.js';
import type { CompactionCheckpoint } from '../engines/types.js';
import {
  serializeSpiderState,
  deserializeSpiderState,
  generateCompactionRecoveryPrompt,
  generatePostCompactionPrompt,
  createCompactionCheckpoint,
  type SerializedSpiderState,
} from './compaction/compaction-survival.js';

// ---------------------------------------------------------------------------
// Context priority levels
// ---------------------------------------------------------------------------

export enum ContextPriority {
  /** Must never be pruned — identity, active task, current stage. */
  CRITICAL = 0,
  /** Key decisions, outstanding concerns, active web state. */
  HIGH = 1,
  /** Verification results, stage boundaries, drift events. */
  MEDIUM = 2,
  /** Historical stage transitions, old spec memos. */
  LOW = 3,
  /** Debug information, detailed logs. */
  DEBUG = 4,
}

// ---------------------------------------------------------------------------
// Context entry types
// ---------------------------------------------------------------------------

export interface ContextEntry {
  id: string;
  priority: ContextPriority;
  category: string;
  content: string;
  tokenEstimate: number;
  timestamp: number;
  /** Whether this entry is pinned (cannot be pruned). */
  pinned: boolean;
  /** Stage this entry is associated with. */
  stage?: SpiderPipelineStage;
}

export interface ContextWindowStatus {
  totalCapacity: number;
  usedTokens: number;
  availableTokens: number;
  entriesByPriority: Record<string, number>;
  prunableTokens: number;
  lastPrunedAt: number | null;
}

export interface CheckpointData {
  serializedState: string;
  contextSnapshot: ContextEntry[];
  timestamp: string;
  sequenceNumber: number;
}

// ---------------------------------------------------------------------------
// Context Manager
// ---------------------------------------------------------------------------

/** Estimated tokens per character (rough heuristic). */
const TOKENS_PER_CHAR = 0.25;

/** Default context window capacity in tokens. */
const DEFAULT_CONTEXT_CAPACITY = 120000;

/** Minimum tokens to keep available after pruning. */
const MIN_AVAILABLE_TOKENS = 8000;

export class ContextManager {
  private entries: ContextEntry[] = [];
  private capacity: number;
  private entryIdCounter = 0;
  private lastPrunedAt: number | null = null;

  constructor(capacity: number = DEFAULT_CONTEXT_CAPACITY) {
    this.capacity = capacity;
  }

  // -----------------------------------------------------------------------
  // Context entry management
  // -----------------------------------------------------------------------

  /**
   * Add a context entry with a given priority.
   */
  addEntry(
    category: string,
    content: string,
    priority: ContextPriority,
    options?: { pinned?: boolean; stage?: SpiderPipelineStage },
  ): string {
    const id = `ctx_${++this.entryIdCounter}`;
    const entry: ContextEntry = {
      id,
      priority,
      category,
      content,
      tokenEstimate: Math.ceil(content.length * TOKENS_PER_CHAR),
      timestamp: Date.now(),
      pinned: options?.pinned ?? (priority === ContextPriority.CRITICAL),
      stage: options?.stage,
    };
    this.entries.push(entry);
    return id;
  }

  /**
   * Remove a context entry by ID.
   */
  removeEntry(id: string): boolean {
    const idx = this.entries.findIndex(e => e.id === id);
    if (idx === -1) return false;
    this.entries.splice(idx, 1);
    return true;
  }

  /**
   * Pin an entry so it cannot be pruned.
   */
  pinEntry(id: string): boolean {
    const entry = this.entries.find(e => e.id === id);
    if (!entry) return false;
    entry.pinned = true;
    return true;
  }

  /**
   * Unpin an entry so it can be pruned.
   */
  unpinEntry(id: string): boolean {
    const entry = this.entries.find(e => e.id === id);
    if (!entry) return false;
    entry.pinned = false;
    return true;
  }

  /**
   * Get all context entries sorted by priority (critical first).
   */
  getEntries(): ContextEntry[] {
    return [...this.entries].sort((a, b) => a.priority - b.priority);
  }

  /**
   * Get entries for a specific category.
   */
  getEntriesByCategory(category: string): ContextEntry[] {
    return this.entries.filter(e => e.category === category);
  }

  /**
   * Get entries for a specific stage.
   */
  getEntriesByStage(stage: SpiderPipelineStage): ContextEntry[] {
    return this.entries.filter(e => e.stage === stage);
  }

  // -----------------------------------------------------------------------
  // Token accounting
  // -----------------------------------------------------------------------

  /**
   * Get the total estimated token usage.
   */
  getUsedTokens(): number {
    return this.entries.reduce((sum, e) => sum + e.tokenEstimate, 0);
  }

  /**
   * Get the available token capacity.
   */
  getAvailableTokens(): number {
    return Math.max(0, this.capacity - this.getUsedTokens());
  }

  /**
   * Get a status snapshot of the context window.
   */
  getStatus(): ContextWindowStatus {
    const usedTokens = this.getUsedTokens();
    const entriesByPriority: Record<string, number> = {};

    for (const entry of this.entries) {
      const key = ContextPriority[entry.priority];
      entriesByPriority[key] = (entriesByPriority[key] || 0) + entry.tokenEstimate;
    }

    const prunableTokens = this.entries
      .filter(e => !e.pinned && e.priority >= ContextPriority.LOW)
      .reduce((sum, e) => sum + e.tokenEstimate, 0);

    return {
      totalCapacity: this.capacity,
      usedTokens,
      availableTokens: Math.max(0, this.capacity - usedTokens),
      entriesByPriority,
      prunableTokens,
      lastPrunedAt: this.lastPrunedAt,
    };
  }

  // -----------------------------------------------------------------------
  // Priority-based context pruning
  // -----------------------------------------------------------------------

  /**
   * Prune context entries to free up token space.
   *
   * Pruning order:
   *   1. DEBUG entries (oldest first)
   *   2. LOW entries (oldest first)
   *   3. MEDIUM entries from COMPLETED stages (oldest first)
   *   4. MEDIUM entries from current stage (oldest first, preserve recent)
   *
   * Pinned entries and CRITICAL entries are NEVER pruned.
   *
   * Returns the number of tokens freed.
   */
  prune(targetAvailableTokens: number = MIN_AVAILABLE_TOKENS): number {
    const available = this.getAvailableTokens();
    if (available >= targetAvailableTokens) return 0;

    let tokensNeeded = targetAvailableTokens - available;
    let tokensFreed = 0;

    // Pruning rounds: DEBUG → LOW → MEDIUM (completed stages) → MEDIUM (current stages)
    const pruningRounds: Array<{
      filter: (e: ContextEntry) => boolean;
      description: string;
    }> = [
      {
        filter: e => !e.pinned && e.priority === ContextPriority.DEBUG,
        description: 'DEBUG entries',
      },
      {
        filter: e => !e.pinned && e.priority === ContextPriority.LOW,
        description: 'LOW priority entries',
      },
      {
        filter: e => !e.pinned && e.priority === ContextPriority.MEDIUM && e.stage !== undefined,
        description: 'MEDIUM entries from completed stages',
      },
      {
        filter: e => !e.pinned && e.priority === ContextPriority.MEDIUM,
        description: 'MEDIUM entries',
      },
    ];

    for (const round of pruningRounds) {
      if (tokensFreed >= tokensNeeded) break;

      const candidates = this.entries
        .filter(round.filter)
        .sort((a, b) => a.timestamp - b.timestamp); // oldest first

      for (const entry of candidates) {
        if (tokensFreed >= tokensNeeded) break;

        const idx = this.entries.indexOf(entry);
        if (idx !== -1) {
          this.entries.splice(idx, 1);
          tokensFreed += entry.tokenEstimate;
        }
      }
    }

    if (tokensFreed > 0) {
      this.lastPrunedAt = Date.now();
    }

    return tokensFreed;
  }

  // -----------------------------------------------------------------------
  // State checkpoint/restore
  // -----------------------------------------------------------------------

  /**
   * Create a checkpoint that captures both the serialized spider state
   * and the current context window entries.
   */
  checkpoint(session: SpiderWorkflowSession, stageHistory: import('./state.js').StageTransition[]): CheckpointData {
    const serializedState = serializeSpiderState(session, stageHistory);
    return {
      serializedState,
      contextSnapshot: [...this.entries],
      timestamp: new Date().toISOString(),
      sequenceNumber: (session.checkpoints?.length || 0) + 1,
    };
  }

  /**
   * Restore from a checkpoint, verifying integrity first.
   */
  restore(checkpoint: CheckpointData): { success: boolean; error?: string; state?: SerializedSpiderState } {
    const result = deserializeSpiderState(checkpoint.serializedState);
    if (!result.valid || !result.state) {
      return { success: false, error: result.error };
    }

    // Restore context entries from the snapshot, but preserve CRITICAL entries
    const criticalEntries = this.entries.filter(e => e.priority === ContextPriority.CRITICAL);
    this.entries = [...criticalEntries, ...checkpoint.contextSnapshot];

    return { success: true, state: result.state };
  }

  // -----------------------------------------------------------------------
  // Compaction-aware state preservation
  // -----------------------------------------------------------------------

  /**
   * Generate a compaction recovery prompt that will be injected after
   * the LLM's context is compacted.
   *
   * This method:
   *   1. Serializes the current spider state
   *   2. Generates a post-compaction prompt with key information
   *   3. Prunes the context window to make room for the recovery prompt
   *   4. Adds the recovery prompt as a CRITICAL context entry
   */
  prepareForCompaction(
    session: SpiderWorkflowSession,
    stageHistory: import('./state.js').StageTransition[],
  ): string {
    // Generate the recovery prompt
    const recoveryPrompt = generateCompactionRecoveryPrompt(session, stageHistory);

    // Prune the context window aggressively to make room
    const recoveryTokenEstimate = Math.ceil(recoveryPrompt.length * TOKENS_PER_CHAR);
    const needed = recoveryTokenEstimate + MIN_AVAILABLE_TOKENS;
    this.prune(needed);

    // Add the recovery prompt as a CRITICAL, pinned entry
    this.addEntry('compaction-recovery', recoveryPrompt, ContextPriority.CRITICAL, {
      pinned: true,
      stage: session.stage,
    });

    // Store the checkpoint on the session
    const checkpoint = createCompactionCheckpoint(session, null);
    if (!session.checkpoints) session.checkpoints = [];
    session.checkpoints.push(checkpoint);

    return recoveryPrompt;
  }

  /**
   * After compaction occurs, re-inject the spider context into the
   * session. This should be called by the compaction hook.
   */
  postCompactionRestore(
    session: SpiderWorkflowSession,
    stageHistory: import('./state.js').StageTransition[],
  ): string {
    // Serialize current state and verify it matches
    const serialized = serializeSpiderState(session, stageHistory);
    const result = deserializeSpiderState(serialized);

    if (!result.valid || !result.state) {
      // State integrity check failed — generate a warning prompt
      return `[SPIDER v2.3 COMPACTION WARNING] State integrity verification failed after compaction.
Session: ${session.sessionId} | Stage: ${session.stage} | Task: ${session.task}
Manual verification of session state is required.`;
    }

    // Generate the full recovery prompt
    return generatePostCompactionPrompt(result.state);
  }

  // -----------------------------------------------------------------------
  // Session-to-context synchronization
  // -----------------------------------------------------------------------

  /**
   * Synchronize the context manager with the current session state.
   * Adds/updates context entries to reflect the current session.
   */
  syncWithSession(session: SpiderWorkflowSession): void {
    // Ensure task context is present as CRITICAL
    const taskEntries = this.getEntriesByCategory('task');
    if (taskEntries.length === 0 && session.task) {
      this.addEntry('task', session.task, ContextPriority.CRITICAL, {
        pinned: true,
        stage: session.stage,
      });
    }

    // Ensure acceptance criteria are present as HIGH
    const criteriaEntries = this.getEntriesByCategory('acceptance-criteria');
    if (criteriaEntries.length === 0 && session.acceptanceCriteria.length > 0) {
      this.addEntry(
        'acceptance-criteria',
        session.acceptanceCriteria.join('\n'),
        ContextPriority.HIGH,
        { stage: session.stage },
      );
    }

    // Ensure key decisions are present as HIGH
    if (session.keyDecisions && session.keyDecisions.length > 0) {
      const decisionEntries = this.getEntriesByCategory('key-decisions');
      const currentDecisions = session.keyDecisions.join('\n');
      if (decisionEntries.length === 0) {
        this.addEntry('key-decisions', currentDecisions, ContextPriority.HIGH, { pinned: true });
      } else {
        // Update existing entry
        const latest = decisionEntries[decisionEntries.length - 1];
        if (latest.content !== currentDecisions) {
          latest.content = currentDecisions;
          latest.tokenEstimate = Math.ceil(currentDecisions.length * TOKENS_PER_CHAR);
        }
      }
    }

    // Ensure outstanding concerns are present as HIGH
    if (session.outstandingConcerns && session.outstandingConcerns.length > 0) {
      const concernEntries = this.getEntriesByCategory('outstanding-concerns');
      const currentConcerns = session.outstandingConcerns.join('\n');
      if (concernEntries.length === 0) {
        this.addEntry('outstanding-concerns', currentConcerns, ContextPriority.HIGH, { pinned: true });
      } else {
        const latest = concernEntries[concernEntries.length - 1];
        if (latest.content !== currentConcerns) {
          latest.content = currentConcerns;
          latest.tokenEstimate = Math.ceil(currentConcerns.length * TOKENS_PER_CHAR);
        }
      }
    }

    // Prune if necessary
    if (this.getAvailableTokens() < MIN_AVAILABLE_TOKENS) {
      this.prune();
    }
  }
}
