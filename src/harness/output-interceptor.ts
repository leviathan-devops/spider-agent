/**
 * Spider v2.3 — Output Interceptor
 *
 * Constraint 1: After every tool execution that produces output,
 * run RGE checkWriteTime(). If CRITICAL findings are found,
 * QUARANTINE the output to prevent tainted code from entering the project.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { SemanticFinding } from '../engines/types.js';
import type { SemanticEngineV3 } from '../engines/semantic-engine.js';

export class OutputInterceptor {
  private engine: SemanticEngineV3;
  private quarantineDir: string;

  constructor(engine: SemanticEngineV3, quarantineDir: string) {
    this.engine = engine;
    this.quarantineDir = path.resolve(quarantineDir);

    // Ensure the quarantine directory exists
    if (!fs.existsSync(this.quarantineDir)) {
      fs.mkdirSync(this.quarantineDir, { recursive: true });
    }
  }

  /**
   * Intercept file output. Runs checkWriteTime() on the content.
   *
   * If CRITICAL findings are found:
   *   - The output is QUARANTINED (moved to the quarantine directory)
   *   - Returns { blocked: true, quarantinePath, findings }
   *
   * If no CRITICAL findings:
   *   - Returns { blocked: false, findings }
   */
  intercept(
    filePath: string,
    content: string,
  ): { blocked: boolean; quarantinePath?: string; findings: SemanticFinding[] } {
    const result = this.engine.checkWriteTime(content, filePath);

    if (!result.report) {
      // No report means the check passed — allow the output
      return { blocked: false, findings: [] };
    }

    const findings = result.report.semanticFindings;
    const criticals = findings.filter((f) => f.severity === 'CRITICAL');

    if (criticals.length > 0) {
      // Quarantine the output
      const quarantinePath = this.quarantineOutput(filePath, content, findings);

      return {
        blocked: true,
        quarantinePath,
        findings,
      };
    }

    // Non-critical findings — allow but report
    return { blocked: false, findings };
  }

  /**
   * Move the output to the quarantine directory.
   * Returns the quarantine path.
   */
  private quarantineOutput(
    filePath: string,
    content: string,
    findings: SemanticFinding[],
  ): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const basename = path.basename(filePath);
    const quarantinePath = path.join(
      this.quarantineDir,
      `${timestamp}_${basename}.quarantined`,
    );

    // Write the quarantined content with a header explaining why
    const header = [
      `// QUARANTINED by Spider v2.3 Output Interceptor`,
      `// Original file: ${filePath}`,
      `// Quarantined at: ${new Date().toISOString()}`,
      `// Reason: ${findings.filter(f => f.severity === 'CRITICAL').length} CRITICAL findings`,
      `// Findings:`,
      ...findings
        .filter((f) => f.severity === 'CRITICAL')
        .map((f) => `//   - [${f.ruleId}] ${f.message} (${f.file}:${f.line})`),
      `//`,
      ``,
    ].join('\n');

    fs.writeFileSync(quarantinePath, header + content, 'utf-8');

    // Also write a metadata JSON file alongside
    const metaPath = quarantinePath + '.meta.json';
    const meta = {
      originalPath: filePath,
      quarantinedAt: new Date().toISOString(),
      findings: findings.map((f) => ({
        ruleId: f.ruleId,
        severity: f.severity,
        message: f.message,
        file: f.file,
        line: f.line,
        column: f.column,
      })),
    };
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8');

    return quarantinePath;
  }
}
