/**
 * Spider v2.3 — Model Enslavement Harness
 *
 * The main harness that wires all 7 constraints together:
 *   1. OutputInterceptor — Quarantine CRITICAL outputs
 *   2. WriteTimeGate — Block CRITICAL/HIGH writes
 *   3. TaskDecompositionEnforcer — Atomic steps with evidence requirements
 *   4. OutputSizeEnforcer — Min/max output sizes, placeholder detection
 *   5. ForcedRedirection — Rollback + hard constraint injection
 *   6. UntheatricalAdapter — Anti-theatrical system prompt injection
 *   7. CumulativeFailureEscalator — Violation tracking + escalation
 */

import * as fs from 'fs';
import * as path from 'path';
import type { SemanticFinding, ViolationCounter, RGEAuditReport } from '../engines/types.js';
import { SemanticEngineV3 } from '../engines/semantic-engine.js';
import { OutputInterceptor } from './output-interceptor.js';
import { WriteTimeGate } from './write-time-gate.js';
import { TaskDecompositionEnforcer } from './task-decomposition.js';
import { OutputSizeEnforcer } from './output-size-enforcer.js';
import { ForcedRedirection } from './forced-redirection.js';
import { UntheatricalAdapter } from './untheatrical-adapter.js';
import { CumulativeFailureEscalator } from './failure-escalator.js';

// ---------------------------------------------------------------------------
// ModelEnslavementHarness
// ---------------------------------------------------------------------------

export class ModelEnslavementHarness {
  private engine: SemanticEngineV3;
  private interceptor: OutputInterceptor;
  private gate: WriteTimeGate;
  private taskDecomposer: TaskDecompositionEnforcer;
  private sizeEnforcer: OutputSizeEnforcer;
  private redirection: ForcedRedirection;
  private adapter: UntheatricalAdapter;
  private escalator: CumulativeFailureEscalator;
  private quarantineDir: string;

  constructor(engine: SemanticEngineV3, workspaceDir: string) {
    this.engine = engine;
    this.quarantineDir = path.join(workspaceDir, '.spider', 'quarantine');

    // Ensure quarantine directory exists
    if (!fs.existsSync(this.quarantineDir)) {
      fs.mkdirSync(this.quarantineDir, { recursive: true });
    }

    // Wire all 7 constraints
    this.interceptor = new OutputInterceptor(engine, this.quarantineDir);
    this.gate = new WriteTimeGate(engine);
    this.taskDecomposer = new TaskDecompositionEnforcer();
    this.sizeEnforcer = new OutputSizeEnforcer();
    this.redirection = new ForcedRedirection();
    this.adapter = new UntheatricalAdapter();
    this.escalator = new CumulativeFailureEscalator();
  }

  // -------------------------------------------------------------------------
  // Hook integration points
  // -------------------------------------------------------------------------

  /**
   * Called BEFORE a tool is executed.
   * Returns { blocked: true, reason } if the tool call should be prevented.
   */
  onToolExecuteBefore(
    toolName: string,
    args: any,
  ): { blocked: boolean; reason?: string; findings?: SemanticFinding[] } {
    // Constraint 2: Write-time gate
    if (toolName === 'write' || toolName === 'edit') {
      const content = typeof args?.content === 'string' ? args.content : '';
      const filePath = typeof args?.file_path === 'string' ? args.file_path : '';

      if (content && filePath) {
        const result = this.gate.check(content, filePath);
        if (result.blocked) {
          // Constraint 7: Record the violation
          for (const finding of result.findings) {
            const level = this.escalator.recordViolation(finding.ruleId);

            // Constraint 5: On restart or lockout, force redirection
            if (level === 'restart' || level === 'lockout') {
              this.redirection.injectConstraint(finding);
            }
          }

          // Constraint 7: Check for lockout
          if (this.escalator.isLockedOut()) {
            return {
              blocked: true,
              reason:
                'LOCKOUT: Too many repeated violations. Session is locked. ' +
                'Review the cumulative constraints and resolve all violations before continuing.',
              findings: result.findings,
            };
          }

          return {
            blocked: true,
            reason: `Write blocked by Write-Time Gate: ${result.findings.filter(f => f.severity === 'CRITICAL' || f.severity === 'HIGH').length} blocking findings`,
            findings: result.findings,
          };
        }
      }
    }

    return { blocked: false };
  }

