/**
 * Spider v2.3 — Write-Time Gate
 *
 * Constraint 2: Before every write/edit, run L0–L2 on the proposed content.
 * Block on CRITICAL or HIGH findings.
 */

import type { SemanticFinding } from '../engines/types.js';
import type { SemanticEngineV3 } from '../engines/semantic-engine.js';

export class WriteTimeGate {
  private engine: SemanticEngineV3;

  constructor(engine: SemanticEngineV3) {
    this.engine = engine;
  }

  /**
   * Check proposed content before it is written to disk.
   *
   * Runs L0 (regex pre-filter) through L2 (CFG + DFA) on the content.
   * If CRITICAL or HIGH findings are found, the write is blocked.
   *
   * @param content - The proposed file content.
   * @param filePath - The target file path (used for reporting).
   * @returns `{ blocked: true, findings }` if the write should be blocked.
   */
  check(
    content: string,
    filePath: string,
  ): { blocked: boolean; findings: SemanticFinding[] } {
    const result = this.engine.checkWriteTime(content, filePath);

    if (!result.report) {
      return { blocked: false, findings: [] };
    }

    const findings = result.report.semanticFindings;
    const blocking = findings.filter(
      (f: SemanticFinding) => f.severity === 'CRITICAL' || f.severity === 'HIGH',
    );

    return {
      blocked: blocking.length > 0,
      findings,
    };
  }
}
