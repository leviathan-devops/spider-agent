/**
 * Spider v2.3 — Scaffold Generator
 *
 * Generates test scaffolds for the 6-phase audit lifecycle.
 * Phase 6 (lifecycle) test is FIXED to NOT return { passed: true }
 * unconditionally — it must actually run the check.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { SemanticFinding } from './types.js';

// ---------------------------------------------------------------------------
// Scaffold spec
// ---------------------------------------------------------------------------

interface ScaffoldSpec {
  /** Name of the test file (without extension). */
  name: string;
  /** Description of what the scaffold tests. */
  description: string;
  /** Phases to include in the lifecycle test. */
  phases: PhaseSpec[];
}

interface PhaseSpec {
  name: string;
  description: string;
  /** Whether this phase performs I/O verification. */
  requiresIO: boolean;
}

// ---------------------------------------------------------------------------
// Default 6-phase lifecycle
// ---------------------------------------------------------------------------

const DEFAULT_PHASES: PhaseSpec[] = [
  { name: 'Phase 1 — Init', description: 'Initialize the semantic engine and load rules', requiresIO: true },
  { name: 'Phase 2 — Parse', description: 'Parse source files into AST', requiresIO: true },
  { name: 'Phase 3 — TypeCheck', description: 'Run TypeChecker analysis', requiresIO: false },
  { name: 'Phase 4 — CFG', description: 'Build control-flow graphs and run DFA', requiresIO: false },
  { name: 'Phase 5 — Audit', description: 'Run the full 6-layer audit', requiresIO: true },
  { name: 'Phase 6 — Lifecycle', description: 'Verify the full lifecycle produces valid results', requiresIO: true },
];

// ---------------------------------------------------------------------------
// ScaffoldGenerator
// ---------------------------------------------------------------------------

export class ScaffoldGenerator {
  private outputDir: string;

  constructor(outputDir: string) {
    this.outputDir = path.resolve(outputDir);
  }

  /**
   * Generate test scaffold code from a spec.
   * If no spec is provided, uses the default 6-phase lifecycle.
   */
  generateScaffold(spec: any): string {
    const phases: PhaseSpec[] = spec?.phases ?? DEFAULT_PHASES;
    const testName = spec?.name ?? 'lifecycle-test';
    const description = spec?.description ?? '6-phase audit lifecycle test';

    const phaseCode = phases.map((phase, i) => {
      const fnName = `phase${i + 1}_${phase.name.replace(/[^a-zA-Z0-9]/g, '_')}`;

      if (phase.name.includes('Phase 6') || phase.name.includes('Lifecycle')) {
        // CRITICAL FIX: Phase 6 must NOT return { passed: true } unconditionally.
        // It must actually run the audit and verify the result.
        return `
  /**
   * ${phase.name}: ${phase.description}
   *
   * BUG FIX: This phase must NOT return { passed: true } unconditionally.
   * It must actually run the audit lifecycle and verify the result.
   */
  async ${fnName}(): Promise<{ passed: boolean; findings: SemanticFinding[] }> {
    // Actually run the full audit — not a stub!
    const report = this.engine.auditDirectory(this.sourceDir);

    // Verify the report is well-formed
    if (!report) {
      return { passed: false, findings: [] };
    }

    // Verify total files analyzed > 0 (empty-set consensus fix)
    if (report.totalFilesAnalyzed === 0) {
      return {
        passed: false,
        findings: [{
          ruleId: 'LIFECYCLE-EMPTY-SET',
          severity: 'CRITICAL',
          message: 'Lifecycle test: zero files analyzed — empty-set consensus bug',
          file: '',
          line: 0,
        }],
      };
    }

    // Collect findings from all layers
    const allFindings = report.semanticFindings;

    // The lifecycle passes only if the audit completes without CRITICAL findings
    const hasCritical = allFindings.some(f => f.severity === 'CRITICAL');
    return {
      passed: !hasCritical && report.overallPassed,
      findings: allFindings,
    };
  }`;
      }

      return `
  /**
   * ${phase.name}: ${phase.description}
   */
  async ${fnName}(): Promise<{ passed: boolean; findings: SemanticFinding[] }> {
    const findings: SemanticFinding[] = [];
    // Phase implementation: ${phase.description}
    return { passed: findings.filter(f => f.severity === 'CRITICAL').length === 0, findings };
  }`;
    }).join('\n');

    const phaseCallCode = phases.map((phase, i) => {
      const fnName = `phase${i + 1}_${phase.name.replace(/[^a-zA-Z0-9]/g, '_')}`;
      return `    const result${i + 1} = await this.${fnName}();
    if (!result${i + 1}.passed) {
      return { passed: false, phase: '${phase.name}', findings: result${i + 1}.findings };
    }`;
    }).join('\n');

    return `/**
 * Auto-generated scaffold: ${testName}
 *
 * ${description}
 *
 * IMPORTANT: Phase 6 (Lifecycle) does NOT return { passed: true }
 * unconditionally — it actually runs the audit and verifies the result.
 */

import { SemanticEngineV3 } from '../semantic-engine.js';
import type { SemanticFinding, RGEAuditReport } from '../types.js';

export class ${toPascalCase(testName)} {
  private engine: SemanticEngineV3;
  private sourceDir: string;

  constructor(sourceDir: string) {
    this.sourceDir = sourceDir;
    this.engine = new SemanticEngineV3(sourceDir);
  }
${phaseCode}

  /**
   * Run all phases in sequence. Returns the overall result.
   */
  async runAll(): Promise<{ passed: boolean; phase?: string; findings?: SemanticFinding[] }> {
${phaseCallCode}

    return { passed: true };
  }
}

// CLI entry point
if (typeof require !== 'undefined' && require.main === module) {
  const dir = process.argv[2] ?? process.cwd();
  const test = new ${toPascalCase(testName)}(dir);
  test.runAll().then((result) => {
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.passed ? 0 : 1);
  });
}
`;
  }

  /**
   * Write the scaffold code to a file in the output directory.
   * Returns the absolute path of the written file.
   */
  writeScaffold(code: string, filename: string): string {
    // Ensure the output directory exists
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }

    const filePath = path.join(this.outputDir, filename);
    fs.writeFileSync(filePath, code, 'utf-8');
    return filePath;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toPascalCase(str: string): string {
  return str
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, chr: string) => chr.toUpperCase())
    .replace(/^[a-z]/, (chr) => chr.toUpperCase());
}