  /**
   * Called AFTER a tool is executed.
   * Returns { blocked: true, quarantinePath } if the output should be quarantined.
   */
  onToolExecuteAfter(
    toolName: string,
    result: any,
  ): { blocked: boolean; reason?: string; quarantinePath?: string } {
    // Constraint 1: Output interception
    if (
      toolName === 'write' ||
      toolName === 'edit' ||
      toolName === 'execute'
    ) {
      const filePath = typeof result?.file_path === 'string' ? result.file_path : '';
      const content = typeof result?.content === 'string' ? result.content : '';

      if (filePath && content) {
        const interceptResult = this.interceptor.intercept(filePath, content);
        if (interceptResult.blocked) {
          // Constraint 7: Record violations
          for (const finding of interceptResult.findings) {
            this.escalator.recordViolation(finding.ruleId);
          }

          return {
            blocked: true,
            reason: `Output quarantined: ${interceptResult.findings.filter(f => f.severity === 'CRITICAL').length} CRITICAL findings`,
            quarantinePath: interceptResult.quarantinePath,
          };
        }
      }

      // Constraint 4: Output size enforcement
      if (content) {
        const sizeResult = this.sizeEnforcer.check(content);
        if (!sizeResult.passed) {
          return {
            blocked: false, // Size violations are warnings, not blocks
            reason: `Output size warnings: ${sizeResult.violations.join('; ')}`,
          };
        }
      }
    }

    return { blocked: false };
  }

  /**
   * Transform the system prompt.
   * Constraint 6: Inject anti-theatrical rules.
   * Constraint 5: Inject cumulative constraints from forced redirections.
   */
  onSystemTransform(systemPrompt: string): string {
    // Constraint 6: Anti-theatrical adapter
    let transformed = this.adapter.transform(systemPrompt);

    // Constraint 5: Inject any cumulative constraints from forced redirections
    const constraints = this.redirection.getCumulativeConstraints();
    if (constraints.length > 0) {
      transformed +=
        '\n\n═══ ACCUMULATED CONSTRAINTS (from forced redirections) ═══\n\n' +
        constraints
          .map((c, i) => `${i + 1}. ${c}`)
          .join('\n\n') +
        '\n\n═══ END ACCUMULATED CONSTRAINTS ═══\n\n';
    }

    return transformed;
  }

  /**
   * Transform the message array.
   * Can inject reminders or warnings into the conversation.
   */
  onMessagesTransform(messages: any[]): any[] {
    // If there are active escalations, inject a warning message
    const blockingCounters = this.escalator.getRulesAtOrAbove('block');
    if (blockingCounters.length > 0) {
      const warning =
        `⚠️ Active enforcement escalations:\n` +
        blockingCounters
          .map(
            (c) =>
              `  - Rule "${c.ruleId}": ${c.count} violations → ${c.escalationLevel}`,
          )
          .join('\n');

      // Inject as a system message at the end
      return [
        ...messages,
        {
          role: 'system',
          content: warning,
        },
      ];
    }

    return messages;
  }

  // -------------------------------------------------------------------------
  // State accessors
  // -------------------------------------------------------------------------

  /**
   * Get all violation counters.
   */
  getViolationCounters(): ViolationCounter[] {
    return this.escalator.getCounters();
  }

  /**
   * Get all quarantined file paths.
   */
  getQuarantinedFiles(): string[] {
    try {
      return fs
        .readdirSync(this.quarantineDir)
        .filter((f) => f.endsWith('.quarantined'))
        .map((f) => path.join(this.quarantineDir, f));
    } catch {
      return [];
    }
  }

  /**
   * Save a checkpoint for forced rollback.
   */
  saveCheckpoint(id: string, state: any): void {
    this.redirection.saveCheckpoint(id, state);
  }

  /**
   * Get the underlying semantic engine.
   */
  getEngine(): SemanticEngineV3 {
    return this.engine;
  }

  /**
   * Run a full audit via the engine.
   */
  audit(): RGEAuditReport {
    return this.engine.auditDirectory();
  }

  /**
   * Check if the session is locked out.
   */
  isLockedOut(): boolean {
    return this.escalator.isLockedOut();
  }
}
