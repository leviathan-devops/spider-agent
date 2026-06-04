/**
 * Spider v2.3 — Task Decomposition Enforcer
 *
 * Constraint 3: Decompose tasks into atomic steps with evidence requirements.
 * Each step must produce mechanical evidence before it is considered complete.
 */

import type { AtomicStep, EvidenceRequirement } from '../engines/types.js';

// ---------------------------------------------------------------------------
// Task decomposition
// ---------------------------------------------------------------------------

export class TaskDecompositionEnforcer {
  /**
   * Decompose a task description into atomic steps with evidence requirements.
   *
   * The decomposition follows the Spider autonomous loop:
   *   1. Init   → evidence: engine initialized
   *   2. Plan   → evidence: plan document
   *   3. Code   → evidence: file written, typecheck passes
   *   4. Test   → evidence: test results JSON
   *   5. Audit  → evidence: audit report
   *   6. Fix    → evidence: audit report with no CRITICAL findings
   */
  decompose(task: string): AtomicStep[] {
    const steps: AtomicStep[] = [];
    let stepNum = 0;

    // Step 1: Initialize
    steps.push({
      id: `step-${++stepNum}-init`,
      description: `Initialize environment and semantic engine for: ${task}`,
      evidenceRequired: [
        makeEvidenceRequirement('engine_initialized', ['engineReady']),
      ],
      evidenceProvided: [],
      completed: false,
    });

    // Step 2: Plan
    steps.push({
      id: `step-${++stepNum}-plan`,
      description: `Create implementation plan for: ${task}`,
      evidenceRequired: [
        makeEvidenceRequirement('file_snapshot', ['planFile']),
      ],
      evidenceProvided: [],
      completed: false,
    });

    // Step 3: Implement
    steps.push({
      id: `step-${++stepNum}-code`,
      description: `Implement: ${task}`,
      evidenceRequired: [
        makeEvidenceRequirement('typecheck_result', ['success']),
        makeEvidenceRequirement('file_snapshot', ['sourceFiles']),
      ],
      evidenceProvided: [],
      completed: false,
    });

    // Step 4: Test
    steps.push({
      id: `step-${++stepNum}-test`,
      description: `Run tests for: ${task}`,
      evidenceRequired: [
        makeEvidenceRequirement('test_result', ['ContainerTestResult.json']),
      ],
      evidenceProvided: [],
      completed: false,
    });

    // Step 5: Audit
    steps.push({
      id: `step-${++stepNum}-audit`,
      description: `Run semantic audit for: ${task}`,
      evidenceRequired: [
        makeEvidenceRequirement('linter_output', ['auditReport']),
      ],
      evidenceProvided: [],
      completed: false,
    });

    // Step 6: Fix (if needed)
    steps.push({
      id: `step-${++stepNum}-fix`,
      description: `Fix audit findings for: ${task}`,
      evidenceRequired: [
        makeEvidenceRequirement('linter_output', ['cleanAuditReport']),
      ],
      evidenceProvided: [],
      completed: false,
    });

    return steps;
  }

  /**
   * Check whether an atomic step has been completed.
   * A step is complete if all evidence requirements have been satisfied.
   */
  checkCompletion(step: AtomicStep): boolean {
    if (step.evidenceRequired.length === 0) {
      return step.completed;
    }

    // Every evidence requirement must have at least one piece of evidence provided
    return step.evidenceRequired.every((req) => {
      return step.evidenceProvided.some(
        (evidence) => validateEvidenceAgainstRequirement(evidence, req),
      );
    });
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEvidenceRequirement(
  type: string,
  requiredFields: string[],
): EvidenceRequirement {
  return {
    type: type as any,
    schema: {
      type: 'object',
      requiredFields,
    },
    validator: (evidence: unknown): boolean => {
      if (typeof evidence !== 'object' || evidence === null) return false;
      const record = evidence as Record<string, unknown>;
      return requiredFields.every((f) => f in record);
    },
  };
}

function validateEvidenceAgainstRequirement(
  evidence: unknown,
  requirement: EvidenceRequirement,
): boolean {
  try {
    return requirement.validator(evidence);
  } catch {
    return false;
  }
}
