/**
 * Spider v2.3 — Pattern Database
 *
 * Replaces the old string-matching pattern DB with structured pattern
 * matching.  Pre-loaded with known failure patterns that correspond
 * to findings from the 6-layer audit pipeline.
 *
 * Each pattern defines a set of symptom matchers that are evaluated
 * against the current set of SemanticFindings.  When all symptoms
 * match, the pattern fires and produces a PatternMatch with a
 * confidence score and a suggested fix.
 */

import * as fs from 'fs';
import type { SemanticFinding, StructuredPattern, FindingMatcher } from './types.js';

// ---------------------------------------------------------------------------
// PatternMatch — the output of querying the pattern database
// ---------------------------------------------------------------------------

export interface PatternMatch {
  /** Unique pattern identifier. */
  patternId: string;
  /** Confidence score [0, 1]. */
  confidence: number;
  /** Suggested fix for the matched pattern. */
  suggestedFix: string;
}

// ---------------------------------------------------------------------------
// Known failure patterns
// ---------------------------------------------------------------------------

const KNOWN_PATTERNS: StructuredPattern[] = [
  {
    id: 'fire-and-forget',
    name: 'Fire-and-Forget Promise',
    symptoms: [
      { ruleId: 'P9', minCount: 1 },
      { ruleId: '^L2-FLOATING-PROMISE$', messagePattern: 'floating', minCount: 1 },
    ],
    confidence: 0.92,
    fixStrategy:
      'Await all promises or chain .then/.catch handlers. ' +
      'Never create a Promise without a handler — it is a fire-and-forget bug.',
  },
  {
    id: 'theatrical-verification',
    name: 'Theatrical Verification',
    symptoms: [
      { ruleId: 'P11', minCount: 1 },
      { ruleId: '^L2-THEATRICAL-RETURN$', minCount: 1 },
    ],
    confidence: 0.95,
    fixStrategy:
      'Never return { passed: true } without performing I/O FIRST. ' +
      'The return value must be derived from actual verification, not just precede it.',
  },
  {
    id: 'resource-leak',
    name: 'Resource Leak',
    symptoms: [
      { ruleId: 'P4', minCount: 1 },
      { ruleId: '^L2-UNPAIRED-TIMER$', minCount: 1 },
    ],
    confidence: 0.88,
    fixStrategy:
      'Pair every setTimeout/setInterval with clearTimeout/clearInterval ' +
      'in a finally block.  Use the AbortController pattern for async cleanup.',
  },
  {
    id: 'empty-set-fraud',
    name: 'Empty-Set Fraud',
    symptoms: [
      { ruleId: 'L0-EMPTY-SET', minCount: 1 },
      { ruleId: 'anti-empty-set-consensus', minCount: 1 },
    ],
    confidence: 0.99,
    fixStrategy:
      'The audit was run on zero files and reported success. ' +
      'This is the empty-set consensus bug — always provide files for audit.',
  },
  {
    id: 'type-uncertainty',
    name: 'Type Uncertainty',
    symptoms: [
      { ruleId: 'P2', minCount: 2 },
      { severity: 'HIGH', messagePattern: 'typeof', minCount: 1 },
    ],
    confidence: 0.80,
    fixStrategy:
      'Replace typeof checks with TypeChecker-backed type guards. ' +
      'Use proper type narrowing (instanceof, in, discriminated unions).',
  },
  {
    id: 'config-hallucination',
    name: 'Configuration Hallucination',
    symptoms: [
      { ruleId: 'P8', minCount: 1 },
      { ruleId: 'P6', minCount: 1 },
    ],
    confidence: 0.85,
    fixStrategy:
      'Validate all configuration at startup with a schema. ' +
      'Never assume config values exist without checking.',
  },
  {
    id: 'defensive-absence',
    name: 'Defensive Import Absence',
    symptoms: [
      { ruleId: 'P1', minCount: 1 },
      { ruleId: 'P3', minCount: 1 },
    ],
    confidence: 0.75,
    fixStrategy:
      'Add defensive checks for all imported values and handle all error paths. ' +
      'Never assume an import will always resolve.',
  },
  {
    id: 'output-contract-violation',
    name: 'Output Contract Violation',
    symptoms: [
      { ruleId: 'P10', minCount: 1 },
      { ruleId: '^L0-PLACEHOLDER$', minCount: 1 },
    ],
    confidence: 0.90,
    fixStrategy:
      'Remove all placeholder patterns (TODO, FIXME, ...). ' +
      'Fulfill the output contract with complete, tested code.',
  },
  {
    id: 'boundary-violation',
    name: 'Project Boundary Violation',
    symptoms: [
      { ruleId: 'P12', minCount: 1 },
      { ruleId: '^L3-LAYER-VIOLATION$', minCount: 1 },
    ],
    confidence: 0.87,
    fixStrategy:
      'Respect architectural layer boundaries. ' +
      'Lower layers must not import from higher layers.',
  },
];

