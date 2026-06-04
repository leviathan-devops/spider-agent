/**
 * spiderweb-types.ts — Spider v2.3 Web Type Definitions
 *
 * Defines all types related to the SpiderWeb parallel execution engine:
 * strands, anchor states, vibration events, aggregated results,
 * and pressure-testing types.
 */

import type { SpiderPipelineStage } from './state.js';

export type WebExecutionMode = 'verify' | 'divide' | 'pressure';
export type WebStatus = 'constructing' | 'active' | 'tightening' | 'dissolving' | 'completed';
export type StrandStatus = 'pending' | 'spawning' | 'running' | 'completed' | 'stuck' | 'failed';

export interface SpiderWeb {
  webId: string;
  task: string;
  acceptanceCriteria: string[];
  executionMode: WebExecutionMode;
  stage: SpiderPipelineStage;
  strands: SpiderStrand[];
  anchorState: WebAnchorState;
  escalationCount: number;
  createdAt: number;
  status: WebStatus;
  target?: string;
  containerImage?: string;
  // NEW: Mandatory pipeline stages — web cannot dissolve without ALL stages
  completedStages: string[];
  requiredStages: string[];
  // NEW: Evidence tracking
  evidenceCollected: boolean;
}

export interface SpiderStrand {
  strandId: string;
  subagentType: string;
  taskDescription: string;
  assignedFiles: string[];
  subagentSessionId: string;
  status: StrandStatus;
  output: string;
  exitCode?: number;
  startedAt: number;
  completedAt?: number;
  evidenceFiles?: EvidenceFileResult[];
  pressurePhase?: number;
  containerId?: string;
}

export interface WebAnchorState {
  tightness: number;
  minVerifications: number;
  strandCount: number;
  activeStrands: number;
  completedStrands: number;
  escalationCount: number;
  lastTightening: number;
}

export interface VibrationEvent {
  type: 'stuck' | 'confused' | 'failed' | 'divergent' | 'slack';
  strandIndex: number;
  strandId: string;
  reason: string;
  timestamp: number;
}

export interface AggregatedWebResults {
  consensus: boolean;
  similarityScore?: number;
  strandResults: Record<string, string>;
  mergedOutput: string;
  discrepancies: string[];
  verificationProof: boolean;
}

export interface WebCompletionReport {
  webId: string;
  totalStrands: number;
  completedStrands: number;
  failedStrands: number;
  finalOutput: string;
  evidencePath: string;
  dissolvedAt: number;
  passRate?: number;
}

export interface EvidenceFileResult {
  file: string;
  exists: boolean;
  valid: boolean;
  reason?: string;
}

export interface PressurePhaseResult {
  name: string;
  passed: boolean;
  assertions: PressureAssertion[];
}

export interface PressureAssertion {
  name: string;
  pass: boolean;
  failMsg: string;
}

export interface PressureReport {
  timestamp: string;
  overallPassed: boolean;
  passRate: number;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  phases: PressurePhaseResult[];
  evidenceGate: { passed: boolean; filesPresent: number; filesValid: number; failures: string[] };
  verdict: string;
}

export interface StrandPressureConfig {
  strandId: string;
  phase: number;
  containerImage: string;
  target: string;
  hiveMount: string;
  apiKeyEnv: string;
  model: string;
}
