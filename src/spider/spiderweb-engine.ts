/**
 * spiderweb-engine.ts — Spider v2.3 SpiderWeb Engine
 *
 * Core execution engine for the tri-modal SpiderWeb architecture:
 *   VERIFY  (2-4 strands): same task, different approaches → compare → consensus
 *   DIVIDE  (2-8 strands): task decomposed → parallel build → merge
 *   PRESSURE (2-4 strands): container adversarial testing, 5-phase protocol
 *
 * BUG FIX vs v2.2.2:
 *   SPIDER-001: Verify-mode consensus now uses Jaccard similarity > 0.8
 *               instead of exact string match (Set comparison of trimmed
 *               outputs).  The Jaccard threshold allows minor wording
 *               differences while still catching substantive disagreement.
 */

import * as crypto from 'node:crypto';
import type { SpiderWorkflowState, SpiderWorkflowSession, SpiderPipelineStage, AgentResult } from './state.js';
import { jaccardSimilarity } from './state.js';
import type {
  SpiderWeb,
  SpiderStrand,
  WebExecutionMode,
  WebStatus,
  VibrationEvent,
  AggregatedWebResults,
  WebCompletionReport,
  WebAnchorState,
} from './spiderweb-types.js';

/** Minimum Jaccard similarity for verify-mode consensus (SPIDER-001). */
const CONSENSUS_JACCARD_THRESHOLD = 0.8;

/** Pressure-mode pass rate threshold. */
const PRESSURE_PASS_RATE_THRESHOLD = 0.90;

const STRAND_CAPS: Record<string, { min: number; max: number }> = {
  verify:   { min: 2, max: 4 },
  divide:   { min: 2, max: 8 },
  pressure: { min: 2, max: 4 },
};

/**
 * MANDATORY PIPELINE STAGES — every web MUST use proper agent types.
 * Each mode enforces a specific set of stages that must be completed
 * before the web can be dissolved.
 *
 * VERIFY  mode: explore → architect → coder → reviewer → critic
 * DIVIDE  mode: explore → architect → coder × N → reviewer → critic
 * PRESSURE mode: explore → coder → test_engineer
 */
const SUBAGENT_MAP: Record<string, string[]> = {
  explore:       ['spider_explorer', 'spider_explorer'],
  architect:     ['spider_architect', 'spider_architect'],
  coder:         ['spider_coder', 'spider_coder', 'spider_coder'],
  reviewer:      ['spider_reviewer', 'spider_reviewer'],
  test_engineer: ['spider_test_engineer'],
  critic:        ['spider_critic'],
};

/** Mode-to-pipeline-stage mapping — defines MANDATORY stages per mode. */
const MODE_PIPELINE_STAGES: Record<string, string[]> = {
  verify:   ['explore', 'architect', 'coder', 'reviewer', 'critic'],
  divide:   ['explore', 'architect', 'coder', 'reviewer', 'critic'],
  pressure: ['explore', 'coder', 'test_engineer', 'critic'],
};

export class SpiderWebEngine {
  private state: SpiderWorkflowState;

  constructor(state: SpiderWorkflowState) {
    this.state = state;
  }

  // -----------------------------------------------------------------------
  // Web construction
  // -----------------------------------------------------------------------

  constructWeb(
    task: string,
    acceptanceCriteria: string[],
    stage: SpiderPipelineStage,
    mode: WebExecutionMode,
    strandCount?: number,
    target?: string,
  ): SpiderWeb {
    const cap = STRAND_CAPS[mode] || STRAND_CAPS.verify;
    const count = strandCount
      ? Math.max(cap.min, Math.min(cap.max, strandCount))
      : this.calculateStrandCount(task, mode);

    const webId = `web_${crypto.randomUUID().slice(0, 8)}_${Date.now()}`;
    const strands = this.generateStrands(webId, task, stage, mode, count);

    // Enforce mandatory pipeline stages: mark which stages this web must complete
    const requiredStages = MODE_PIPELINE_STAGES[mode] || ['explore', 'architect', 'coder', 'critic'];

    const web: SpiderWeb = {
      webId,
      task,
      acceptanceCriteria,
      executionMode: mode,
      stage,
      strands,
      anchorState: this.createAnchorState(count),
      escalationCount: 0,
      createdAt: Date.now(),
      status: 'constructing',
      target: target || undefined,
      containerImage: mode === 'pressure' ? 'opencode-test:1.14.34' : undefined,
      // NEW: Track completed pipeline stages — web cannot dissolve without ALL stages
      completedStages: [],
      requiredStages: requiredStages,
      // NEW: Evidence tracking — evidence must be collected before dissolution
      evidenceCollected: false,
    };

    this.state.webs.set(webId, web);
    return web;
  }

