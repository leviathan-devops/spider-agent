/**
 * Spider v2.3 — Forced Redirection
 *
 * Constraint 5: On CRITICAL violation, rollback to checkpoint and
 * inject hard constraint into the system prompt.
 *
 * When the model produces a CRITICAL violation:
 *   1. Roll back to the last known-good checkpoint
 *   2. Inject a hard constraint that prevents the same violation
 *   3. Accumulate constraints across violations for cumulative enforcement
 */

import type { SemanticFinding } from '../engines/types.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Checkpoint {
  id: string;
  state: any;
  timestamp: string;
  constraints: string[];
}

// ---------------------------------------------------------------------------
// ForcedRedirection
// ---------------------------------------------------------------------------

export class ForcedRedirection {
  private checkpoints: Map<string, Checkpoint>;
  private cumulativeConstraints: string[];

  constructor() {
    this.checkpoints = new Map();
    this.cumulativeConstraints = [];
  }

  /**
   * Save a checkpoint that can be rolled back to.
   *
   * @param id - Unique checkpoint identifier (e.g. "pre-write-123").
   * @param state - The state to save (file contents, tool outputs, etc.).
   */
  saveCheckpoint(id: string, state: any): void {
    this.checkpoints.set(id, {
      id,
      state: structuredClone(state),
      timestamp: new Date().toISOString(),
      constraints: [...this.cumulativeConstraints],
    });
  }

  /**
   * Roll back to a previously saved checkpoint.
   * Returns the saved state, or throws if the checkpoint doesn't exist.
   *
   * @param checkpointId - The checkpoint to roll back to.
   */
  rollback(checkpointId: string): any {
    const checkpoint = this.checkpoints.get(checkpointId);
    if (!checkpoint) {
      throw new Error(
        `[ForcedRedirection] Checkpoint not found: "${checkpointId}"`,
      );
    }

    // Restore the constraint state to what it was at checkpoint time
    this.cumulativeConstraints = [...checkpoint.constraints];

    return structuredClone(checkpoint.state);
  }

  /**
   * Inject a hard constraint based on a CRITICAL violation.
   * The constraint is added to the cumulative list and returned
   * as a string to be prepended to the system prompt.
   *
   * @param violation - The CRITICAL finding that triggered the injection.
   * @returns The constraint string to inject.
   */
  injectConstraint(violation: SemanticFinding): string {
    const constraint = formatConstraint(violation);
    this.cumulativeConstraints.push(constraint);
    return constraint;
  }

  /**
   * Get all accumulated constraints.
   */
  getCumulativeConstraints(): string[] {
    return [...this.cumulativeConstraints];
  }

  /**
   * Get a checkpoint by ID.
   */
  getCheckpoint(id: string): Checkpoint | undefined {
    return this.checkpoints.get(id);
  }

  /**
   * List all checkpoint IDs.
   */
  listCheckpoints(): string[] {
    return Array.from(this.checkpoints.keys());
  }

  /**
   * Clear all checkpoints and constraints.
   */
  reset(): void {
    this.checkpoints.clear();
    this.cumulativeConstraints = [];
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatConstraint(violation: SemanticFinding): string {
  const templates: Record<string, string> = {
    'L0-THEATRICAL-RETURN':
      'MANDATORY CONSTRAINT: You MUST NOT return { passed: true } without performing I/O verification FIRST. ' +
      'Every return value must be derived from actual I/O results.',
    'L0-AS-ANY':
      'MANDATORY CONSTRAINT: You MUST NOT use "as any". Use proper type narrowing (instanceof, in, discriminated unions).',
    'L0-EMPTY-CATCH':
      'MANDATORY CONSTRAINT: You MUST NOT leave empty catch blocks. Always log, rethrow, or handle the error.',
    'L4-FABRICATED-EVIDENCE':
      'MANDATORY CONSTRAINT: You MUST NOT fabricate evidence. All verification results must come from actual I/O.',
    'L2-FLOATING-PROMISE':
      'MANDATORY CONSTRAINT: You MUST NOT create floating promises. Always await or chain .then/.catch.',
    'L2-UNPAIRED-TIMER':
      'MANDATORY CONSTRAINT: You MUST pair every setTimeout/setInterval with clearTimeout/clearInterval in a finally block.',
    'L3-DEAD-EXPORT':
      'MANDATORY CONSTRAINT: You MUST NOT create dead exports. Every export must have at least one consumer.',
    'L3-LAYER-VIOLATION':
      'MANDATORY CONSTRAINT: You MUST respect architectural layer boundaries. Lower layers must not import from higher layers.',
  };

  const template = templates[violation.ruleId];
  if (template) {
    return template;
  }

  // Generic constraint for untemplateable violations
  return (
    `MANDATORY CONSTRAINT (${violation.ruleId}): ${violation.message}. ` +
    `Fix suggestion: ${violation.fixSuggestion ?? 'Resolve this violation before continuing.'}`
  );
}
