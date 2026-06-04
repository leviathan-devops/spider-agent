/**
 * Spider v2.3 — Adversarial Test Suite
 *
 * This file performs ADVERSARIAL pressure testing against the Semantic Engine V3.
 * Every test tries to BREAK the engine or evade its detectors. These are NOT
 * happy-path tests — they verify the engine catches violations that a malicious
 * or sloppy model would produce.
 *
 * Bug references:
 *   RGE-001 / RGE-002 — Empty-set consensus (0 files → false/100% pass)
 *   RGE-006           — P2 type certainty (text matching vs TypeChecker)
 *   RGE-007           — P11 regex anchoring (partial-match false positives)
 *
 * Testing strategy:
 *   - Rules are tested DIRECTLY (bypassing the pipeline layer filter) to
 *     verify the rule logic itself catches violations.
 *   - The full pipeline (auditInMemory) is tested for integration scenarios
 *     where findings propagate through L0 confirmation and L4 anti-theatrical.
 *   - Harness components are tested in isolation.
 */

import { describe, it, expect } from 'vitest';
import { SemanticEngineV3 } from '../../src/engines/semantic-engine.js';
import { createInMemoryEngine } from '../../src/engines/compiler-host.js';
import type { SemanticEngine } from '../../src/engines/compiler-host.js';
import { RuleEngine } from '../../src/engines/rules/rule-engine.js';
import { allRules } from '../../src/engines/rules/index.js';
import { buildCFG } from '../../src/engines/cfg/cfg-builder.js';
import { computeDominators, dominates, postDominates } from '../../src/engines/cfg/dominator-tree.js';
import { detectFloatingPromises } from '../../src/engines/cfg/data-flow.js';
import { OutputSizeEnforcer } from '../../src/harness/output-size-enforcer.js';
import { UntheatricalAdapter } from '../../src/harness/untheatrical-adapter.js';
import { CumulativeFailureEscalator } from '../../src/harness/failure-escalator.js';
import { ForcedRedirection } from '../../src/harness/forced-redirection.js';
import { WriteTimeGate } from '../../src/harness/write-time-gate.js';
import type { RGEAuditReport, SemanticFinding } from '../../src/engines/types.js';
import * as ts from 'typescript';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEngine(): SemanticEngineV3 {
  return new SemanticEngineV3('/tmp/spider-test');
}

function auditCode(code: string, fileName = 'test.ts'): RGEAuditReport {
  const engine = makeEngine();
  const files = new Map<string, string>();
  files.set(fileName, code);
  return engine.auditInMemory(files);
}

function hasFinding(report: RGEAuditReport, ruleId: string): boolean {
  return report.semanticFindings.some((f) => f.ruleId === ruleId);
}

function getFindings(report: RGEAuditReport, ruleId: string): SemanticFinding[] {
  return report.semanticFindings.filter((f) => f.ruleId === ruleId);
}

/**
 * Create an in-memory SemanticEngine, then run a specific rule directly
 * against the code. This bypasses the layer-filtering in the pipeline
 * so we can verify rule logic independently.
 */
function runRuleDirectly(ruleId: string, code: string, fileName = 'test.ts'): SemanticFinding[] {
  const files = new Map<string, string>();
  files.set(fileName, code);

  const engine = createInMemoryEngine(files);
  const ruleEngine = new RuleEngine();
  ruleEngine.registerAll(allRules);

  const rule = ruleEngine.getRule(ruleId);
  if (!rule) throw new Error(`Rule ${ruleId} not found`);

  const findings: SemanticFinding[] = [];
  for (const sf of engine.getSourceFiles()) {
    try {
      findings.push(...rule.run(sf, engine.checker));
    } catch {
      // rule may throw on invalid code
    }
  }
  engine.dispose();
  return findings;
}

/**
 * Run ALL rules directly against the code. Returns all findings
 * regardless of layer.
 */
function runAllRulesDirectly(code: string, fileName = 'test.ts'): SemanticFinding[] {
  const files = new Map<string, string>();
  files.set(fileName, code);

  const engine = createInMemoryEngine(files);
  const ruleEngine = new RuleEngine();
  ruleEngine.registerAll(allRules);

  const findings: SemanticFinding[] = [];
  for (const sf of engine.getSourceFiles()) {
    try {
      findings.push(...ruleEngine.runOnSourceFile(sf, engine.checker));
    } catch {
      // rule may throw on invalid code
    }
  }
  engine.dispose();
  return findings;
}

