/**
 * Spider v2.3 — Evidence Validator
 *
 * Validates evidence files produced during the Spider autonomous loop.
 * Ensures that claimed results are backed by mechanical evidence:
 *   1. Evidence files exist and conform to their expected schema
 *   2. Timestamps are recent (not stale or fabricated)
 *   3. Claimed results cross-reference with the evidence content
 */

import * as fs from 'fs';
import * as path from 'path';

export class EvidenceValidator {
  /**
   * Validate that an evidence file exists and conforms to the expected schema.
   *
   * @param evidencePath - Absolute path to the evidence file (JSON).
   * @param expectedSchema - An object whose keys must be present in the
   *   evidence file.  Values are treated as type hints (strings matching
   *   'string', 'number', 'boolean', 'object', 'array' trigger type checks;
   *   any other value is accepted as-is).
   */
  validateEvidence(evidencePath: string, expectedSchema: object): boolean {
    // 1. File must exist
    if (!fs.existsSync(evidencePath)) {
      return false;
    }

    // 2. File must be valid JSON
    let content: unknown;
    try {
      const raw = fs.readFileSync(evidencePath, 'utf-8');
      content = JSON.parse(raw);
    } catch {
      return false;
    }

    // 3. Content must be an object
    if (typeof content !== 'object' || content === null || Array.isArray(content)) {
      return false;
    }

    // 4. All expected schema keys must be present and match type hints
    const record = content as Record<string, unknown>;
    for (const [key, typeHint] of Object.entries(expectedSchema)) {
      if (!(key in record)) {
        return false;
      }

      // Type checking
      if (typeof typeHint === 'string') {
        const actual = record[key];
        switch (typeHint) {
          case 'string':
            if (typeof actual !== 'string') return false;
            break;
          case 'number':
            if (typeof actual !== 'number') return false;
            break;
          case 'boolean':
            if (typeof actual !== 'boolean') return false;
            break;
          case 'object':
            if (typeof actual !== 'object' || actual === null) return false;
            break;
          case 'array':
            if (!Array.isArray(actual)) return false;
            break;
        }
      }
    }

    return true;
  }

  /**
   * Verify that an evidence file's timestamp is within the allowed age.
   *
   * @param evidencePath - Path to the evidence file.
   * @param maxAgeMs - Maximum age in milliseconds.  Evidence older than
   *   this is considered stale and verification fails.
   */
  verifyTimestamp(evidencePath: string, maxAgeMs: number): boolean {
    if (!fs.existsSync(evidencePath)) {
      return false;
    }

    try {
      const raw = fs.readFileSync(evidencePath, 'utf-8');
      const content = JSON.parse(raw) as Record<string, unknown>;

      // Check for a 'timestamp' or 'generatedAt' field
      const ts =
        content.timestamp ?? content.generatedAt ?? content.createdAt;

      if (typeof ts !== 'string') {
        return false;
      }

      const evidenceTime = new Date(ts).getTime();
      if (Number.isNaN(evidenceTime)) {
        return false;
      }

      const now = Date.now();
      return now - evidenceTime <= maxAgeMs;
    } catch {
      return false;
    }
  }

  /**
   * Cross-reference a claimed result string with the evidence file content.
   *
   * This checks that the claimed result is consistent with what the
   * evidence file actually contains.  For example, if the claim is
   * "all tests pass", the evidence file must contain results showing
   * no failures.
   *
   * @param claimedResult - The result string being claimed (e.g. "all tests pass").
   * @param evidencePath - Path to the evidence JSON file.
   */
  crossReference(claimedResult: string, evidencePath: string): boolean {
    if (!fs.existsSync(evidencePath)) {
      return false;
    }

    try {
      const raw = fs.readFileSync(evidencePath, 'utf-8');
      const content = JSON.parse(raw) as Record<string, unknown>;

      // Claim: "all tests pass" / "passed"
      if (/all tests pass|passed/i.test(claimedResult)) {
        // Evidence must have a 'passed' or 'success' field that is true
        const passed = content.passed ?? content.success ?? content.allPassed;
        if (passed !== true) {
          return false;
        }

        // If there's a 'failures' array, it must be empty
        const failures = content.failures ?? content.errors;
        if (Array.isArray(failures) && failures.length > 0) {
          return false;
        }

        return true;
      }

      // Claim: "no errors" / "clean"
      if (/no errors|clean|error-free/i.test(claimedResult)) {
        const errors = content.errors ?? content.failures ?? content.diagnostics;
        if (Array.isArray(errors) && errors.length > 0) {
          return false;
        }
        return true;
      }

      // Claim: "coverage" / "X% coverage"
      const coverageMatch = claimedResult.match(/(\d+)(?:\.\d+)?%\s*coverage/i);
      if (coverageMatch) {
        const claimedPct = parseFloat(coverageMatch[1]);
        const actual = content.coverage ?? content.coveragePercentage ?? content.lineCoverage;
        if (typeof actual === 'number' && actual < claimedPct) {
          return false;
        }
        return true;
      }

      // Default: if we can't cross-reference, the claim is unverifiable
      // and we return false (conservative approach)
      return false;
    } catch {
      return false;
    }
  }
}