  calculateStrandCount(task: string, mode: WebExecutionMode): number {
    const cap = STRAND_CAPS[mode] || STRAND_CAPS.verify;
    const taskLen = task.length;

    if (mode === 'verify') {
      return taskLen > 500 ? 4 : 2;
    }
    if (mode === 'pressure') {
      return 4;
    }
    // divide mode
    if (taskLen > 1000) return Math.min(cap.max, 6);
    if (taskLen > 500) return 4;
    return cap.min;
  }

  generateStrands(
    webId: string,
    task: string,
    stage: SpiderPipelineStage,
    mode: WebExecutionMode,
    count: number,
  ): SpiderStrand[] {
    const strands: SpiderStrand[] = [];
    const agents = SUBAGENT_MAP[stage] || ['spider_coder'];

    for (let i = 0; i < count; i++) {
      const agentType = agents[i % agents.length];
      const strandId = `${webId}_strand_${i + 1}`;

      let taskDesc = task;
      if (mode === 'divide') {
        taskDesc = `[STRAND ${i + 1}/${count}] Component ${i + 1} of ${count}: ${task}`;
      } else if (mode === 'verify') {
        const approaches = ['standard', 'alternative', 'minimal', 'comprehensive'];
        taskDesc = `[VERIFY STRAND ${i + 1}/${count}] Approach: ${approaches[i] || 'standard'}. Task: ${task}`;
      } else if (mode === 'pressure') {
        taskDesc = `[PRESSURE STRAND ${i + 1}/${count}] Phase ${i + 1} container test: ${task}`;
      }

      strands.push({
        strandId,
        subagentType: agentType,
        taskDescription: taskDesc,
        assignedFiles: [],
        subagentSessionId: '',
        status: 'pending',
        output: '',
        startedAt: 0,
        pressurePhase: mode === 'pressure' ? i + 1 : undefined,
      });
    }

    return strands;
  }

  // -----------------------------------------------------------------------
  // Web lifecycle
  // -----------------------------------------------------------------------

  getWeb(webId: string): SpiderWeb | undefined {
    return this.state.webs.get(webId);
  }

  getActiveWeb(session: SpiderWorkflowSession): SpiderWeb | undefined {
    if (!session.activeWebId) return undefined;
    return this.state.webs.get(session.activeWebId);
  }

  activateWeb(webId: string): void {
    const web = this.state.webs.get(webId);
    if (web) {
      web.status = 'active';
      const now = Date.now();
      for (const strand of web.strands) {
        strand.status = 'spawning';
        strand.startedAt = now;
      }
    }
  }

  markStrandsRunning(webId: string): boolean {
    const web = this.state.webs.get(webId);
    if (!web) return false;
    let anyChanged = false;
    for (const strand of web.strands) {
      if (strand.status === 'spawning') {
        strand.status = 'running';
        anyChanged = true;
      }
    }
    if (anyChanged) {
      web.status = 'active';
      this.updateAnchorState(web);
    }
    return anyChanged;
  }

  updateStrandStatus(
    webId: string,
    strandIndex: number,
    status: SpiderStrand['status'],
    output?: string,
    exitCode?: number,
  ): void {
    const web = this.state.webs.get(webId);
    if (!web || strandIndex >= web.strands.length) return;

    const strand = web.strands[strandIndex];
    strand.status = status;
    if (output !== undefined) strand.output = output;
    if (exitCode !== undefined) strand.exitCode = exitCode;
    if (status === 'completed' || status === 'failed') {
      strand.completedAt = Date.now();
    }

    this.updateWebStatus(web);
    this.updateAnchorState(web);
  }

  // -----------------------------------------------------------------------
  // Status updates
  // -----------------------------------------------------------------------

  private updateWebStatus(web: SpiderWeb): void {
    const allCompleted = web.strands.every(s => s.status === 'completed');
    const anyFailed = web.strands.some(s => s.status === 'failed');
    const anyRunning = web.strands.some(s => s.status === 'running' || s.status === 'spawning');

    if (allCompleted) {
      web.status = 'completed';
    } else if (anyFailed && !anyRunning) {
      web.status = 'tightening';
    }
  }