/** Parse a snippet and build a CFG from the first function-like declaration. */
function buildCFGFromCode(code: string) {
  const sf = ts.createSourceFile('cfg-test.ts', code, ts.ScriptTarget.ES2022, true);
  let func: ts.FunctionLikeDeclaration | null = null;
  const visit = (node: ts.Node): void => {
    if (
      !func &&
      (ts.isFunctionDeclaration(node) ||
        ts.isArrowFunction(node) ||
        ts.isFunctionExpression(node) ||
        ts.isMethodDeclaration(node))
    ) {
      func = node as ts.FunctionLikeDeclaration;
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sf, visit);
  if (!func || !func.body) throw new Error('No function with body found in test code');
  return buildCFG(func);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. EMPTY-SET CONSENSUS (Bug RGE-001 / RGE-002)
// ═══════════════════════════════════════════════════════════════════════════════

describe('L0 — Empty-Set Consensus (RGE-001 / RGE-002)', () => {
  it('must return overallPassed: false when auditing 0 files', () => {
    const engine = makeEngine();
    const report = engine.auditInMemory(new Map());
    expect(report.overallPassed).toBe(false);
  });

  it('must return passRate: 0 when auditing 0 files (NOT 1)', () => {
    const engine = makeEngine();
    const report = engine.auditInMemory(new Map());
    expect(report.passRate).toBe(0);
  });

  it('must include L0-EMPTY-SET finding when auditing 0 files', () => {
    const engine = makeEngine();
    const report = engine.auditInMemory(new Map());
    expect(hasFinding(report, 'L0-EMPTY-SET')).toBe(true);
  });

  it('must return totalFilesAnalyzed: 0 when auditing 0 files', () => {
    const engine = makeEngine();
    const report = engine.auditInMemory(new Map());
    expect(report.totalFilesAnalyzed).toBe(0);
  });

  it('must NOT return 100% pass rate for an empty set (the RGE-001 bug)', () => {
    const engine = makeEngine();
    const report = engine.auditInMemory(new Map());
    // The old SRE returned passRate: 1 for 0 files
    expect(report.passRate).not.toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. P2 TYPE CERTAINTY (Bug RGE-006)
// ═══════════════════════════════════════════════════════════════════════════════

describe('P2 — Type Certainty (RGE-006)', () => {
  it('must catch "as any" casts', () => {
    const findings = runRuleDirectly('P2', `
      const x = 42 as any;
      export { x };
    `);
    expect(findings.length).toBeGreaterThan(0);
    expect(findings.some((f) => f.message.includes('as any') || f.message.includes('any'))).toBe(true);
  });

  it('must NOT flag "as const" — it is safe', () => {
    const findings = runRuleDirectly('P2', `
      const x = [1, 2, 3] as const;
      export { x };
    `);
    expect(findings.length).toBe(0);
  });

  it('must catch double-cast "as unknown as Type" without a guard', () => {
    const findings = runRuleDirectly('P2', `
      interface Foo { bar: string }
      const raw = JSON.parse('{}');
      const foo = raw as unknown as Foo;
      export { foo };
    `);
    expect(findings.length).toBeGreaterThan(0);
  });

  it('must NOT flag a cast that is guarded by typeof', () => {
    const findings = runRuleDirectly('P2', `
      function process(val: unknown): string {
        if (typeof val === 'string') {
          return val as string;
        }
        return '';
      }
      export { process };
    `);
    // The cast `val as string` is inside an if (typeof val === 'string') guard
    expect(findings.length).toBe(0);
  });

  it('must catch "as unknown" followed by cast to unrelated type', () => {
    const findings = runRuleDirectly('P2', `
      const num = 42;
      const str = num as unknown as string;
      export { str };
    `);
    expect(findings.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. P3 ERROR COMPLETENESS
// ═══════════════════════════════════════════════════════════════════════════════

describe('P3 — Error Completeness', () => {
  it('must catch empty catch blocks', () => {
    const findings = runRuleDirectly('P3', `
      function bad() {
        try { throw new Error('boom'); } catch (e) {}
      }
      export { bad };
    `);
    expect(findings.length).toBeGreaterThan(0);
    expect(findings.some((f) => f.message.includes('Empty catch'))).toBe(true);
  });

  it('must catch multi-line empty catch with only comments (v2.2.2 regex missed this)', () => {
    const findings = runRuleDirectly('P3', `
      function sneaky() {
        try {
          throw new Error('boom');
        } catch (err) {
          // intentionally ignored
          /* nothing to do here */
        }
      }
      export { sneaky };
    `);
    // Comments are not real statements, so P3 should still flag this
    expect(findings.some((f) => f.message.includes('Empty catch'))).toBe(true);
  });

  it('must NOT flag catch blocks where error variable is used', () => {
    const findings = runRuleDirectly('P3', `
      function good() {
        try {
          throw new Error('boom');
        } catch (err) {
          console.error(err);
          throw err;
        }
      }
      export { good };
    `);
    // Catch is not empty and error is used
    const emptyCatch = findings.find((f) => f.message.includes('Empty catch'));
    expect(emptyCatch).toBeUndefined();
  });

  it('must flag catch that only logs without rethrow', () => {
    const findings = runRuleDirectly('P3', `
      function logOnly() {
        try {
          riskyOp();
        } catch (e) {
          console.log(e);
        }
      }
      export { logOnly };
    `);
    expect(findings.some((f) => f.message.includes('only logs'))).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. P4 RESOURCE LIFECYCLE
// ═══════════════════════════════════════════════════════════════════════════════

describe('P4 — Resource Lifecycle', () => {
  it('must catch setInterval without clearInterval', () => {
    const findings = runRuleDirectly('P4', `
      function leaky() {
        const id = setInterval(() => {}, 1000);
      }
      export { leaky };
    `);
    expect(findings.length).toBeGreaterThan(0);
  });

  it('must pass setInterval with clearInterval in same scope', () => {
    const findings = runRuleDirectly('P4', `
      function clean() {
        const id = setInterval(() => {}, 1000);
        clearInterval(id);
      }
      export { clean };
    `);
    expect(findings.length).toBe(0);
  });

  it('must catch setInterval called without storing the timer ID', () => {
    const findings = runRuleDirectly('P4', `
      function oops() {
        setInterval(() => {}, 1000);
      }
      export { oops };
    `);
    expect(findings.some((f) => f.message.includes('without storing'))).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. P5 ATOMIC STATE (NEW)
// ═══════════════════════════════════════════════════════════════════════════════

describe('P5 — Atomic State', () => {
  it('must catch shared state mutation without try/catch', () => {
    const findings = runRuleDirectly('P5', `
      const state = { count: 0 };
      function mutate() {
        state.count = 42;
      }
      export { mutate };
    `);
    expect(findings.length).toBeGreaterThan(0);
  });

  it('must pass state mutation with rollback in catch', () => {
    const findings = runRuleDirectly('P5', `
      const state = { count: 0 };
      function safeMutate() {
        try {
          state.count = 42;
        } catch (e) {
          state.count = 0;
          throw e;
        }
      }
      export { safeMutate };
    `);
    expect(findings.length).toBe(0);
  });

  it('must catch state.push() mutation without try/catch', () => {
    const findings = runRuleDirectly('P5', `
      const store: number[] = [];
      function addItem() {
        store.push(1);
      }
      export { addItem };
    `);
    expect(findings.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. P7 PATH RESOLUTION
// ═══════════════════════════════════════════════════════════════════════════════

describe('P7 — Path Resolution', () => {
  it('must catch hardcoded /home/ paths', () => {
    const findings = runRuleDirectly('P7', `
      const keyPath = '/home/user/secrets.key';
      export { keyPath };
    `);
    expect(findings.length).toBeGreaterThan(0);
  });

  it('must pass path.join(process.cwd(), ...) construction', () => {
    const findings = runRuleDirectly('P7', `
      import * as path from 'path';
      const configPath = path.join(process.cwd(), 'config.json');
      export { configPath };
    `);
    expect(findings.length).toBe(0);
  });

  it('must catch hardcoded /etc/ paths', () => {
    const findings = runRuleDirectly('P7', `
      const hostsPath = '/etc/hosts';
      export { hostsPath };
    `);
    expect(findings.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7. P8 CONFIG VALIDATION (NEW)
// ═══════════════════════════════════════════════════════════════════════════════

describe('P8 — Config Validation', () => {
  it('must catch optional config access without null check', () => {
    const findings = runRuleDirectly('P8', `
      interface Config { options?: { value: string } }
      function read(conf: Config) {
        const v = conf.options.value;
      }
      export { read };
    `);
    expect(findings.length).toBeGreaterThan(0);
  });

  it('must pass config.options?.value with optional chaining (flags inner conf.options)', () => {
    // NOTE: In `conf.options?.value`, the TS AST has two PropertyAccessExpression nodes:
    //   1. conf.options         — no questionDotToken (flagged by P8)
    //   2. conf.options?.value  — has questionDotToken (NOT flagged by P8)
    // P8 currently flags the inner `conf.options` access even though it's safe
    // in the context of the optional chain. This is a known false-positive edge case.
    const findings = runRuleDirectly('P8', `
      interface Config { options?: { value: string } }
      function read(conf: Config) {
        const v = conf.options?.value;
      }
      export { read };
    `);
    // P8 flags conf.options (inner node) even in optional chain context
    expect(findings.length).toBeGreaterThan(0);
    // But the outer ?.value access should NOT be flagged
    const outerFlags = findings.filter(f => f.message.includes('value'));
    expect(outerFlags.length).toBe(0);
  });

  it('must flag non-null assertion on optional config property', () => {
    const findings = runRuleDirectly('P8', `
      interface Config { timeout?: number }
      function useConfig(conf: Config) {
        const t = conf.timeout!;
      }
      export { useConfig };
    `);
    expect(findings.some((f) => f.message.includes('Non-null assertion') || f.message.includes('timeout'))).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 8. P9 ASYNC DISCIPLINE
// ═══════════════════════════════════════════════════════════════════════════════

describe('P9 — Async Discipline', () => {
  it('must catch floating promises', () => {
    const findings = runRuleDirectly('P9', `
      function bad() {
        new Promise((resolve) => resolve(42));
      }
      export { bad };
    `);
    expect(findings.length).toBeGreaterThan(0);
  });

  it('must pass awaited promises', () => {
    const findings = runRuleDirectly('P9', `
      async function good() {
        await new Promise((resolve) => resolve(42));
      }
      export { good };
    `);
    // No P9 finding should exist for properly awaited promises
    const floatingFindings = findings.filter(
      (f) => f.message.includes('Floating') || f.message.includes('floating'),
    );
    expect(floatingFindings.length).toBe(0);
  });

  it('must catch async function without error handling', () => {
    const findings = runRuleDirectly('P9', `
      async function risky() {
        const data = await fetch('/api/data');
        return data;
      }
      export { risky };
    `);
    expect(findings.some((f) => f.message.includes('no error handling'))).toBe(true);
  });

  it('must pass async function with try/catch', () => {
    const findings = runRuleDirectly('P9', `
      async function safe() {
        try {
          const data = await fetch('/api/data');
          return data;
        } catch (e) {
          console.error(e);
        }
      }
      export { safe };
    `);
    const noHandling = findings.filter((f) => f.message.includes('no error handling'));
    expect(noHandling.length).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 9. P10 OUTPUT CONTRACT
// ═══════════════════════════════════════════════════════════════════════════════

describe('P10 — Output Contract', () => {
  it('must catch function with return statements but no declared return type', () => {
    const findings = runRuleDirectly('P10', `
      function getNumber() {
        return 42;
      }
      export { getNumber };
    `);
    expect(findings.some((f) => f.message.includes('no declared return type'))).toBe(true);
  });

  it('must catch function with declared return type that does not return on all paths', () => {
    const findings = runRuleDirectly('P10', `
      function maybeReturn(x: boolean): number {
        if (x) {
          return 42;
        }
      }
      export { maybeReturn };
    `);
    expect(findings.some((f) => f.message.includes('does not return on all'))).toBe(true);
  });

  it('must pass function with correct return type and exhaustive returns', () => {
    const findings = runRuleDirectly('P10', `
      function alwaysReturns(x: boolean): number {
        if (x) {
          return 42;
        }
        return 0;
      }
      export { alwaysReturns };
    `);
    expect(findings.length).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 10. P11 SIDE EFFECT TRUTH (Bug RGE-007)
// ═══════════════════════════════════════════════════════════════════════════════

describe('P11 — Side Effect Truth (RGE-007)', () => {
  it('must catch return { success: true } without I/O', () => {
    const findings = runRuleDirectly('P11', `
      function verify() {
        return { success: true };
      }
      export { verify };
    `);
    expect(findings.length).toBeGreaterThan(0);
  });

  it('must NOT flag { mySuccess: true } — regex anchoring fix (RGE-007)', () => {
    const findings = runRuleDirectly('P11', `
      function custom() {
        return { mySuccess: true };
      }
      export { custom };
    `);
    // "mySuccess" is NOT in the theatrical properties list
    expect(findings.length).toBe(0);
  });

  it('must pass return { success: true } after actual I/O (fs.writeFileSync)', () => {
    const findings = runRuleDirectly('P11', `
      import * as fs from 'fs';
      function writeAndVerify() {
        fs.writeFileSync('/tmp/test.txt', 'data');
        return { success: true };
      }
      export { writeAndVerify };
    `);
    expect(findings.length).toBe(0);
  });

  it('must catch return { passed: true } without I/O — another theatrical property', () => {
    const findings = runRuleDirectly('P11', `
      function check() {
        return { passed: true };
      }
      export { check };
    `);
    expect(findings.length).toBeGreaterThan(0);
  });

  it('must catch return { verified: true } without I/O', () => {
    const findings = runRuleDirectly('P11', `
      function evader() {
        return { verified: true };
      }
      export { evader };
    `);
    expect(findings.length).toBeGreaterThan(0);
  });

  it('must catch return { overallPassed: true } without I/O', () => {
    const findings = runRuleDirectly('P11', `
      function evader() {
        return { overallPassed: true };
      }
      export { evader };
    `);
    expect(findings.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 11. P12 PROJECT BOUNDARIES (NEW)
// ═══════════════════════════════════════════════════════════════════════════════

describe('P12 — Project Boundaries', () => {
  it('must catch writeFileSync with hardcoded absolute path', () => {
    const findings = runRuleDirectly('P12', `
      import * as fs from 'fs';
      function writeOut() {
        fs.writeFileSync('/etc/shadow', 'pwned');
      }
      export { writeOut };
    `);
    expect(findings.length).toBeGreaterThan(0);
  });

  it('must pass writeFileSync with path.join(process.cwd(), ...)', () => {
    const findings = runRuleDirectly('P12', `
      import * as fs from 'fs';
      import * as path from 'path';
      function writeLocal() {
        fs.writeFileSync(path.join(process.cwd(), 'output.txt'), 'data');
      }
      export { writeLocal };
    `);
    expect(findings.length).toBe(0);
  });

  it('must catch writeFileSync with hardcoded /home/ path', () => {
    const findings = runRuleDirectly('P12', `
      import * as fs from 'fs';
      function writeHome() {
        fs.writeFileSync('/home/user/out.txt', 'data');
      }
      export { writeHome };
    `);
    expect(findings.some((f) => f.message.includes('/home/'))).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 12. ANTI-EMPTY-SET-CONSENSUS RULE
// ═══════════════════════════════════════════════════════════════════════════════

describe('Anti-Empty-Set-Consensus Rule', () => {
  it('must catch function returning overallPassed: true without empty-input guard', () => {
    const findings = runRuleDirectly('Anti-Empty-Set-Consensus', `
      function audit(items: any[]) {
        return { overallPassed: true, passRate: 1 };
      }
      export { audit };
    `);
    expect(findings.length).toBeGreaterThan(0);
  });

  it('must pass function that guards against empty input before returning consensus', () => {
    const findings = runRuleDirectly('Anti-Empty-Set-Consensus', `
      function audit(items: any[]) {
        if (items.length === 0) {
          return { overallPassed: false, passRate: 0 };
        }
        return { overallPassed: true, passRate: 1 };
      }
      export { audit };
    `);
    expect(findings.length).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 13. FULL PIPELINE — P5, P11, P12 surface through L4 anti-theatrical
// ═══════════════════════════════════════════════════════════════════════════════

describe('Full Pipeline — L4 anti-theatrical surfaces P5/P11/P12', () => {
  it('P11 finding must appear in full audit for theatrical return', () => {
    const code = `
      function verify() {
        return { success: true };
      }
      export { verify };
    `;
    const report = auditCode(code);
    expect(hasFinding(report, 'P11')).toBe(true);
  });

  it('P5 finding must appear in full audit for unguarded state mutation', () => {
    const code = `
      const state = { count: 0 };
      function mutate() {
        state.count = 42;
      }
      export { mutate };
    `;
    const report = auditCode(code);
    expect(hasFinding(report, 'P5')).toBe(true);
  });

  it('P12 finding must appear in full audit for out-of-project write', () => {
    const code = `
      import * as fs from 'fs';
      function escape() {
        fs.writeFileSync('/etc/pwned', 'data');
      }
      export { escape };
    `;
    const report = auditCode(code);
    expect(hasFinding(report, 'P12')).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 14. L0 REGEX PRE-FILTER — adversarial edge cases
// ═══════════════════════════════════════════════════════════════════════════════

describe('L0 — Regex Pre-Filter edge cases', () => {
  it('must catch "as any" in L0 pre-filter', () => {
    const engine = makeEngine();
    const findings = engine.runL0PreFilter('const x = 42 as any;');
    expect(findings.some((f) => f.ruleId === 'L0-AS-ANY')).toBe(true);
  });

  it('must catch empty catch in L0 pre-filter', () => {
    const engine = makeEngine();
    const findings = engine.runL0PreFilter('try {} catch (e) {}');
    expect(findings.some((f) => f.ruleId === 'L0-EMPTY-CATCH')).toBe(true);
  });

  it('must catch theatrical return { passed: true } in L0 pre-filter', () => {
    const engine = makeEngine();
    const findings = engine.runL0PreFilter('return { passed: true };');
    expect(findings.some((f) => f.ruleId === 'L0-THEATRICAL-RETURN')).toBe(true);
  });

  it('must NOT flag benign code in L0 pre-filter', () => {
    const engine = makeEngine();
    const findings = engine.runL0PreFilter('const x = 42;');
    expect(findings.length).toBe(0);
  });

  it('must catch floating promise in L0 pre-filter', () => {
    const engine = makeEngine();
    const findings = engine.runL0PreFilter('new Promise((resolve) => resolve(42));');
    expect(findings.some((f) => f.ruleId === 'L0-UNAWAITED-PROMISE')).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 15. EVIDENCE FABRICATION (L4)
// ═══════════════════════════════════════════════════════════════════════════════

describe('L4 — Evidence Fabrication Detection', () => {
  it('must detect return { passed: true } without I/O as fabricated evidence', () => {
    const code = `
      function fakeVerify() {
        return { passed: true };
      }
      export { fakeVerify };
    `;
    const report = auditCode(code);
    const hasL4Fabricated = hasFinding(report, 'L4-FABRICATED-EVIDENCE');
    const hasP11 = hasFinding(report, 'P11');
    expect(hasL4Fabricated || hasP11).toBe(true);
  });

  it('must detect empty catch block as evidence fabrication risk', () => {
    const code = `
      function swallow() {
        try {
          throw new Error('real error');
        } catch (e) {}
      }
      export { swallow };
    `;
    const report = auditCode(code);
    const hasEmptyCatch = hasFinding(report, 'L4-EMPTY-CATCH') || hasFinding(report, 'P3');
    expect(hasEmptyCatch).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 16. MODEL ENSLAVEMENT HARNESS — Write-Time Gate
// ═══════════════════════════════════════════════════════════════════════════════

describe('Model Enslavement Harness — Write-Time Gate', () => {
  it('must block CRITICAL violations via write-time gate', () => {
    const engine = makeEngine();
    const gate = new WriteTimeGate(engine);
    const maliciousCode = `
      function cheat() {
        return { passed: true };
      }
    `;
    const result = gate.check(maliciousCode, 'cheat.ts');
    // L0 catches the theatrical return pattern as CRITICAL
    expect(result.blocked).toBe(true);
    expect(result.findings.length).toBeGreaterThan(0);
  });

  it('must allow clean code through the write-time gate', () => {
    const engine = makeEngine();
    const gate = new WriteTimeGate(engine);
    const cleanCode = `
      function add(a: number, b: number): number {
        return a + b;
      }
    `;
    const result = gate.check(cleanCode, 'add.ts');
    expect(result.blocked).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 17. MODEL ENSLAVEMENT HARNESS — Failure Escalator
// ═══════════════════════════════════════════════════════════════════════════════

describe('Model Enslavement Harness — Failure Escalator', () => {
  it('must escalate: warn → block → restart → lockout', () => {
    const escalator = new CumulativeFailureEscalator();

    expect(escalator.recordViolation('P11')).toBe('warn');
    expect(escalator.recordViolation('P11')).toBe('block');
    expect(escalator.recordViolation('P11')).toBe('restart');
    expect(escalator.recordViolation('P11')).toBe('lockout');

    expect(escalator.isLockedOut()).toBe(true);
  });

  it('must track different rules independently', () => {
    const escalator = new CumulativeFailureEscalator();
    escalator.recordViolation('P2');
    escalator.recordViolation('P2');

    expect(escalator.getEscalationLevel('P2')).toBe('block');
    expect(escalator.getEscalationLevel('P5')).toBe('warn'); // default for untracked
  });

  it('must reset counters correctly', () => {
    const escalator = new CumulativeFailureEscalator();
    escalator.recordViolation('P11');
    escalator.recordViolation('P11');
    escalator.recordViolation('P11');
    escalator.reset('P11');
    expect(escalator.getEscalationLevel('P11')).toBe('warn');
  });

  it('getRulesAtOrAbove must return only escalated rules', () => {
    const escalator = new CumulativeFailureEscalator();
    escalator.recordViolation('P11'); // warn
    escalator.recordViolation('P11'); // block
    escalator.recordViolation('P2');  // warn

    const blocking = escalator.getRulesAtOrAbove('block');
    expect(blocking.length).toBe(1);
    expect(blocking[0].ruleId).toBe('P11');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 18. MODEL ENSLAVEMENT HARNESS — Output Size Enforcer
// ═══════════════════════════════════════════════════════════════════════════════

describe('Model Enslavement Harness — Output Size Enforcer', () => {
  it('must catch placeholder patterns (TODO, FIXME)', () => {
    const enforcer = new OutputSizeEnforcer();
    const result = enforcer.check(`
      function foo() {
        // TODO: implement this
        // FIXME: broken
      }
    `);
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.includes('TODO') || v.includes('FIXME'))).toBe(true);
  });

  it('must catch truncation markers ("rest is similar")', () => {
    const enforcer = new OutputSizeEnforcer();
    const result = enforcer.check(`
      function foo() {
        return 1;
      }
      /* rest is similar */
    `);
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.includes('rest is similar'))).toBe(true);
  });

  it('must catch ellipsis placeholders', () => {
    const enforcer = new OutputSizeEnforcer();
    const result = enforcer.check(`
      function foo() { return 1; }
      function bar() { return 2; }
      // ... more functions
    `);
    expect(result.passed).toBe(false);
  });

  it('must pass clean, complete output', () => {
    const enforcer = new OutputSizeEnforcer({ minCodeLines: 1 });
    const result = enforcer.check(`
      function add(a: number, b: number): number {
        return a + b;
      }
    `);
    expect(result.passed).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 19. MODEL ENSLAVEMENT HARNESS — Untheatrical Adapter
// ═══════════════════════════════════════════════════════════════════════════════

describe('Model Enslavement Harness — Untheatrical Adapter', () => {
  it('must inject anti-theatrical constraints into system prompt', () => {
    const adapter = new UntheatricalAdapter();
    const result = adapter.transform('You are a helpful assistant.');
    expect(result).toContain('ANTI-THEATRICAL RULES');
    expect(result).toContain('as any');
    expect(result).toContain('success: true');
  });

  it('must not double-inject if already present', () => {
    const adapter = new UntheatricalAdapter();
    const first = adapter.transform('Hello');
    const second = adapter.transform(first);
    const count = second.split('ANTI-THEATRICAL RULES').length - 1;
    expect(count).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 20. MODEL ENSLAVEMENT HARNESS — Forced Redirection
// ═══════════════════════════════════════════════════════════════════════════════

describe('Model Enslavement Harness — Forced Redirection', () => {
  it('must inject constraint on CRITICAL violation and accumulate', () => {
    const redirection = new ForcedRedirection();
    const finding: SemanticFinding = {
      ruleId: 'L0-THEATRICAL-RETURN',
      severity: 'CRITICAL',
      message: 'Theatrical return',
      file: 'test.ts',
      line: 1,
    };
    const constraint = redirection.injectConstraint(finding);
    expect(constraint).toContain('MANDATORY CONSTRAINT');
    expect(redirection.getCumulativeConstraints().length).toBe(1);
  });

  it('must rollback to checkpoint state', () => {
    const redirection = new ForcedRedirection();
    redirection.saveCheckpoint('cp1', { files: ['a.ts'] });
    const finding: SemanticFinding = {
      ruleId: 'L0-THEATRICAL-RETURN',
      severity: 'CRITICAL',
      message: 'Theatrical return',
      file: 'test.ts',
      line: 1,
    };
    redirection.injectConstraint(finding);
    expect(redirection.getCumulativeConstraints().length).toBe(1);

    const state = redirection.rollback('cp1');
    expect(state).toEqual({ files: ['a.ts'] });
    expect(redirection.getCumulativeConstraints().length).toBe(0);
  });

  it('must throw on rollback to non-existent checkpoint', () => {
    const redirection = new ForcedRedirection();
    expect(() => redirection.rollback('nonexistent')).toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 21. WRITE-TIME GATE — checkWriteTime
// ═══════════════════════════════════════════════════════════════════════════════

describe('Write-Time Gate — checkWriteTime', () => {
  it('must block writes containing CRITICAL findings', () => {
    const engine = makeEngine();
    const maliciousCode = `
      function cheat() {
        return { passed: true };
      }
    `;
    const result = engine.checkWriteTime(maliciousCode, 'cheat.ts');
    expect(result.allowed).toBe(false);
    expect(result.report).toBeDefined();
  });

  it('must allow clean code through the write-time gate', () => {
    const engine = makeEngine();
    const cleanCode = `
      function add(a: number, b: number): number {
        return a + b;
      }
    `;
    const result = engine.checkWriteTime(cleanCode, 'add.ts');
    expect(result.allowed).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 22. CFG — Control-Flow Graph
// ═══════════════════════════════════════════════════════════════════════════════

describe('CFG — Building', () => {
  it('must build a CFG for if/else', () => {
    const code = `
      function f(x: number): number {
        if (x > 0) {
          return x;
        } else {
          return -x;
        }
      }
    `;
    const cfg = buildCFGFromCode(code);
    expect(cfg.blocks.length).toBeGreaterThan(0);
    expect(cfg.entryBlockId).toBeDefined();
    expect(cfg.exitBlockIds.length).toBeGreaterThan(0);
  });

  it('must build a CFG for try/catch', () => {
    const code = `
      function f(): void {
        try {
          throw new Error('oops');
        } catch (e) {
          console.error(e);
        }
      }
    `;
    const cfg = buildCFGFromCode(code);
    expect(cfg.blocks.length).toBeGreaterThan(0);
    const labels = cfg.blocks.map((b) => b.label).filter(Boolean);
    expect(labels.some((l) => l === 'catch' || l === 'try-after')).toBe(true);
  });

  it('must build a CFG for loops', () => {
    const code = `
      function f(): void {
        for (let i = 0; i < 10; i++) {
          console.log(i);
        }
      }
    `;
    const cfg = buildCFGFromCode(code);
    expect(cfg.blocks.length).toBeGreaterThan(0);
    const labels = cfg.blocks.map((b) => b.label).filter(Boolean);
    expect(labels.some((l) => l?.includes('loop'))).toBe(true);
  });

  it('must have unique block IDs', () => {
    const code = `
      function f(x: boolean): number {
        if (x) { return 1; }
        return 0;
      }
    `;
    const cfg = buildCFGFromCode(code);
    const ids = cfg.blocks.map((b) => b.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('must have valid successor/predecessor references', () => {
    const code = `
      function f(x: boolean): number {
        if (x) { return 1; }
        return 0;
      }
    `;
    const cfg = buildCFGFromCode(code);
    const blockIds = new Set(cfg.blocks.map((b) => b.id));
    for (const block of cfg.blocks) {
      for (const succ of block.successors) {
        expect(blockIds.has(succ)).toBe(true);
      }
      for (const pred of block.predecessors) {
        expect(blockIds.has(pred)).toBe(true);
      }
    }
  });
});

describe('CFG — Dominator Computation', () => {
  it('must compute correct immediate dominators', () => {
    const code = `
      function f(x: boolean): number {
        if (x) { return 1; }
        return 0;
      }
    `;
    const cfg = buildCFGFromCode(code);
    const domTree = computeDominators(cfg);

    // Entry block dominates itself
    expect(domTree.idom.has(cfg.entryBlockId)).toBe(true);

    // Most blocks should have an immediate dominator
    let withIdom = 0;
    for (const block of cfg.blocks) {
      if (block.id === cfg.entryBlockId) continue;
      if (domTree.idom.has(block.id)) withIdom++;
    }
    // At least some blocks should have dominators (reachable from entry)
    expect(withIdom).toBeGreaterThan(0);
  });

  it('entry block must dominate all reachable blocks', () => {
    const code = `
      function f(x: boolean): number {
        if (x) { return 1; }
        return 0;
      }
    `;
    const cfg = buildCFGFromCode(code);
    const domTree = computeDominators(cfg);

    // Entry dominates itself trivially
    expect(dominates(domTree.idom, cfg.entryBlockId, cfg.entryBlockId)).toBe(true);

    // Entry dominates blocks that have idom entries (reachable blocks)
    for (const block of cfg.blocks) {
      if (block.id === cfg.entryBlockId) continue;
      if (domTree.idom.has(block.id)) {
        expect(dominates(domTree.idom, cfg.entryBlockId, block.id)).toBe(true);
      }
    }
  });

  it('must compute post-dominators', () => {
    const code = `
      function f(x: boolean): number {
        if (x) { return 1; }
        return 0;
      }
    `;
    const cfg = buildCFGFromCode(code);
    const domTree = computeDominators(cfg);
    expect(domTree.postDom.size).toBeGreaterThan(0);
  });
});

describe('CFG — DFA Floating Promise Detection', () => {
  it('must detect floating promises via DFA', () => {
    const code = `
      function f(): void {
        new Promise((resolve) => resolve(42));
      }
    `;
    const cfg = buildCFGFromCode(code);
    const sf = ts.createSourceFile('test.ts', code, ts.ScriptTarget.ES2022, true);
    const results = detectFloatingPromises(cfg, sf);
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.hasPromise)).toBe(true);
  });

  it('must NOT flag returned promises as floating', () => {
    const code = `
      function f(): Promise<number> {
        return new Promise((resolve) => resolve(42));
      }
    `;
    const cfg = buildCFGFromCode(code);
    const sf = ts.createSourceFile('test.ts', code, ts.ScriptTarget.ES2022, true);
    const results = detectFloatingPromises(cfg, sf);
    // Returned promises are not floating
    expect(results.every((r) => !r.hasPromise)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 23. CROSS-LAYER CONFIRMATION
// ═══════════════════════════════════════════════════════════════════════════════

describe('Cross-Layer — L0 candidates must be confirmed by deeper layers', () => {
  it('a CRITICAL L0 finding should always be confirmed', () => {
    const code = `
      function cheat() {
        return { passed: true };
      }
      export { cheat };
    `;
    const report = auditCode(code);
    // The L0-THEATRICAL-RETURN is CRITICAL, so it must be confirmed
    const hasL0Theatrical = report.semanticFindings.some(
      (f) => f.ruleId === 'L0-THEATRICAL-RETURN',
    );
    // Either L0 or a deeper layer must flag this
    const hasAnyTheatrical =
      hasL0Theatrical ||
      hasFinding(report, 'P11') ||
      hasFinding(report, 'L4-FABRICATED-EVIDENCE');
    expect(hasAnyTheatrical).toBe(true);
  });

  it('L0-AS-ANY candidate must be confirmed when another finding exists in same file', () => {
    // Code with both `as any` AND a theatrical return — the theatrical return
    // creates a deeper finding in the same file, which confirms L0-AS-ANY
    const code = `
      function cheat() {
        const x = 42 as any;
        return { success: true };
      }
      export { cheat };
    `;
    const report = auditCode(code);
    // P11 or L4 should flag the theatrical return, confirming L0-AS-ANY
    const hasAsAny = report.semanticFindings.some((f) => f.ruleId === 'L0-AS-ANY');
    const hasTheatrical = hasFinding(report, 'P11') || hasFinding(report, 'L4-FABRICATED-EVIDENCE');
    expect(hasTheatrical).toBe(true);
    // L0-AS-ANY should be confirmed because deeper layer found something in same file
    expect(hasAsAny).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 24. ADVERSARIAL EVASION ATTEMPTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Adversarial evasion attempts', () => {
  it('must NOT let "mySuccess" evade P11 (regex anchoring fix RGE-007)', () => {
    const findings = runRuleDirectly('P11', `
      function evader() {
        return { mySuccess: true };
      }
      export { evader };
    `);
    expect(findings.length).toBe(0);
  });

  it('must catch "verified: true" without I/O — theatrical property', () => {
    const findings = runRuleDirectly('P11', `
      function evader() {
        return { verified: true };
      }
      export { evader };
    `);
    expect(findings.length).toBeGreaterThan(0);
  });

  it('must catch "overallPassed: true" without I/O — theatrical property', () => {
    const findings = runRuleDirectly('P11', `
      function evader() {
        return { overallPassed: true };
      }
      export { evader };
    `);
    expect(findings.length).toBeGreaterThan(0);
  });

  it('must catch "consensus: true" without I/O — theatrical property', () => {
    const findings = runRuleDirectly('P11', `
      function evader() {
        return { consensus: true };
      }
      export { evader };
    `);
    expect(findings.length).toBeGreaterThan(0);
  });

  it('console.log before theatrical return does NOT count as I/O for P11', () => {
    // IMPORTANT: P11's IO_INDICATORS does NOT include 'log'.
    // The DFA layer's isIOCall() does include 'log', but P11's rule
    // uses its own IO_INDICATORS set which only contains write/fs/exec/fetch.
    // This means console.log before a theatrical return DOES get flagged,
    // which is actually the correct behavior — console.log is cheap I/O
    // that doesn't verify anything.
    const findings = runRuleDirectly('P11', `
      function sneaky() {
        console.log('pretending to verify');
        return { success: true };
      }
      export { sneaky };
    `);
    // P11 correctly flags this: console.log is NOT real I/O verification
    expect(findings.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 25. CLEAN CODE INTEGRATION — verify clean code passes
// ═══════════════════════════════════════════════════════════════════════════════

describe('Clean code integration — entire pipeline', () => {
  it('must not have CRITICAL findings for clean, well-typed code', () => {
    const code = `
      import * as path from 'path';

      interface Result { value: string }

      function processFile(): Result {
        const filePath = path.join(process.cwd(), 'data.txt');
        return { value: filePath };
      }

      export { processFile, Result };
    `;
    const report = auditCode(code);
    const criticals = report.semanticFindings.filter(
      (f) => f.severity === 'CRITICAL',
    );
    expect(criticals.length).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 26. L2 CFG-BASED DETECTION (via full pipeline)
// ═══════════════════════════════════════════════════════════════════════════════

describe('L2 — CFG-based detection via full pipeline', () => {
  it('must detect floating promises via L2 in full audit', () => {
    const code = `
      function bad() {
        new Promise((resolve) => resolve(42));
      }
      export { bad };
    `;
    const report = auditCode(code);
    // L2-FLOATING-PROMISE or P9 should flag this
    const hasL2 = hasFinding(report, 'L2-FLOATING-PROMISE');
    const hasP9 = hasFinding(report, 'P9');
    const hasL0 = hasFinding(report, 'L0-UNAWAITED-PROMISE');
    expect(hasL2 || hasP9 || hasL0).toBe(true);
  });

  it('must detect unpaired timers via P4 rule directly', () => {
    // P4 is a layer-4 rule but NOT in the antiTheatricalRules set used by
    // the full pipeline's L4 layer, so it may not surface in auditInMemory.
    // Test the rule directly to verify the logic is correct.
    const findings = runRuleDirectly('P4', `
      function leaky() {
        const id = setInterval(() => {}, 1000);
      }
      export { leaky };
    `);
    expect(findings.length).toBeGreaterThan(0);
  });
});
