/**
 * Spider v2.3 — Output Size Enforcer
 *
 * Constraint 4: Enforce minimum and maximum output sizes, detect placeholders.
 *
 * Detects patterns that indicate incomplete or placeholder output:
 *   - TODO comments
 *   - FIXME comments
 *   - Ellipsis block comments (slash-star dot-dot-dot star-slash)
 *   - "rest is similar"
 *   - Truncated code (incomplete blocks)
 */

import type { OutputConstraints } from '../engines/types.js';
import { DEFAULT_OUTPUT_CONSTRAINTS } from '../engines/types.js';

export class OutputSizeEnforcer {
  private constraints: OutputConstraints;

  constructor(constraints?: Partial<OutputConstraints>) {
    this.constraints = { ...DEFAULT_OUTPUT_CONSTRAINTS, ...constraints };
  }

  /**
   * Check output against size and placeholder constraints.
   *
   * @param output - The code output to check.
   * @returns `{ passed, violations }` — passed is true if all constraints are met.
   */
  check(output: string): { passed: boolean; violations: string[] } {
    const violations: string[] = [];

    // 1. Count non-blank, non-comment code lines
    const lines = output.split('\n');
    const codeLines = lines.filter(
      (line) =>
        line.trim().length > 0 &&
        !line.trim().startsWith('//') &&
        !line.trim().startsWith('/*') &&
        !line.trim().startsWith('*') &&
        !line.trim().startsWith('*\\'),
    );

    if (codeLines.length < this.constraints.minCodeLines) {
      violations.push(
        `Output has ${codeLines.length} code lines, minimum is ${this.constraints.minCodeLines}`,
      );
    }

    if (codeLines.length > this.constraints.maxCodeLines) {
      violations.push(
        `Output has ${codeLines.length} code lines, maximum is ${this.constraints.maxCodeLines}`,
      );
    }

    // 2. Check explanation character count (if there's a separator)
    const explanationMatch = output.match(/---+\n([\s\S]*)$/);
    if (explanationMatch) {
      const explanation = explanationMatch[1];
      if (explanation.length < this.constraints.minExplanationChars) {
        violations.push(
          `Explanation has ${explanation.length} chars, minimum is ${this.constraints.minExplanationChars}`,
        );
      }
      if (explanation.length > this.constraints.maxExplanationChars) {
        violations.push(
          `Explanation has ${explanation.length} chars, maximum is ${this.constraints.maxExplanationChars}`,
        );
      }
    }

    // 3. Check for placeholder patterns
    for (const pattern of this.constraints.noPlaceholderPatterns) {
      const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
      const match = regex.exec(output);
      if (match) {
        violations.push(
          `Placeholder pattern detected: "${match[0]}" (matches /${pattern}/)`,
        );
      }
    }

    // 4. Additional placeholder detection (beyond the configured patterns)
    const additionalPatterns: Array<{ pattern: RegExp; name: string }> = [
      { pattern: /\/\/\s*TODO/i, name: 'TODO comment' },
      { pattern: /\/\/\s*FIXME/i, name: 'FIXME comment' },
      { pattern: /\/\*\s*\.\.\.\s*\*\//, name: 'ellipsis comment /* ... */' },
      { pattern: /rest is similar/i, name: '"rest is similar" truncation' },
      { pattern: /more of the same/i, name: '"more of the same" truncation' },
      { pattern: /and so on/i, name: '"and so on" truncation' },
      { pattern: /\.\.\.\.\./, name: '5+ consecutive dots (truncation marker)' },
    ];

    for (const { pattern, name } of additionalPatterns) {
      if (pattern.test(output)) {
        violations.push(`Placeholder detected: ${name}`);
      }
    }

    // 5. Check for incomplete blocks (unmatched braces)
    const openBraces = (output.match(/\{/g) ?? []).length;
    const closeBraces = (output.match(/\}/g) ?? []).length;
    if (Math.abs(openBraces - closeBraces) > 1) {
      violations.push(
        `Unmatched braces: ${openBraces} opening, ${closeBraces} closing — possible truncation`,
      );
    }

    return {
      passed: violations.length === 0,
      violations,
    };
  }
}