  private updateAnchorState(web: SpiderWeb): void {
    web.anchorState = {
      tightness: web.anchorState.tightness,
      minVerifications: web.anchorState.minVerifications,
      strandCount: web.strands.length,
      activeStrands: web.strands.filter(s => s.status === 'running').length,
      completedStrands: web.strands.filter(s => s.status === 'completed').length,
      escalationCount: web.escalationCount,
      lastTightening: web.anchorState.lastTightening,
    };
  }

  // -----------------------------------------------------------------------
  // Vibration detection
  // -----------------------------------------------------------------------

  detectVibrations(web: SpiderWeb): VibrationEvent[] {
    const vibrations: VibrationEvent[] = [];
    const now = Date.now();

    for (let i = 0; i < web.strands.length; i++) {
      const strand = web.strands[i];
      const elapsed = now - strand.startedAt;

      if (strand.status === 'running' && elapsed > 180000) {
        vibrations.push({
          type: 'stuck',
          strandIndex: i,
          strandId: strand.strandId,
          reason: `Strand ${strand.strandId} running for ${Math.round(elapsed / 1000)}s`,
          timestamp: now,
        });
      }

      if (strand.status === 'failed') {
        vibrations.push({
          type: 'failed',
          strandIndex: i,
          strandId: strand.strandId,
          reason: `Strand ${strand.strandId} failed`,
          timestamp: now,
        });
      }

      if (strand.status === 'completed' && strand.output.length < 50) {
        vibrations.push({
          type: 'slack',
          strandIndex: i,
          strandId: strand.strandId,
          reason: `Strand ${strand.strandId} minimal output (${strand.output.length} chars)`,
          timestamp: now,
        });
      }

      if (strand.status === 'running' && elapsed > 60000 && strand.output.length > 0) {
        const divergence = this.detectDivergence(web, i);
        if (divergence) {
          vibrations.push({
            type: 'divergent',
            strandIndex: i,
            strandId: strand.strandId,
            reason: divergence,
            timestamp: now,
          });
        }
      }
    }

    return vibrations;
  }

  private detectDivergence(web: SpiderWeb, strandIndex: number): string | null {
    if (web.executionMode !== 'verify') return null;
    const current = web.strands[strandIndex];
    if (!current.output) return null;

    for (let i = 0; i < web.strands.length; i++) {
      if (i === strandIndex) continue;
      const other = web.strands[i];
      if (other.status !== 'completed' || !other.output) continue;

      const similarity = jaccardSimilarity(current.output, other.output);
      if (similarity < 0.3) {
        return `Strand ${current.strandId} diverges significantly from ${other.strandId} (Jaccard similarity: ${(similarity * 100).toFixed(0)}%)`;
      }
    }
    return null;
  }

  // -----------------------------------------------------------------------
  // Web tightening & re-anchoring
  // -----------------------------------------------------------------------

  tightenWeb(webId: string, reason: string): void {
    const web = this.state.webs.get(webId);
    if (!web) return;

    web.status = 'tightening';
    web.escalationCount++;
    web.anchorState.tightness = Math.min(3.0, web.anchorState.tightness * 1.5);
    web.anchorState.lastTightening = Date.now();

    for (const strand of web.strands) {
      if (strand.status === 'failed' || strand.status === 'stuck') {
        strand.status = 'pending';
        strand.output = '';
        strand.exitCode = undefined;
        strand.startedAt = 0;
        strand.completedAt = undefined;
      }
    }

    web.status = 'active';
  }

  reAnchorStrand(webId: string, strandIndex: number, reason: string): void {
    const web = this.state.webs.get(webId);
    if (!web || strandIndex >= web.strands.length) return;

    const strand = web.strands[strandIndex];
    strand.status = 'pending';
    strand.output = '';
    strand.exitCode = undefined;
    strand.startedAt = 0;
    strand.completedAt = undefined;
  }

  // -----------------------------------------------------------------------
  // Result aggregation (SPIDER-001: Jaccard-based consensus for verify)
  // -----------------------------------------------------------------------

