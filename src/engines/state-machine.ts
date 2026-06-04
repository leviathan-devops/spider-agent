/**
 * Spider v2.3 — RGE State Machine
 *
 * Tracks the state of an audit session through the lifecycle:
 *   idle → auditing → complete
 *                 ↘ error
 *
 * Records audit history so that cumulative failure detection and
 * derailment analysis can access past reports.
 */

import type { RGEAuditReport } from './types.js';

type RGEState = 'idle' | 'auditing' | 'complete' | 'error';

interface AuditHistoryEntry {
  timestamp: string;
  report: RGEAuditReport;
}

export class RGEStateMachine {
  private state: RGEState;
  private auditHistory: AuditHistoryEntry[];

  constructor() {
    this.state = 'idle';
    this.auditHistory = [];
  }

  /**
   * Transition to a new state.
   * Enforces valid state transitions only.
   */
  transition(newState: string): void {
    const validTransitions: Record<RGEState, string[]> = {
      idle: ['auditing'],
      auditing: ['complete', 'error'],
      complete: ['auditing', 'idle'],
      error: ['auditing', 'idle'],
    };

    const allowed = validTransitions[this.state];
    if (!allowed || !allowed.includes(newState)) {
      throw new Error(
        `[RGEStateMachine] Invalid transition: ${this.state} → ${newState}. ` +
        `Allowed transitions from '${this.state}': [${allowed?.join(', ') ?? 'none'}]`,
      );
    }

    this.state = newState as RGEState;
  }

  /**
   * Get the current state.
   */
  getState(): string {
    return this.state;
  }

  /**
   * Get the full audit history.
   */
  getHistory(): AuditHistoryEntry[] {
    return [...this.auditHistory];
  }

  /**
   * Record a completed audit report in the history.
   * Automatically transitions to 'complete' or 'error' based on the report.
   */
  recordAudit(report: RGEAuditReport): void {
    this.auditHistory.push({
      timestamp: new Date().toISOString(),
      report,
    });

    // Auto-transition based on report outcome
    if (report.overallPassed) {
      this.transition('complete');
    } else {
      this.transition('error');
    }
  }

  /**
   * Reset the state machine to idle, clearing history.
   */
  reset(): void {
    this.state = 'idle';
    this.auditHistory = [];
  }

  /**
   * Get the most recent audit report, or null if no audits have been run.
   */
  getLastReport(): RGEAuditReport | null {
    if (this.auditHistory.length === 0) return null;
    return this.auditHistory[this.auditHistory.length - 1].report;
  }

  /**
   * Check if the machine has recorded at least one audit.
   */
  hasHistory(): boolean {
    return this.auditHistory.length > 0;
  }

  /**
   * Get the number of failed audits in history.
   */
  getFailedAuditCount(): number {
    return this.auditHistory.filter((e) => !e.report.overallPassed).length;
  }
}