// ---------------------------------------------------------------------------
// PatternDatabase class
// ---------------------------------------------------------------------------

export class PatternDatabase {
  private patterns: StructuredPattern[];

  constructor(jsonPath?: string) {
    // Start with the built-in patterns
    this.patterns = [...KNOWN_PATTERNS];

    // Optionally load additional patterns from a JSON file
    if (jsonPath) {
      try {
        const raw = fs.readFileSync(jsonPath, 'utf-8');
        const loaded = JSON.parse(raw) as StructuredPattern[];
        for (const p of loaded) {
          this.patterns.push(p);
        }
      } catch {
        // Silently ignore load failures — built-in patterns are still available
      }
    }
  }

  /**
   * Query the pattern database against the current findings.
   * Returns all patterns whose symptoms match.
   */
  query(findings: SemanticFinding[]): PatternMatch[] {
    const matches: PatternMatch[] = [];

    for (const pattern of this.patterns) {
      if (this.evaluatePattern(pattern, findings)) {
        matches.push({
          patternId: pattern.id,
          confidence: pattern.confidence,
          suggestedFix: pattern.fixStrategy,
        });
      }
    }

    return matches;
  }

  /**
   * Add a custom pattern at runtime.
   */
  addPattern(pattern: StructuredPattern): void {
    // Validate: no duplicate IDs
    if (this.patterns.some((p) => p.id === pattern.id)) {
      throw new Error(
        `[PatternDatabase] Duplicate pattern ID: "${pattern.id}"`,
      );
    }
    this.patterns.push(pattern);
  }

  // -------------------------------------------------------------------------
  // Internal
  // -------------------------------------------------------------------------

  /**
   * Evaluate a single pattern against the current findings.
   * All symptoms must match for the pattern to fire.
   */
  private evaluatePattern(
    pattern: StructuredPattern,
    findings: SemanticFinding[],
  ): boolean {
    return pattern.symptoms.every((symptom) =>
      this.evaluateSymptom(symptom, findings),
    );
  }

  /**
   * Evaluate a single symptom matcher against the findings.
   */
  private evaluateSymptom(
    matcher: FindingMatcher,
    findings: SemanticFinding[],
  ): boolean {
    let matched = findings.filter((f) => this.findingMatchesMatcher(f, matcher));

    // Apply minCount threshold
    const minCount = matcher.minCount ?? 1;
    return matched.length >= minCount;
  }

  /**
   * Check whether a single finding matches a symptom matcher.
   */
  private findingMatchesMatcher(
    finding: SemanticFinding,
    matcher: FindingMatcher,
  ): boolean {
    // Match by ruleId (exact or regex)
    if (matcher.ruleId) {
      try {
        const regex = new RegExp(matcher.ruleId);
        if (!regex.test(finding.ruleId)) return false;
      } catch {
        // If the ruleId is not a valid regex, use exact match
        if (finding.ruleId !== matcher.ruleId) return false;
      }
    }

    // Match by severity
    if (matcher.severity && finding.severity !== matcher.severity) {
      return false;
    }

    // Match by file pattern (glob-like)
    if (matcher.filePattern) {
      try {
        const regex = new RegExp(matcher.filePattern);
        if (!regex.test(finding.file)) return false;
      } catch {
        if (!finding.file.includes(matcher.filePattern)) return false;
      }
    }

    // Match by message pattern
    if (matcher.messagePattern) {
      try {
        const regex = new RegExp(matcher.messagePattern);
        if (!regex.test(finding.message)) return false;
      } catch {
        if (!finding.message.includes(matcher.messagePattern)) return false;
      }
    }

    return true;
  }
}
