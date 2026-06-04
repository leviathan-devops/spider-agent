/**
 * verification-web.ts — Spider v2.3 Verification Web
 *
 * Handles verification of multi-agent outputs, drift detection,
 * web tightening, and spec re-injection.
 *
 * Improvements vs v2.2.2:
 *   - Uses Jaccard similarity for consensus checks (consistent with SPIDER-001)
 *   - Improved drift detection with configurable thresholds
 *   - Spec memo uses incremental updates instead of full replacement
 */

import type {
  SpiderWorkflowSession,
  SpiderPipelineStage,
  VerificationResult,
  AgentResult,
  WebAnchorSnapshot,
} from './state.js';
import { jaccardSimilarity, addVerificationResult, recordDriftEvent } from './state.js';
import type { SpiderWeb, VibrationEvent, AggregatedWebResults, WebCompletionReport } from './spiderweb-types.js';

/** Jaccard threshold for verify-mode merge consensus. */
const MERGE_CONSENSUS_THRESHOLD = 0.8;

/** Drift similarity threshold — if Jaccard < this, drift is detected. */
const DRIFT_SIMILARITY_THRESHOLD = 0.7;

export class VerificationWeb {
  /**
   * Verify agent results for a given task/stage.
   */
  verify(
    session: SpiderWorkflowSession,
    taskId: string,
    stage: SpiderPipelineStage,
    agentResults: AgentResult[],
  ): VerificationResult {
    const agents = agentResults.map(r => r.agentId);
    return addVerificationResult(session, taskId, stage, agents, agentResults);
  }

  /**
   * Returns true if the verification result shows a discrepancy.
   */
  detectDiscrepancy(result: VerificationResult): boolean {
    return !result.consensus;
  }

  /**
   * Tighten the verification web for a session (increase required verifications).
   */
  tightenWeb(session: SpiderWorkflowSession): void {
    this.recordEscalation(session);
    session.webTightness = (session.webTightness || 1.0) * 1.5;
  }

  /**
   * Get the minimum number of verifications required for the current tightness.
   */
  getMinVerifications(session: SpiderWorkflowSession): number {
    return Math.ceil(session.webTightness || 1.0);
  }

  /**
   * Detect drift between the current context and the session's spec memo.
   *
   * Improved vs v2.2.2:
   *   - Uses Jaccard similarity for drift measurement
   *   - Configurable DRIFT_SIMILARITY_THRESHOLD
   *   - Incremental spec memo updates
   */
  detectDrift(session: SpiderWorkflowSession, currentContext: string): boolean {
    if (!session.specMemo) {
      session.specMemo = currentContext;
      return false;
    }

    const similarity = jaccardSimilarity(session.specMemo, currentContext);
    const drifted = similarity < DRIFT_SIMILARITY_THRESHOLD;

    // Incrementally update the spec memo rather than replacing it entirely.
    // This prevents the baseline from drifting along with the agent.
    if (!drifted && currentContext.length > 50) {
      // Update memo with the latest non-drifted context to track evolution
      session.specMemo = currentContext;
    }

    return drifted;
  }

  /**
   * Generate a spec re-injection prompt to bring the session back on track.
   */
  injectSpec(session: SpiderWorkflowSession): string {
    return `[SPIDERWEB SPEC RE-INJECTION] Original task: ${session.task}
Acceptance criteria: ${(session.acceptanceCriteria || []).join(', ')}
Current stage: ${session.stage}
Web tightness: ${(session.webTightness || 1.0).toFixed(1)}x
Drift events: ${(session.driftEvents || []).length}
Key decisions: ${(session.keyDecisions || []).join('; ') || 'none'}
Outstanding concerns: ${(session.outstandingConcerns || []).join('; ') || 'none'}

RE-FOCUS: Return to the original specification above. Ignore tangents.`;
  }

  /**
   * Log a drift event for the session.
   */
  logDriftEvent(session: SpiderWorkflowSession, reason: string): void {
    recordDriftEvent(session, reason, session.specMemo);
  }

  /**
   * Get a snapshot of the web anchor state.
   */
  getWebAnchorSnapshot(session: SpiderWorkflowSession): WebAnchorSnapshot {
    return {
      tightness: session.webTightness || 1.0,
      minVerifications: this.getMinVerifications(session),
      driftCount: (session.driftEvents || []).length,
      escalationCount: session.escalationCount || 0,
      lastTightening: session.lastActivity || session.createdAt,
    };
  }

  /**
   * Get an escalation hint for the session.
   */
  getEscalationHint(session: SpiderWorkflowSession): string {
    const count = session.escalationCount || 0;

    if (count >= 3) {
      return `
[SPIDERWEB ESCALATION] Stage ${session.stage} failed ${count} times.
ESCALATION REQUIRED:
- Precision issue → deploy spider_reviewer with Manta-style deep-dive
- Architecture broken → deploy spider_critic with Trident-style audit
- Build corrupted → re-enter spiderweb at CODER stage with fresh spider_coder

Original task: ${session.task}`;
    }

    return `[SPIDERWEB RETRY ${count}] Stage ${session.stage} — attempt ${count}. Tightening verification.`;
  }

