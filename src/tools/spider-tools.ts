/**
 * spider-tools.ts — Spider v2.3 Tool Definitions (7 tools)
 *
 * Provides 7 tools for the spider agent:
 *   1. spider-status    — Show pipeline state
 *   2. spider-gate      — Evaluate/advance gates
 *   3. spider-evidence  — View evidence collection status
 *   4. spider-verify    — Submit verification results
 *   5. spider-checkpoint — Save pipeline state
 *   6. spiderweb        — Construct/manage execution webs
 *   7. (spider-vision   — defined in tools/spider-vision.ts)
 */

import { tool } from '@opencode-ai/plugin';
import { z } from 'zod';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { SpiderWorkflowState, SpiderWorkflowSession, SpiderPipelineStage, AgentResult } from '../spider/state.js';
import { SpiderCoordinator } from '../spider/coordinator.js';
import { VerificationWeb } from '../spider/verification-web.js';
import { SpiderWebEngine } from '../spider/spiderweb-engine.js';
import { getActiveSpiderSession, getSession, linkWebToSession } from '../spider/state.js';
import { createCompactionCheckpoint } from '../spider/compaction/compaction-survival.js';
import type { WebExecutionMode } from '../spider/spiderweb-types.js';

function getSession_(state: SpiderWorkflowState): SpiderWorkflowSession | undefined {
  return getActiveSpiderSession(state);
}

function requireSession(state: SpiderWorkflowState): SpiderWorkflowSession {
  const s = getSession_(state);
  if (!s) throw new Error('No active spider session');
  return s;
}