  aggregateResults(web: SpiderWeb): AggregatedWebResults {
    const completed = web.strands.filter(s => s.status === 'completed');
    const strandResults: Record<string, string> = {};
    const discrepancies: string[] = [];

    for (const strand of completed) {
      strandResults[strand.strandId] = strand.output;
    }

    let consensus = false;
    let similarityScore: number | undefined;
    let mergedOutput = '';

    if (web.executionMode === 'verify') {
      // ── VERIFY: Jaccard similarity > 0.8 for consensus ───────────
      if (completed.length === 0) {
        consensus = false;
        discrepancies.push('No strands completed. Cannot verify with 0 results.');
      } else if (completed.length === 1) {
        consensus = true;
        similarityScore = 1.0;
        mergedOutput = completed[0].output;
      } else {
        // Compute minimum pairwise Jaccard similarity
        let minSim = 1.0;
        for (let i = 0; i < completed.length; i++) {
          for (let j = i + 1; j < completed.length; j++) {
            const sim = jaccardSimilarity(completed[i].output, completed[j].output);
            if (sim < minSim) minSim = sim;
          }
        }
        similarityScore = minSim;
        consensus = minSim >= CONSENSUS_JACCARD_THRESHOLD;

        if (!consensus) {
          discrepancies.push(
            `Verify strands disagree: min Jaccard similarity ${(minSim * 100).toFixed(0)}% ` +
            `below ${CONSENSUS_JACCARD_THRESHOLD * 100}% threshold`,
          );
        }
        mergedOutput = completed[0].output;
      }
    } else if (web.executionMode === 'divide') {
      // ── DIVIDE: all strands must complete ──────────────────────────
      consensus = completed.length === web.strands.length;
      mergedOutput = completed.map(s => `=== ${s.strandId} ===\n${s.output}`).join('\n\n');
      if (!consensus) {
        const pending = web.strands.filter(s => s.status !== 'completed');
        discrepancies.push(`${pending.length} strands not completed: ${pending.map(s => s.strandId).join(', ')}`);
      }
    } else if (web.executionMode === 'pressure') {
      // ── PRESSURE: pass rate >= 90% ─────────────────────────────────
      const passed = completed.filter(
        s => s.output.includes('"overallPassed": true') || s.output.includes('"passed": true'),
      );
      const passRate = completed.length > 0 ? passed.length / completed.length : 0;
      consensus = passRate >= PRESSURE_PASS_RATE_THRESHOLD;
      similarityScore = passRate;
      mergedOutput = JSON.stringify({
        totalStrands: web.strands.length,
        completedStrands: completed.length,
        passedStrands: passed.length,
        passRate: Math.round(passRate * 100) / 100,
        meetsThreshold: consensus,
      }, null, 2);
      if (!consensus) {
        discrepancies.push(`Pass rate ${(passRate * 100).toFixed(0)}% below ${PRESSURE_PASS_RATE_THRESHOLD * 100}% threshold`);
      }
    }

    return {
      consensus,
      similarityScore,
      strandResults,
      mergedOutput,
      discrepancies,
      verificationProof: consensus,
    };
  }

  // -----------------------------------------------------------------------
  // Web dissolution
  // -----------------------------------------------------------------------

  dissolveWeb(webId: string): WebCompletionReport {
    const web = this.state.webs.get(webId);
    if (!web) {
      return {
        webId,
        totalStrands: 0,
        completedStrands: 0,
        failedStrands: 0,
        finalOutput: 'Web not found',
        evidencePath: '',
        dissolvedAt: Date.now(),
      };
    }

    // NEW: Enforce mandatory pipeline stages
    const missingStages = (web.requiredStages || []).filter(s => !(web.completedStages || []).includes(s));
    if (missingStages.length > 0) {
      return {
        webId,
        totalStrands: web.strands.length,
        completedStrands: web.strands.filter(s => s.status === 'completed').length,
        failedStrands: web.strands.filter(s => s.status === 'failed').length,
        finalOutput: `Cannot dissolve: pipeline stages [${missingStages.join(', ')}] not yet completed. ` +
          `Required: [${(web.requiredStages || []).join(', ')}]. Completed: [${(web.completedStages || []).join(', ')}]. ` +
          `Advance through each stage using spider-gate action=advance.`,
        evidencePath: '',
        dissolvedAt: Date.now(),
      };
    }

    // NEW: Enforce evidence collection before dissolution
    if (!web.evidenceCollected) {
      return {
        webId,
        totalStrands: web.strands.length,
        completedStrands: web.strands.filter(s => s.status === 'completed').length,
        failedStrands: web.strands.filter(s => s.status === 'failed').length,
        finalOutput: 'Cannot dissolve: evidence not yet collected. ' +
          'Run spider-evidence action=web-anchor webId=' + webId + ' first, then set evidenceCollected=true via spider-gate.',
        evidencePath: '',
        dissolvedAt: Date.now(),
      };
    }

    web.status = 'completed';
    const aggregated = this.aggregateResults(web);
    const completed = web.strands.filter(s => s.status === 'completed');
    const failed = web.strands.filter(s => s.status === 'failed');

    // NEW: Include Jaccard similarity in completion report
    const similarityInfo = aggregated.similarityScore !== undefined
      ? ` | Similarity: ${(aggregated.similarityScore * 100).toFixed(0)}%`
      : '';
    const consensusInfo = aggregated.consensus ? ' | Consensus: CONFIRMED' : ' | Consensus: NOT CONFIRMED';

    const report: WebCompletionReport = {
      webId: web.webId,
      totalStrands: web.strands.length,
      completedStrands: completed.length,
      failedStrands: failed.length,
      finalOutput: aggregated.mergedOutput + similarityInfo + consensusInfo,
      evidencePath: `.spider-v2/evidence/${web.webId}`,
      dissolvedAt: Date.now(),
      passRate: web.executionMode === 'pressure'
        ? (completed.length > 0
          ? completed.filter(s => s.output.includes('"passed": true')).length / completed.length
          : 0)
        : undefined,
    };

    return report;
  }