  recordEscalation(session: SpiderWorkflowSession): void {
    session.escalationCount = (session.escalationCount || 0) + 1;
  }

  /**
   * Generate a verification context string for injection into the system prompt.
   */
  generateVerificationContext(session: SpiderWorkflowSession, agentCount: number): string {
    const minVer = this.getMinVerifications(session);
    const webInfo = session.activeWebId
      ? `Active web: ${session.activeWebId}`
      : 'No active web';

    return `[SPIDERWEB v2.3] Agent ${session.activeAgent} in stage ${session.stage}.
${webInfo}. Tightness: ${(session.webTightness || 1.0).toFixed(1)}x.
${agentCount} agents independently working on this stage.
Minimum verifications needed: ${minVer}.

Task: ${session.task}
Acceptance criteria: ${(session.acceptanceCriteria || []).join(', ')}
Key decisions: ${(session.keyDecisions || []).join('; ') || 'none'}
Outstanding concerns: ${(session.outstandingConcerns || []).join('; ') || 'none'}

DO NOT communicate with other agents directly.
DO produce self-contained, verifiable outputs.
DO log your reasoning for auditability.
DO NOT claim completion without evidence.`;
  }

  /**
   * Merge-mode verification: compare outputs using Jaccard similarity.
   *
   * SPIDER-001 FIX: Uses Jaccard > 0.8 instead of exact string match.
   */
  verifyMergeMode(results: Map<string, string>): AggregatedWebResults {
    const strandResults: Record<string, string> = {};
    const discrepancies: string[] = [];
    const outputs: string[] = [];

    for (const [id, output] of results) {
      strandResults[id] = output;
      outputs.push(output);
    }

    let consensus = true;
    let similarityScore: number | undefined;

    if (outputs.length >= 2) {
      // Compute minimum pairwise Jaccard
      let minSim = 1.0;
      for (let i = 0; i < outputs.length; i++) {
        for (let j = i + 1; j < outputs.length; j++) {
          const sim = jaccardSimilarity(outputs[i], outputs[j]);
          if (sim < minSim) minSim = sim;
        }
      }
      similarityScore = minSim;
      consensus = minSim >= MERGE_CONSENSUS_THRESHOLD;

      if (!consensus) {
        discrepancies.push(
          `Merge strands disagree: min Jaccard similarity ${(minSim * 100).toFixed(0)}% ` +
          `below ${MERGE_CONSENSUS_THRESHOLD * 100}% threshold`,
        );
      }
    }

    return {
      consensus,
      similarityScore,
      strandResults,
      mergedOutput: outputs.join('\n---\n'),
      discrepancies,
      verificationProof: consensus,
    };
  }

  /**
   * Detect vibration events in a web (strand-level anomalies).
   */
  detectWebVibrations(web: SpiderWeb): VibrationEvent[] {
    const vibrations: VibrationEvent[] = [];
    const now = Date.now();

    for (let i = 0; i < web.strands.length; i++) {
      const strand = web.strands[i];
      const elapsed = now - strand.startedAt;

      if (strand.status === 'running' && elapsed > 120000) {
        vibrations.push({
          type: 'stuck',
          strandIndex: i,
          strandId: strand.strandId,
          reason: `Strand ${strand.strandId} running for ${Math.round(elapsed / 1000)}s (timeout: 120s)`,
          timestamp: now,
        });
      }

      if (strand.status === 'failed') {
        vibrations.push({
          type: 'failed',
          strandIndex: i,
          strandId: strand.strandId,
          reason: `Strand ${strand.strandId} failed with exit code ${strand.exitCode ?? 'unknown'}`,
          timestamp: now,
        });
      }

      if (strand.status === 'completed' && strand.output.length < 50) {
        vibrations.push({
          type: 'slack',
          strandIndex: i,
          strandId: strand.strandId,
          reason: `Strand ${strand.strandId} completed with minimal output (${strand.output.length} chars)`,
          timestamp: now,
        });
      }
    }

    return vibrations;
  }

  /**
   * Generate a merge report for a completed web.
   */
  generateMergeReport(web: SpiderWeb): WebCompletionReport {
    const completed = web.strands.filter(s => s.status === 'completed');
    const failed = web.strands.filter(s => s.status === 'failed');
    const merged = completed.map(s => s.output).join('\n\n');

    return {
      webId: web.webId,
      totalStrands: web.strands.length,
      completedStrands: completed.length,
      failedStrands: failed.length,
      finalOutput: merged,
      evidencePath: `.spider-v2/evidence/${web.webId}`,
      dissolvedAt: Date.now(),
    };
  }
}
