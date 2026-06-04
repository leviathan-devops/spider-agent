/**
 * coordinator.ts — Spider v2.3 Stage Coordinator
 *
 * Manages the 6-stage pipeline progression, gate evaluation,
 * and stage advancement with mandatory gate enforcement.
 *
 * BUG FIX vs v2.2.2:
 *   SPIDER-002: advanceStage now BLOCKS if canProceed() returns false.
 *               In v2.2.2 (lines 39-42), the gate result was computed but
 *               ignored — the transition always proceeded.  Now the
 *               transition is refused when gate conditions are unmet.
 */

import type {
  SpiderWorkflowState,
  SpiderWorkflowSession,
  SpiderPipelineStage,
  GateCondition,
  StageContext,
  VerificationResult,
} from './state.js';
import { transitionStage, addStageBoundary } from './state.js';

const STAGE_ORDER: SpiderPipelineStage[] = [
  'idle', 'explore', 'architect', 'coder', 'reviewer', 'test_engineer', 'critic',
];

export class SpiderCoordinator {
  private state: SpiderWorkflowState;

  constructor(state: SpiderWorkflowState) {
    this.state = state;
  }

  /**
   * Advance the session to the next pipeline stage.
   *
   * SPIDER-002 FIX: This method now BLOCKS if canProceed() returns false.
   * Returns the new stage on success, or throws an Error describing
   * which gate conditions are unmet.
   */
  advanceStage(session: SpiderWorkflowSession, reason: string): SpiderPipelineStage {
    const currentIdx = STAGE_ORDER.indexOf(session.stage);
    const nextStage: SpiderPipelineStage = currentIdx < STAGE_ORDER.length - 1
      ? STAGE_ORDER[currentIdx + 1]
      : 'critic';

    // ── SPIDER-002 FIX: enforce gate BEFORE transitioning ─────────────
    const gateResult = this.canProceed(session, session.stage);
    if (!gateResult) {
      const conditions = this.checkGate(session, session.stage);
      const unmet = conditions.filter(c => !c.met).map(c => c.description);
      throw new Error(
        `Cannot advance from ${session.stage} to ${nextStage}: gate conditions not met. ` +
        `Unmet: ${unmet.join('; ')}`,
      );
    }
    // ──────────────────────────────────────────────────────────────────

    const inputCtx: StageContext = {
      task: session.task,
      acceptanceCriteria: session.acceptanceCriteria,
      keyDecisions: [],
      discrepanciesResolved: [],
      outstandingConcerns: [],
      nextStageInput: `Transition to ${nextStage}`,
      capturedAt: new Date().toISOString(),
    };

    const outputCtx: StageContext = {
      task: session.task,
      acceptanceCriteria: session.acceptanceCriteria,
      keyDecisions: [`Advanced to ${nextStage}: ${reason}`],
      discrepanciesResolved: [],
      outstandingConcerns: [],
      nextStageInput: '',
      capturedAt: new Date().toISOString(),
    };

    addStageBoundary(session, inputCtx, outputCtx, true);
    transitionStage(this.state, session, nextStage, reason);
    return nextStage;
  }

  /**
   * Attempt to advance, returning a result object instead of throwing.
   * Useful for tool handlers that need to report failure gracefully.
   */
  tryAdvanceStage(
    session: SpiderWorkflowSession,
    reason: string,
  ): { success: boolean; nextStage?: SpiderPipelineStage; error?: string; unmetConditions?: string[] } {
    try {
      const next = this.advanceStage(session, reason);
      return { success: true, nextStage: next };
    } catch (err) {
      const conditions = this.checkGate(session, session.stage);
      const unmet = conditions.filter(c => !c.met).map(c => c.description);
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        unmetConditions: unmet,
      };
    }
  }

  /**
   * Check gate conditions for a given stage.
   */
  checkGate(session: SpiderWorkflowSession, stage: SpiderPipelineStage): GateCondition[] {
    const conditions: GateCondition[] = [];
    const verifications = Array.from(session.verificationResults.values());

    switch (stage) {
      case 'explore':
        conditions.push({
          type: 'evidence',
          description: 'Terrain map verified by 2 explorers',
          met: this.hasStageVerification(verifications, 'explore'),
        });
        break;

      case 'architect':
        conditions.push({
          type: 'consensus',
          description: 'SPEC approved by 2 architects',
          met: this.hasStageVerification(verifications, 'architect'),
        });
        break;

      case 'coder':
        conditions.push({
          type: 'files_exist',
          description: 'Implementation files created',
          met: session.filesModified.length > 0,
        });
        conditions.push({
          type: 'consensus',
          description: 'Multiple coder outputs matched or resolved',
          met: this.hasStageVerification(verifications, 'coder'),
        });
        break;

      case 'reviewer':
        conditions.push({
          type: 'evidence',
          description: 'Review completed by 2 reviewers',
          met: this.hasStageVerification(verifications, 'reviewer'),
        });
        break;

      case 'test_engineer':
        conditions.push({
          type: 'all_pass',
          description: 'Tests generated and passing',
          met: this.hasStageVerification(verifications, 'test_engineer'),
        });
        break;

      case 'critic':
        conditions.push({
          type: 'consensus',
          description: 'Unanimous critic sign-off',
          met: this.hasStageVerification(verifications, 'critic'),
        });
        break;

      default:
        conditions.push({
          type: 'evidence',
          description: 'No gate check needed',
          met: true,
        });
    }

    return conditions;
  }

  /**
   * Returns true if ALL gate conditions for the given stage are met.
   */
  canProceed(session: SpiderWorkflowSession, stage: SpiderPipelineStage): boolean {
    return this.checkGate(session, stage).every(c => c.met);
  }

  getStageOrder(): SpiderPipelineStage[] {
    return STAGE_ORDER;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private hasStageVerification(verifications: VerificationResult[], stage: SpiderPipelineStage): boolean {
    return verifications.some(v => v.stage === stage && v.consensus);
  }
}
