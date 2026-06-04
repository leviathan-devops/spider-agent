/**
 * Spider v2.3 — Untheatrical Adapter
 *
 * Constraint 6: Inject anti-theatrical constraints on every system prompt.
 *
 * This adapter transforms the system prompt by prepending a set of
 * hard rules that prevent the model from engaging in theatrical behavior:
 * claiming success without evidence, using type escapes, leaving
 * incomplete code, etc.
 */

export class UntheatricalAdapter {
  /** The anti-theatrical constraint block that is prepended to every system prompt. */
  private static readonly ANTI_THEATRICAL_BLOCK = `
╔══════════════════════════════════════════════════════════════════╗
║               SPIDER v2.3 — ANTI-THEATRICAL RULES               ║
║          These rules are MANDATORY and NON-NEGOTIABLE.          ║
╚══════════════════════════════════════════════════════════════════╝

1. NEVER return { success: true } or { passed: true } without
   performing I/O FIRST. The return value MUST be derived from
   actual I/O results, not merely precede them.

2. NEVER claim "all tests pass" without ContainerTestResult.json
   or equivalent mechanical evidence. Assertions without evidence
   are THEATRICAL and will be quarantined.

3. NEVER use "as any" — use proper type narrowing:
   - instanceof checks
   - "in" operator for property testing
   - Discriminated union type guards
   - Custom type predicate functions

4. NEVER leave empty catch blocks. Every catch must:
   - Log the error, OR
   - Rethrow the error, OR
   - Handle the error with specific recovery logic

5. NEVER truncate code output. Every function, class, and module
   must be fully implemented — no "rest is similar", no "...",
   no "additional code follows the same pattern".

6. NEVER use TODO or FIXME — implement NOW. If you cannot
   implement a feature, escalate rather than leaving a placeholder.

7. NEVER claim verification without mechanical evidence. Every
   verification step must produce an artifact (file, test result,
   typecheck output) that can be independently checked.

VIOLATIONS OF THESE RULES WILL BE:
  - Detected by the 6-layer Semantic Engine
  - Quarantined by the Output Interceptor
  - Blocked by the Write-Time Gate
  - Escalated by the Cumulative Failure Escalator

`;

  /**
   * Transform the system prompt by prepending the anti-theatrical block.
   *
   * @param systemPrompt - The original system prompt.
   * @returns The transformed system prompt with anti-theatrical rules.
   */
  transform(systemPrompt: string): string {
    // Don't double-inject if the block is already present
    if (systemPrompt.includes('ANTI-THEATRICAL RULES')) {
      return systemPrompt;
    }

    return UntheatricalAdapter.ANTI_THEATRICAL_BLOCK + systemPrompt;
  }
}