  // -----------------------------------------------------------------------
  // Pipeline stage advancement
  // -----------------------------------------------------------------------

  /**
   * Advance the web to the next pipeline stage.
   * Returns a report indicating whether the stage was completed.
   */
  advancePipelineStage(webId: string, stage: string): { success: boolean; message: string } {
    const web = this.state.webs.get(webId);
    if (!web) return { success: false, message: `Web ${webId} not found` };

    const required = web.requiredStages || [];
    if (!required.includes(stage)) {
      return { success: false, message: `Stage "${stage}" is not in the required pipeline [${required.join(', ')}]` };
    }

    if (!web.completedStages) web.completedStages = [];
    if (web.completedStages.includes(stage)) {
      return { success: false, message: `Stage "${stage}" already completed` };
    }

    // Check that previous stages are completed (ordered pipeline)
    const stageIndex = required.indexOf(stage);
    if (stageIndex > 0) {
      const prevStage = required[stageIndex - 1];
      if (!web.completedStages.includes(prevStage)) {
        return {
          success: false,
          message: `Cannot advance to "${stage}": previous stage "${prevStage}" not yet completed. ` +
            `Complete "${prevStage}" first. Pipeline order: [${required.join(' → ')}]`,
        };
      }
    }

    web.completedStages.push(stage);
    web.stage = stage as SpiderPipelineStage;

    // Update web anchor state
    web.anchorState = {
      ...web.anchorState,
      tightness: Math.min(1, web.anchorState.tightness + 0.1),
    };

    return {
      success: true,
      message: `Advanced to stage "${stage}". Pipeline progress: ${web.completedStages.length}/${required.length} ` +
        `[${web.completedStages.join(' → ')}]`,
    };
  }

  /**
   * Mark evidence as collected for this web.
   */
  markEvidenceCollected(webId: string): { success: boolean; message: string } {
    const web = this.state.webs.get(webId);
    if (!web) return { success: false, message: `Web ${webId} not found` };
    web.evidenceCollected = true;
    return { success: true, message: `Evidence marked as collected for web ${webId}` };
  }

  // -----------------------------------------------------------------------
  // Status reporting
  // -----------------------------------------------------------------------

  getWebStatus(webId: string): Record<string, unknown> {
    const web = this.state.webs.get(webId);
    if (!web) return { error: 'Web not found', webId };

    return {
      webId: web.webId,
      mode: web.executionMode,
      stage: web.stage,
      status: web.status,
      task: web.task.substring(0, 200),
      strandCount: web.strands.length,
      strands: web.strands.map(s => ({
        id: s.strandId,
        status: s.status,
        agent: s.subagentType,
        outputLen: s.output.length,
        phase: s.pressurePhase,
        containerId: s.containerId,
      })),
      anchor: web.anchorState,
      escalationCount: web.escalationCount,
      target: web.target,
      containerImage: web.containerImage,
      createdAt: new Date(web.createdAt).toISOString(),
    };
  }

  // -----------------------------------------------------------------------
  // Internal helpers
  // -----------------------------------------------------------------------

  private createAnchorState(strandCount: number): WebAnchorState {
    return {
      tightness: 1.0,
      minVerifications: 1,
      strandCount,
      activeStrands: 0,
      completedStrands: 0,
      escalationCount: 0,
      lastTightening: Date.now(),
    };
  }
}