export function createSpiderTools(
  state: SpiderWorkflowState,
  coordinator: SpiderCoordinator,
  verificationWeb: VerificationWeb,
  webEngine: SpiderWebEngine,
) {
  return {
    // ── TOOL 1: spider-status ────────────────────────────────────────
    'spider-status': tool({
      description: 'Show current Spider v2.3 pipeline state: stage, gate status, verification results, web anchor snapshot, active spiderweb, and session info',
      args: {},
      execute: async () => {
        const session = getSession_(state);
        if (!session) {
          return JSON.stringify({
            status: 'idle',
            version: '2.3.0',
            message: 'No active spider sessions. Send a message to the spider agent to begin.',
          });
        }

        const gates = coordinator.checkGate(session, session.stage);
        const verifications = Array.from(session.verificationResults.values());
        const webSnapshot = verificationWeb.getWebAnchorSnapshot(session);
        const activeWeb = session.activeWebId ? webEngine.getWeb(session.activeWebId) : null;

        return JSON.stringify({
          version: '2.3.0',
          sessionId: session.sessionId,
          task: session.task,
          stage: session.stage,
          activeAgent: session.activeAgent,
          taskId: session.taskId,
          filesModified: session.filesModified,
          acceptanceCriteria: session.acceptanceCriteria,
          keyDecisions: session.keyDecisions || [],
          outstandingConcerns: session.outstandingConcerns || [],
          slopScore: session.slopScore || 0,
          webAnchor: {
            tightness: webSnapshot.tightness,
            minVerifications: webSnapshot.minVerifications,
            driftCount: webSnapshot.driftCount,
            escalationCount: webSnapshot.escalationCount,
          },
          activeWeb: activeWeb ? {
            webId: activeWeb.webId,
            mode: activeWeb.executionMode,
            status: activeWeb.status,
            strandCount: activeWeb.strands.length,
            completedStrands: activeWeb.strands.filter(s => s.status === 'completed').length,
          } : null,
          gates,
          verifications: verifications.map(v => ({
            stage: v.stage,
            agents: v.agents,
            consensus: v.consensus,
            similarityScore: v.similarityScore,
            resolution: v.resolution,
          })),
          stageHistory: state.stageHistory.filter(t => t.taskId === session.taskId),
          checkpointCount: session.checkpoints?.length || 0,
        }, null, 2);
      },
    }),

    // ── TOOL 2: spider-gate ──────────────────────────────────────────
    'spider-gate': tool({
      description: 'Evaluate a gate or get gate criteria for the current spiderweb stage. Gate enforcement is mandatory in v2.3 — canProceed() must return true to advance.',
      args: {
        action: z.enum(['evaluate', 'status', 'criteria', 'advance']),
        gate: z.enum(['explore', 'architect', 'coder', 'reviewer', 'test_engineer', 'critic', 'idle']),
        passed: z.boolean().optional(),
        notes: z.string().optional(),
      },
      execute: async (args) => {
        const session = requireSession(state);
        const stage = args.gate as SpiderPipelineStage;

        switch (args.action) {
          case 'criteria': {
            const conditions = coordinator.checkGate(session, stage);
            return JSON.stringify({ stage, conditions, canAdvance: conditions.every(c => c.met) }, null, 2);
          }
          case 'status': {
            const conditions = coordinator.checkGate(session, stage);
            return JSON.stringify({
              stage,
              passed: conditions.every(c => c.met),
              conditions,
              webTightness: session.webTightness,
              escalationCount: session.escalationCount,
            }, null, 2);
          }
          case 'evaluate': {
            if (args.passed === undefined) {
              return JSON.stringify({ error: 'passed field required for evaluate action' });
            }
            const conditions = coordinator.checkGate(session, stage);
            const allMet = conditions.every(c => c.met) && args.passed;
            return JSON.stringify({
              stage,
              passed: allMet,
              conditions,
              notes: args.notes,
            }, null, 2);
          }
          case 'advance': {
            // SPIDER-002 FIX: tryAdvanceStage now blocks if gates not met
            const result = coordinator.tryAdvanceStage(session, `Gate ${stage} passed`);
            if (result.success) {
              return JSON.stringify({
                advanced: true,
                from: stage,
                to: result.nextStage,
                message: `Advanced to ${result.nextStage} stage`,
                webTightness: session.webTightness,
              }, null, 2);
            }
            const hint = verificationWeb.getEscalationHint(session);
            return JSON.stringify({
              advanced: false,
              error: result.error,
              unmetConditions: result.unmetConditions,
              escalationHint: hint,
            }, null, 2);
          }
          default:
            return JSON.stringify({ error: 'Unknown action' });
        }
      },
    }),

    // ── TOOL 3: spider-evidence ──────────────────────────────────────
    'spider-evidence': tool({
      description: 'View evidence collection status and verification results',
      args: {
        action: z.enum(['status', 'stage-evidence', 'web-anchor', 'complete']),
        stage: z.string().optional(),
      },
      execute: async (args): Promise<string> => {
        const session = requireSession(state);

        if (args.action === 'status') {
          const evidenceDirResult = path.join(process.cwd(), session.evidenceDir);
          const evidenceFiles = fs.existsSync(evidenceDirResult)
            ? fs.readdirSync(evidenceDirResult)
            : [];

          return JSON.stringify({
            evidenceDir: session.evidenceDir,
            files: evidenceFiles,
            verificationCount: session.verificationResults.size,
            consensusCount: Array.from(session.verificationResults.values()).filter(v => v.consensus).length,
            webAnchor: verificationWeb.getWebAnchorSnapshot(session),
            stageBoundaries: (session.stageBoundaries || []).length,
            driftEvents: (session.driftEvents || []).length,
            keyDecisions: session.keyDecisions || [],
            outstandingConcerns: session.outstandingConcerns || [],
          }, null, 2);
        }

        if (args.action === 'stage-evidence' && args.stage) {
          const verifications = Array.from(session.verificationResults.values())
            .filter(v => v.stage === args.stage);

          return JSON.stringify({
            stage: args.stage,
            verifications: verifications.map(v => ({
              taskId: v.taskId,
              agents: v.agents,
              consensus: v.consensus,
              similarityScore: v.similarityScore,
              resolution: v.resolution,
              results: v.results.map(r => ({
                agent: r.agentId,
                confidence: r.confidence,
                files: r.files,
                outputPreview: r.output != null ? String(r.output).substring(0, 500) : '',
              })),
            })),
          }, null, 2);
        }

        if (args.action === 'web-anchor') {
          const data: any = verificationWeb.getWebAnchorSnapshot(session);
          data.stageBoundaries = (session.stageBoundaries || []).map(b => ({
            stageId: b.stageId,
            verificationProof: b.verificationProof,
            drifted: b.drifted,
          }));
          data.driftEvents = (session.driftEvents || []).map(e => ({
            stage: e.stage,
            reason: e.reason,
            timestamp: new Date(e.timestamp).toISOString(),
          }));
          return JSON.stringify(data, null, 2);
        }

        if (args.action === 'complete') {
          const summary = {
            sessionId: session.sessionId,
            task: session.task,
            finalStage: session.stage,
            totalVerifications: session.verificationResults.size,
            consensusCount: Array.from(session.verificationResults.values()).filter(v => v.consensus).length,
            filesModified: session.filesModified,
            stageHistory: state.stageHistory.filter(t => t.taskId === session.taskId).length,
            webAnchor: verificationWeb.getWebAnchorSnapshot(session),
            evidenceDir: path.join(process.cwd(), session.evidenceDir),
            keyDecisions: session.keyDecisions || [],
            outstandingConcerns: session.outstandingConcerns || [],
            completedAt: new Date().toISOString(),
          };
          return JSON.stringify(summary, null, 2);
        }

        return JSON.stringify({
          sessionId: session.sessionId,
          verifications: Array.from(session.verificationResults.entries()).map(([id, v]) => ({
            id,
            stage: v.stage,
            agents: v.agents,
            consensus: v.consensus,
            similarityScore: v.similarityScore,
          })),
        }, null, 2);
      },
    }),

    // ── TOOL 4: spider-verify ────────────────────────────────────────
    'spider-verify': tool({
      description: 'Submit verification results for N-dimensional comparison in the spiderweb. Consensus in v2.3 uses Jaccard similarity > 80% instead of exact string match.',
      args: {
        taskId: z.string(),
        stage: z.enum(['explore', 'architect', 'coder', 'reviewer', 'test_engineer', 'critic']),
        agentResults: z.array(z.object({
          agentId: z.string(),
          output: z.string(),
          files: z.array(z.string()),
          confidence: z.number().min(0).max(1),
        })),
      },
      execute: async (args) => {
        const session = requireSession(state);

        const agentResults: AgentResult[] = args.agentResults.map((r: { agentId: string; output: string; files: string[]; confidence: number }) => ({
          agentId: r.agentId,
          output: r.output,
          files: r.files,
          confidence: r.confidence,
          timestamp: Date.now(),
        }));

        const result = verificationWeb.verify(
          session,
          args.taskId,
          args.stage as SpiderPipelineStage,
          agentResults,
        );

        if (result.consensus) {
          // Use tryAdvanceStage (SPIDER-002: gate enforcement)
          const advanceResult = coordinator.tryAdvanceStage(session, 'Verification consensus achieved');
          return JSON.stringify({
            consensus: true,
            stage: args.stage,
            similarityScore: result.similarityScore,
            nextStage: advanceResult.nextStage,
            agents: result.agents,
            webTightness: session.webTightness,
            advanced: advanceResult.success,
            advanceError: advanceResult.error,
            message: advanceResult.success
              ? `All ${agentResults.length} agents agree (Jaccard: ${((result.similarityScore || 1) * 100).toFixed(0)}%). Advanced to ${advanceResult.nextStage}.`
              : `All ${agentResults.length} agents agree (Jaccard: ${((result.similarityScore || 1) * 100).toFixed(0)}%), but gate conditions prevent advancement.`,
          }, null, 2);
        }

        verificationWeb.tightenWeb(session);
        const hint = verificationWeb.getEscalationHint(session);
        return JSON.stringify({
          consensus: false,
          stage: args.stage,
          similarityScore: result.similarityScore,
          agents: result.agents,
          webTightness: session.webTightness,
          resolution: result.resolution,
          action: 'DISCREPANCY DETECTED',
          instructions: `[SPIDERWEB TIGHTENED] Stage ${session.stage}. Tightness: ${session.webTightness.toFixed(1)}x. Resolve before advancing.`,
          escalationHint: hint,
        }, null, 2);
      },
    }),

    // ── TOOL 5: spider-checkpoint ────────────────────────────────────
    'spider-checkpoint': tool({
      description: 'Create a checkpoint of current Spider v2.3 pipeline state with integrity verification',
      args: {
        message: z.string(),
      },
      execute: async (args) => {
        const session = requireSession(state);

        const checkpointDir = path.join(process.cwd(), '.spider-v2/checkpoints');
        fs.mkdirSync(checkpointDir, { recursive: true });

        const activeWeb = session.activeWebId ? webEngine.getWeb(session.activeWebId) : null;

        // Use the compaction survival module for integrity-verified checkpoints
        const checkpoint = createCompactionCheckpoint(session, null);
        checkpoint.activeWebId = session.activeWebId || '';

        const fullCheckpoint = {
          ...checkpoint,
          message: args.message,
          version: '2.3.0',
          session: {
            sessionId: session.sessionId,
            task: session.task,
            stage: session.stage,
            taskId: session.taskId,
            filesModified: session.filesModified,
            verificationCount: session.verificationResults.size,
            webTightness: session.webTightness,
            driftEvents: (session.driftEvents || []).length,
            escalationCount: session.escalationCount,
            slopScore: session.slopScore || 0,
            activeWebId: session.activeWebId,
            keyDecisions: session.keyDecisions || [],
            outstandingConcerns: session.outstandingConcerns || [],
          },
          activeWeb: activeWeb ? webEngine.getWebStatus(activeWeb.webId) : null,
          stageHistory: state.stageHistory,
          stageBoundaries: session.stageBoundaries || [],
          webAnchor: verificationWeb.getWebAnchorSnapshot(session),
        };

        const checkpointFile = path.join(checkpointDir, `${Date.now()}.json`);
        fs.writeFileSync(checkpointFile, JSON.stringify(fullCheckpoint, null, 2));

        // Store checkpoint on the session
        if (!session.checkpoints) session.checkpoints = [];
        session.checkpoints.push(checkpoint);

        return JSON.stringify({
          success: true,
          checkpoint: checkpointFile,
          message: args.message,
          stage: session.stage,
          webTightness: session.webTightness,
          activeWeb: session.activeWebId,
          integrityHash: checkpoint.stateHash,
          sequenceNumber: checkpoint.sequenceNumber,
        }, null, 2);
      },
    }),

    // ── TOOL 6: spiderweb ────────────────────────────────────────────
    'spiderweb': tool({
      description: 'Construct and manage SpiderWeb architecture. 3 modes: verify (2-4 strands, same task different approaches, Jaccard >80% consensus), divide (2-8 strands, task decomposed), pressure (2-4 strands, container adversarial testing). The Spider does NOT self-implement — the web does the work.',
      args: {
        action: z.enum(['construct', 'status', 'disperse', 'spawned', 'aggregate', 'tighten', 'dissolve']),
        task: z.string().optional().describe('Task description for construct'),
        mode: z.enum(['verify', 'divide', 'pressure']).optional().describe('Execution mode'),
        agentType: z.string().optional(),
        target: z.string().optional().describe('For pressure mode: path to artifact'),
        containerImage: z.string().optional().describe('For pressure: Docker image'),
        strandCount: z.number().min(2).max(8).optional(),
        webId: z.string().optional().describe('Web ID for status/aggregate/tighten/dissolve'),
      },
      execute: async (args) => {
        try {
          const session = requireSession(state);

          switch (args.action) {
            case 'construct': {
              const task = args.task || session.task || 'No task specified';
              const mode = (args.mode || 'verify') as WebExecutionMode;
              const stage = session.stage === 'idle' ? 'explore' : session.stage;

              const web = webEngine.constructWeb(
                task,
                session.acceptanceCriteria,
                stage,
                mode,
                args.strandCount,
                args.target,
              );

              linkWebToSession(state, web.webId, session.sessionId);

              return JSON.stringify({
                constructed: true,
                webId: web.webId,
                mode: web.executionMode,
                stage: web.stage,
                strandCount: web.strands.length,
                strands: web.strands.map(s => ({
                  id: s.strandId,
                  agent: s.subagentType,
                  task: s.taskDescription.substring(0, 100),
                  phase: s.pressurePhase,
                })),
                target: web.target,
                containerImage: web.containerImage,
                consensusMethod: mode === 'verify' ? 'Jaccard >80%' : mode === 'pressure' ? 'Pass rate ≥90%' : 'All strands complete',
                message: `Web constructed with ${web.strands.length} strands in ${mode} mode. Use spiderweb action=disperse to spawn strands.`,
              }, null, 2);
            }

            case 'disperse': {
              const webId = args.webId || session.activeWebId;
              if (!webId) {
                return JSON.stringify({ error: 'No active web. Use spiderweb action=construct first.' });
              }

              webEngine.activateWeb(webId);
              const web = webEngine.getWeb(webId);
              if (!web) {
                return JSON.stringify({ error: 'Web not found.' });
              }

              const strands = web.strands.map(s => ({
                id: s.strandId,
                agent: s.subagentType,
                command: `task description="${s.taskDescription.replace(/"/g, '\\"').substring(0, 300)}" subagent_type=${s.subagentType}`,
                phase: s.pressurePhase,
              }));

              return JSON.stringify({
                action_required: 'SPAWN SUBAGENTS',
                webId: web.webId,
                mode: web.executionMode,
                strandCount: web.strands.length,
                instructions: `YOU MUST NOW SPAWN ${web.strands.length} SUBAGENT(S) by calling the task tool for EACH strand below. The web only tracks state — it does NOT create agents. No subagents exist until you spawn them. RESTRICTION: ONLY use spider_ agent types (spider_explorer, spider_architect, spider_coder, etc.). NEVER use kraken_, manta_, shark_, or trident_ agent types.`,
                strands_to_spawn: strands.map(s => ({
                  strand: s.id,
                  agent_type: s.agent,
                  note: 'spider_ agent type only',
                  exact_command: s.command,
                })),
                next_step: `After spawning all ${web.strands.length} strand(s), call spiderweb action=spawned webId="${web.webId}" to mark them as running. Then use spiderweb action=status to monitor.`,
              }, null, 2);
            }

            case 'spawned': {
              const wId = args.webId || session.activeWebId;
              if (!wId) return JSON.stringify({ error: 'No webId.' });
              const ok = webEngine.markStrandsRunning(wId);
              const w = webEngine.getWeb(wId);
              return JSON.stringify({
                spawned: ok,
                webId: wId,
                mode: w?.executionMode,
                message: ok
                  ? `Strands marked as running. Monitor with spiderweb action=status.`
                  : `No strands were in 'spawning' state. Already running or completed.`,
              });
            }

            case 'status': {
              const webId = args.webId || session.activeWebId;
              if (!webId) {
                return JSON.stringify({ error: 'No active web.' });
              }

              const status = webEngine.getWebStatus(webId);
              const web = webEngine.getWeb(webId);
              const vibrations = web ? webEngine.detectVibrations(web) : [];

              return JSON.stringify({
                ...status,
                vibrations: vibrations.map(v => ({
                  type: v.type,
                  strand: v.strandId,
                  reason: v.reason,
                })),
              }, null, 2);
            }

            case 'aggregate': {
              const webId = args.webId || session.activeWebId;
              if (!webId) {
                return JSON.stringify({ error: 'No active web.' });
              }

              const web = webEngine.getWeb(webId);
              if (!web) {
                return JSON.stringify({ error: 'Web not found.' });
              }

              const aggregated = webEngine.aggregateResults(web);
              return JSON.stringify({
                webId: web.webId,
                mode: web.executionMode,
                consensus: aggregated.consensus,
                similarityScore: aggregated.similarityScore,
                strandCount: web.strands.length,
                completedStrands: web.strands.filter(s => s.status === 'completed').length,
                failedStrands: web.strands.filter(s => s.status === 'failed').length,
                discrepancies: aggregated.discrepancies,
                mergedOutputPreview: aggregated.mergedOutput.substring(0, 500),
                verificationProof: aggregated.verificationProof,
                message: aggregated.consensus
                  ? 'Web consensus achieved. Results verified.'
                  : 'Discrepancies detected. Use spiderweb action=tighten to resolve.',
              }, null, 2);
            }

            case 'tighten': {
              const webId = args.webId || session.activeWebId;
              if (!webId) {
                return JSON.stringify({ error: 'No active web.' });
              }

              const web = webEngine.getWeb(webId);
              if (!web) {
                return JSON.stringify({ error: 'Web not found.' });
              }

              webEngine.tightenWeb(webId, 'Manual tightening requested');
              const updatedWeb = webEngine.getWeb(webId);

              return JSON.stringify({
                tightened: true,
                webId,
                escalationCount: updatedWeb?.escalationCount,
                tightness: updatedWeb?.anchorState.tightness,
                reAnchoredStrands: updatedWeb?.strands.filter(s => s.status === 'pending').map(s => s.strandId),
                message: 'Web tightened. Failed/stuck strands reset to pending. Re-disperse to re-run them.',
              }, null, 2);
            }

            case 'dissolve': {
              const webId = args.webId || session.activeWebId;
              if (!webId) {
                return JSON.stringify({ error: 'No active web.' });
              }

              const report = webEngine.dissolveWeb(webId);
              if (session.activeWebId === webId) {
                session.activeWebId = null;
              }

              return JSON.stringify({
                dissolved: true,
                report,
                message: 'Web dissolved. Results archived.',
              }, null, 2);
            }

            default:
              return JSON.stringify({ error: 'Unknown action. Use: construct, disperse, status, aggregate, tighten, dissolve.' });
          }
        } catch (err) {
          return JSON.stringify({ error: err instanceof Error ? err.message : String(err) });
        }
      },
    }),
  };
}
