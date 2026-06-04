/**
 * Spider v2.3 — Cumulative Failure Escalator
 *
 * Constraint 7: Track violations and escalate enforcement.
 *
 * Escalation levels:
 *   1 violation  → warn   (log the violation)
 *   2 violations → block  (prevent the operation)
 *   3 violations → restart (rollback to last checkpoint + hard constraint)
 *   4+ violations → lockout (halt the session entirely)
 */

import type { ViolationCounter, EscalationLevel, EscalationThreshold } from '../engines/types.js';

// ---------------------------------------------------------------------------
// Default escalation thresholds
// ---------------------------------------------------------------------------

const DEFAULT_THRESHOLDS: EscalationThreshold[] = [
  { minCount: 1, level: 'warn' },
  { minCount: 2, level: 'block' },
  { minCount: 3, level: 'restart' },
  { minCount: 4, level: 'lockout' },
];

// ---------------------------------------------------------------------------
// CumulativeFailureEscalator
// ---------------------------------------------------------------------------

export class CumulativeFailureEscalator {
  private counters: Map<string, ViolationCounter>;
  private thresholds: EscalationThreshold[];

  constructor(thresholds?: EscalationThreshold[]) {
    this.counters = new Map();
    this.thresholds = thresholds ?? DEFAULT_THRESHOLDS;
  }

  /**
   * Record a violation for a rule and return the current escalation level.
   *
   * @param ruleId - The rule that was violated.
   * @returns The current escalation level after incrementing.
   */
  recordViolation(ruleId: string): EscalationLevel {
    const counter = this.getOrCreateCounter(ruleId);
    counter.count++;

    // Recalculate escalation level
    counter.escalationLevel = this.calculateEscalationLevel(counter.count);
    this.counters.set(ruleId, counter);

    return counter.escalationLevel;
  }

  /**
   * Get the current escalation level for a rule.
   */
  getEscalationLevel(ruleId: string): EscalationLevel {
    const counter = this.counters.get(ruleId);
    if (!counter) return 'warn';
    return counter.escalationLevel;
  }

  /**
   * Get all violation counters.
   */
  getCounters(): ViolationCounter[] {
    return Array.from(this.counters.values());
  }

  /**
   * Reset the violation counter for a specific rule.
   */
  reset(ruleId: string): void {
    this.counters.delete(ruleId);
  }

  /**
   * Reset all violation counters.
   */
  resetAll(): void {
    this.counters.clear();
  }

  /**
   * Check if any rule has reached lockout level.
   */
  isLockedOut(): boolean {
    for (const counter of this.counters.values()) {
      if (counter.escalationLevel === 'lockout') {
        return true;
      }
    }
    return false;
  }

  /**
   * Get all rules that are at or above a given escalation level.
   */
  getRulesAtOrAbove(level: EscalationLevel): ViolationCounter[] {
    const levelOrder: Record<EscalationLevel, number> = {
      warn: 0,
      block: 1,
      restart: 2,
      lockout: 3,
    };

    const threshold = levelOrder[level];
    return this.getCounters().filter(
      (c) => levelOrder[c.escalationLevel] >= threshold,
    );
  }

  // -------------------------------------------------------------------------
  // Internal
  // -------------------------------------------------------------------------

  private getOrCreateCounter(ruleId: string): ViolationCounter {
    const existing = this.counters.get(ruleId);
    if (existing) return { ...existing };

    return {
      ruleId,
      count: 0,
      escalationLevel: 'warn',
      thresholds: this.thresholds,
    };
  }

  private calculateEscalationLevel(count: number): EscalationLevel {
    // Walk thresholds in reverse order (highest first)
    // and return the first one whose minCount is satisfied
    const sorted = [...this.thresholds].sort(
      (a, b) => b.minCount - a.minCount,
    );

    for (const threshold of sorted) {
      if (count >= threshold.minCount) {
        return threshold.level;
      }
    }

    // Default to the lowest level
    return 'warn';
  }
}
