/**
 * Spider v2.3 — Semantic Engine v3.0 Type Definitions
 *
 * This is the single source of truth for every type used across the
 * 6-layer autonomous-agent audit pipeline. All layers (L0–L5), the
 * CFG/DFA engines, the Ship-Gate Evaluator, the Derailment Detector,
 * and the Compaction/Checkpoint system draw their types exclusively
 * from here.
 *
 * Layer architecture:
 *   L0 — Empty-Set Consensus Gate
 *   L1 — Structural Integrity (AST / imports / exports)
 *   L2 — Control-Flow & Data-Flow Analysis (CFG + DFA)
 *   L3 — Semantic Correctness (TypeChecker-backed rules)
 *   L4 — Runtime-Behaviour Contracts (promises, side-effects, I/O)
 *   L5 — Derailment & Drift Detection
 */

// ---------------------------------------------------------------------------
// Primitive enums / unions
// ---------------------------------------------------------------------------

/** Severity levels for semantic findings, ordered by impact. */
export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

/** Possible escalation actions when a rule is violated repeatedly. */
export type EscalationLevel = 'warn' | 'block' | 'restart' | 'lockout';

/** Stages of the Spider autonomous loop. */
export type SpiderStage =
  | 'init'
  | 'plan'
  | 'code'
  | 'test'
  | 'audit'
  | 'fix'
  | 'compaction'
  | 'ship-gate'
  | 'complete'
  | 'failed';

/** Evidence types that can be collected during a step. */
export type EvidenceType =
  | 'file_snapshot'
  | 'test_result'
  | 'linter_output'
  | 'typecheck_result'
  | 'runtime_log'
  | 'git_diff'
  | 'coverage_report'
  | 'console_output';

/** Categories of CFG edges for richer analysis. */
export type CFGEdgeKind = 'fall-through' | 'branch-true' | 'branch-false' | 'loop-back' | 'exception' | 'return';

/** Direction of a data-flow analysis pass. */
export type DFADirection = 'forward' | 'backward';

/** Kind of a deliverable, used by the SRE/MVS system. */
export type DeliverableKind = 'code' | 'test' | 'config' | 'documentation' | 'asset';

/** Ship-Gate decision. */
export type ShipGateDecision = 'PASS' | 'FAIL' | 'CONDITIONAL_PASS';

/** Pattern source for the SRE regex engine. */
export type PatternSource = 'regex' | 'ast' | 'hybrid';

// ---------------------------------------------------------------------------
// Core finding & rule types
// ---------------------------------------------------------------------------

/** A single semantic finding produced by a rule. */
export interface SemanticFinding {
  /** Unique rule identifier, e.g. "P2" or "L3-TYPEOF-CHECK". */
  ruleId: string;
  /** How serious this finding is. */
  severity: Severity;
  /** Human-readable description of the problem. */
  message: string;
  /** Absolute or project-relative file path. */
  file: string;
  /** 1-based line number. */
  line: number;
  /** 1-based column number (optional). */
  column?: number;
  /** Optional suggestion for how to fix the issue. */
  fixSuggestion?: string;
  /** Additional context strings (e.g. surrounding code). */
  context?: string[];
}

/** Definition of a single rule that can be run against a source file. */
export interface RuleDefinition {
  /** Unique rule identifier. */
  id: string;
  /** Human-readable rule name. */
  name: string;
  /** Default severity if the rule fires. */
  severity: Severity;
  /** Which layer this rule belongs to (0–5). */
  layer: number;
  /**
   * Execute the rule against a single source file.
   *
   * The `checker` parameter MUST be used instead of raw text searching
   * for any rule that needs type information (fixes the P2 getText().includes
   * bug and the dead-export indexOf bug).
   */
  run(sourceFile: import('typescript').SourceFile, checker: import('typescript').TypeChecker): SemanticFinding[];
}

// ---------------------------------------------------------------------------
// Layer & audit-report types
// ---------------------------------------------------------------------------

/** Summary of one audit layer. */
export interface RuleLayer {
  /** Layer name, e.g. "L0 — Empty-Set Consensus Gate". */
  name: string;
  /** Whether the layer passed overall. */
  passed: boolean;
  /** Total number of checks performed. */
  totalChecks: number;
  /** Number of checks that passed. */
  passedChecks: number;
  /** Findings produced by this layer. */
  findings: SemanticFinding[];
}

/** The full audit report produced by the 6-layer engine. */
export interface RGEAuditReport {
  /** True only when every layer passes. */
  overallPassed: boolean;
  /**
   * Pass rate as a fraction in [0, 1].
   *
   * IMPORTANT BUG FIX: If zero files were analysed the pass rate is 0,
   * NOT 1.  The old SRE returned 100 % for an empty set, which masked
   * catastrophic failures.
   */
  passRate: number;
  /** The six audit layers, indexed 0–5. */
  layers: [RuleLayer, RuleLayer, RuleLayer, RuleLayer, RuleLayer, RuleLayer];
  /** All findings, aggregated across layers. */
  semanticFindings: SemanticFinding[];
  /** The web-id / return-to path for the session. */
  returnTo: string;
  /** Machine-readable fix instructions. */
  fixInstructions: FixInstruction[];
  /** Path to the evidence artefact directory. */
  evidencePath: string;
  /** Timestamp (ISO-8601) of when the report was generated. */
  generatedAt: string;
  /** Number of source files that were analysed. */
  totalFilesAnalyzed: number;
}

/** A single fix instruction attached to an audit report. */
export interface FixInstruction {
  /** The rule that was violated. */
  ruleId: string;
  /** What to do. */
  action: string;
  /** Priority ordering — lower is more urgent. */
  priority: number;
  /** File the fix applies to. */
  file?: string;
}

// ---------------------------------------------------------------------------
// Control-Flow Graph types
// ---------------------------------------------------------------------------

/**
 * A single basic block in the control-flow graph.
 *
 * BUG FIXES vs old RGE:
 * - `id` is now guaranteed unique via an incrementing counter (old RGE
 *   reused statement offsets as IDs, causing collisions).
 * - `successors` / `predecessors` are verified to be valid block IDs
 *   that actually exist in the CFG (old RGE had dangling edges).
 * - Loop-back edges are explicitly tagged via `edgeKinds`.
 */
export interface CFGBlock {
  /** Unique, monotonically-increasing block ID. */
  id: number;
  /** TypeScript AST nodes contained in this block. */
  statements: import('typescript').Node[];
  /** IDs of successor blocks. */
  successors: number[];
  /** IDs of predecessor blocks. */
  predecessors: number[];
  /** Kind of each successor edge (parallel array with `successors`). */
  edgeKinds: CFGEdgeKind[];
  /** Start offset in the source file (inclusive). */
  startPos: number;
  /** End offset in the source file (exclusive). */
  endPos: number;
  /** True if this is the entry block. */
  isEntry: boolean;
  /** True if this is an exit block. */
  isExit: boolean;
}

/**
 * Result of building a control-flow graph for one source file.
 *
 * BUG FIX: The old RGE could produce a CFG with no exit block when
 * every path was an infinite loop.  The builder now synthesises an
 * exit block and marks unreachable infinite loops as findings.
 */
export interface CFGResult {
  /** All basic blocks. */
  blocks: CFGBlock[];
  /** ID of the entry block. */
  entryBlockId: number;
  /** IDs of all exit blocks (may be more than one). */
  exitBlockIds: number[];
  /** True if the CFG contains at least one cycle (loop or recursion). */
  hasCycles: boolean;
  /** The source file this CFG was built from. */
  sourceFile: import('typescript').SourceFile;
}

// ---------------------------------------------------------------------------
// Dominator tree (Cooper-Harvey-Kennedy algorithm)
// ---------------------------------------------------------------------------

/**
 * Dominator information for a single CFG.
 *
 * Computed using the iterative Cooper-Harvey-Kennedy algorithm with
 * a reverse-postorder iteration strategy for fast convergence.
 */
export interface DominatorTree {
  /** Immediate dominators: idom[B] = ID of B's immediate dominator. */
  idom: Map<number, number>;
  /** Immediate post-dominators: postDom[B] = ID of B's immediate post-dominator. */
  postDom: Map<number, number>;
  /** Dominance frontier for each block. */
  dominanceFrontier: Map<number, number[]>;
  /** Strict dominators for each block (all dominators except the block itself). */
  strictDoms: Map<number, Set<number>>;
  /** Dominator tree children for each block. */
  domTreeChildren: Map<number, number[]>;
  /** The CFG this tree was computed from. */
  cfg: CFGResult;
}

// ---------------------------------------------------------------------------
// Data-Flow Analysis types
// ---------------------------------------------------------------------------

/**
 * Abstract data-flow state attached to each CFG block.
 *
 * Supports both forward (reaching-definitions, available-expressions)
 * and backward (live-variables, very-busy-expressions) analyses.
 */
export interface DFAState {
  /** Whether the block contains I/O operations (fs, net, console, etc.). */
  hasIO: boolean;
  /** Whether the block contains state mutation (assignment, push, splice, etc.). */
  hasMutation: boolean;
  /** Whether the block creates or awaits a Promise. */
  hasPromise: boolean;
  /** Whether the block contains an exception throw. */
  hasThrow: boolean;
  /** Variables defined (assigned) within this block. */
  definedVars: Set<string>;
  /** Variables used (read) before being defined in this block. */
  usedVars: Set<string>;
  /** Variables live on entry (backward analysis). */
  liveIn: Set<string>;
  /** Variables live on exit (backward analysis). */
  liveOut: Set<string>;
  /** Definitions reaching the entry of this block (forward analysis). */
  reachingDefsIn: Map<string, Set<number>>;
  /** Definitions reaching the exit of this block (forward analysis). */
  reachingDefsOut: Map<string, Set<number>>;
}

/** Result of a full data-flow analysis pass. */
export interface DFAResult {
  /** Per-block DFA states, keyed by block ID. */
  states: Map<number, DFAState>;
  /** Whether the fixed-point iteration converged. */
  converged: boolean;
  /** Number of iterations required for convergence. */
  iterations: number;
  /** Direction of this analysis. */
  direction: DFADirection;
  /** The CFG this analysis was performed on. */
  cfg: CFGResult;
}

// ---------------------------------------------------------------------------
// Evidence & atomic-step types (Spider loop)
// ---------------------------------------------------------------------------

/** Schema definition for validating collected evidence. */
export interface EvidenceSchema {
  /** JSON Schema or custom validator descriptor. */
  type: string;
  /** Required fields that must be present. */
  requiredFields: string[];
  /** Optional validation function name. */
  customValidator?: string;
}

/** A requirement that a step must satisfy with evidence. */
export interface EvidenceRequirement {
  /** What kind of evidence is expected. */
  type: EvidenceType;
  /** Schema the evidence must conform to. */
  schema: EvidenceSchema;
  /** Validator function that returns true if the evidence is acceptable. */
  validator: (evidence: unknown) => boolean;
}

/** A single atomic step in the Spider autonomous loop. */
export interface AtomicStep {
  /** Unique step identifier. */
  id: string;
  /** Human-readable description of what this step does. */
  description: string;
  /** What evidence this step must produce. */
  evidenceRequired: EvidenceRequirement[];
  /** Evidence that has been collected so far. */
  evidenceProvided: unknown[];
  /** Whether this step has been completed. */
  completed: boolean;
  /** Timestamp when the step was started. */
  startedAt?: string;
  /** Timestamp when the step was completed. */
  completedAt?: string;
}

// ---------------------------------------------------------------------------
// Output constraints (guard against placeholder / low-quality output)
// ---------------------------------------------------------------------------

/** Constraints on the code and explanation that Spider produces. */
export interface OutputConstraints {
  /** Minimum number of non-blank, non-comment code lines. */
  minCodeLines: number;
  /** Maximum number of code lines (prevents runaway generation). */
  maxCodeLines: number;
  /** Minimum explanation character count. */
  minExplanationChars: number;
  /** Maximum explanation character count. */
  maxExplanationChars: number;
  /** Regex patterns that must NOT appear in the output (e.g. "TODO", "FIXME", "…"). */
  noPlaceholderPatterns: RegExp[];
}

// ---------------------------------------------------------------------------
// Violation tracking & escalation
// ---------------------------------------------------------------------------

/** Tracks how many times a rule has been violated and what escalation to apply. */
export interface ViolationCounter {
  /** The rule being tracked. */
  ruleId: string;
  /** Number of violations so far. */
  count: number;
  /** Current escalation level. */
  escalationLevel: EscalationLevel;
  /** Thresholds at which escalation changes. */
  thresholds: EscalationThreshold[];
}

/** Maps a violation count to an escalation level. */
export interface EscalationThreshold {
  /** Minimum violation count to trigger this escalation. */
  minCount: number;
  /** The escalation level to apply. */
  level: EscalationLevel;
}

// ---------------------------------------------------------------------------
// Derailment & drift detection (L5)
// ---------------------------------------------------------------------------

/** A matcher used to identify findings that contribute to a derailment pattern. */
export interface FindingMatcher {
  /** Match by rule ID (exact or regex). */
  ruleId?: string;
  /** Match by severity level. */
  severity?: Severity;
  /** Match by file path pattern (glob or regex). */
  filePattern?: string;
  /** Match by finding message pattern (regex). */
  messagePattern?: string;
  /** Minimum number of matching findings required. */
  minCount?: number;
}

/** A structured derailment pattern that the L5 detector looks for. */
export interface StructuredPattern {
  /** Unique pattern identifier. */
  id: string;
  /** Human-readable name. */
  name: string;
  /** Symptoms (findings) that indicate this pattern. */
  symptoms: FindingMatcher[];
  /** Confidence score [0, 1] if all symptoms match. */
  confidence: number;
  /** Strategy string for fixing the derailment. */
  fixStrategy: string;
}

/** A derailment pattern with its detector function. */
export interface DerailmentPattern {
  /** Unique pattern identifier. */
  id: string;
  /** Human-readable name. */
  name: string;
  /** Detailed description of the derailment. */
  description: string;
  /** Detector function that evaluates the current session state. */
  detector: (session: SpiderSession) => DerailmentDetection | null;
  /** Severity if detected. */
  severity: Severity;
  /** How to remediate the derailment. */
  remediation: string;
}

/** Result of applying a derailment detector. */
export interface DerailmentDetection {
  /** The pattern that was detected. */
  patternId: string;
  /** Human-readable description. */
  description: string;
  /** Confidence score [0, 1]. */
  confidence: number;
  /** Evidence (findings) that support this detection. */
  evidence: SemanticFinding[];
}

// ---------------------------------------------------------------------------
// Compaction & checkpoint system
// ---------------------------------------------------------------------------

/** A checkpoint snapshot of the Spider session state. */
export interface CompactionCheckpoint {
  /** ISO-8601 timestamp. */
  timestamp: string;
  /** The stage at which the checkpoint was taken. */
  stage: SpiderStage;
  /** Active web-id for the current session. */
  activeWebId: string;
  /** Outstanding concerns that have not been resolved. */
  outstandingConcerns: string[];
  /** Key decisions made so far. */
  keyDecisions: string[];
  /** Snapshot of the audit report at checkpoint time. */
  auditSnapshot: RGEAuditReport | null;
  /** Hash of the state for integrity verification. */
  stateHash: string;
  /** Sequence number (monotonically increasing). */
  sequenceNumber: number;
}

// ---------------------------------------------------------------------------
// Spider session & state types
// ---------------------------------------------------------------------------

/** The top-level Spider session object. */
export interface SpiderSession {
  /** Unique session identifier. */
  id: string;
  /** Current stage in the autonomous loop. */
  stage: SpiderStage;
  /** The web-id / return-to path. */
  webId: string;
  /** All atomic steps in this session. */
  steps: AtomicStep[];
  /** Violation counters, keyed by rule ID. */
  violations: Map<string, ViolationCounter>;
  /** Checkpoints taken so far. */
  checkpoints: CompactionCheckpoint[];
  /** Findings accumulated across the session. */
  findings: SemanticFinding[];
  /** The most recent audit report. */
  lastAuditReport: RGEAuditReport | null;
  /** Number of fix iterations attempted. */
  fixIterations: number;
  /** Maximum fix iterations before escalation. */
  maxFixIterations: number;
  /** Whether the session is locked out due to repeated failures. */
  isLockedOut: boolean;
  /** Timestamp when the session was created. */
  createdAt: string;
  /** Timestamp when the session was last updated. */
  updatedAt: string;
}

/** The full Spider state machine state. */
export interface SpiderState {
  /** The active session. */
  session: SpiderSession;
  /** The semantic engine instance. */
  engine: import('./compiler-host.js').SemanticEngine | null;
  /** Output constraints for this run. */
  constraints: OutputConstraints;
  /** Derailment patterns to watch for. */
  derailmentPatterns: DerailmentPattern[];
  /** Compaction interval (in number of steps). */
  compactionInterval: number;
  /** Maximum number of compaction checkpoints to retain. */
  maxCheckpoints: number;
}

// ---------------------------------------------------------------------------
// SRE / MVS legacy types (still needed for backward compatibility)
// ---------------------------------------------------------------------------

/** Minimum Viable Submission — what must be present for a deliverable. */
export interface MVS {
  /** Files that must exist. */
  requiredFiles: string[];
  /** Minimum total lines of code. */
  minLines: number;
  /** Patterns that must NOT appear. */
  forbiddenPatterns: RegExp[];
  /** Patterns that MUST appear at least once. */
  requiredPatterns: RegExp[];
}

/** Definition of a deliverable that Spider must produce. */
export interface DeliverableDef {
  /** Unique deliverable identifier. */
  id: string;
  /** Human-readable name. */
  name: string;
  /** Kind of deliverable. */
  kind: DeliverableKind;
  /** Glob pattern for files that belong to this deliverable. */
  fileGlob: string;
  /** MVS criteria for this deliverable. */
  mvs: MVS;
  /** Priority for the ship-gate evaluator. */
  priority: number;
}

/** A single SRE regex-based rule (legacy, kept for L1 structural checks). */
export interface SRERule {
  /** Unique rule identifier. */
  id: string;
  /** Human-readable name. */
  name: string;
  /** The regex pattern. */
  pattern: RegExp;
  /**
   * How to interpret the pattern.
   *
   * BUG FIX (P11 anchoring): When source is 'regex', the pattern is
   * now automatically wrapped in proper grouping anchors ^(…)$ when
   * `anchored` is true, preventing partial-match false positives.
   */
  source: PatternSource;
  /** Whether the pattern should be anchored. */
  anchored: boolean;
  /** Severity if the pattern matches. */
  severity: Severity;
  /** What to do when this rule fires. */
  fixSuggestion?: string;
}

/** Result of running the SRE over a set of files. */
export interface SREResult {
  /** The rule that was executed. */
  ruleId: string;
  /** Whether the rule passed (no matches = pass). */
  passed: boolean;
  /** Findings for every match. */
  findings: SemanticFinding[];
  /** Files that were scanned. */
  filesScanned: number;
  /** Execution time in milliseconds. */
  executionTimeMs: number;
}

// ---------------------------------------------------------------------------
// Ship-Gate Evaluator (SGE) types
// ---------------------------------------------------------------------------

/** Verdict from the Ship-Gate Evaluator. */
export interface ShipGateVerdict {
  /** The decision. */
  decision: ShipGateDecision;
  /** Overall pass rate [0, 1]. */
  passRate: number;
  /** Findings that blocked a PASS (if any). */
  blockingFindings: SemanticFinding[];
  /** Waivers that were applied. */
  waiversApplied: Waiver[];
  /** Detailed breakdown per deliverable. */
  deliverableResults: DeliverableGateResult[];
  /** Timestamp of the verdict. */
  timestamp: string;
  /** The audit report this verdict is based on. */
  auditReport: RGEAuditReport;
}

/** A single deliverable's gate result. */
export interface DeliverableGateResult {
  /** The deliverable being evaluated. */
  deliverableId: string;
  /** Whether this deliverable passed its MVS. */
  mvsPassed: boolean;
  /** MVS details. */
  mvsDetails: MVSValidationDetail[];
  /** Findings associated with this deliverable. */
  findings: SemanticFinding[];
}

/** Detailed result of a single MVS criterion. */
export interface MVSValidationDetail {
  /** The criterion that was checked. */
  criterion: string;
  /** Whether it passed. */
  passed: boolean;
  /** Human-readable explanation. */
  message: string;
  /** Actual value observed (for debugging). */
  actualValue?: string | number;
}

/** A waiver that can suppress a finding. */
export interface Waiver {
  /** Unique waiver identifier. */
  id: string;
  /** The rule being waived. */
  ruleId: string;
  /** Reason for the waiver. */
  reason: string;
  /** Who approved the waiver. */
  approvedBy: string;
  /** When the waiver expires (ISO-8601). */
  expiresAt: string;
}

/** Configuration for the Ship-Gate Evaluator. */
export interface SGEConfig {
  /** Minimum pass rate required for a PASS verdict. */
  minPassRate: number;
  /** Rules whose findings are always blocking, regardless of severity. */
  alwaysBlockingRules: string[];
  /** Severities that block a PASS. */
  blockingSeverities: Severity[];
  /** Active waivers. */
  waivers: Waiver[];
  /** Deliverables to evaluate. */
  deliverables: DeliverableDef[];
  /** Maximum number of fix-and-retry cycles. */
  maxRetryCycles: number;
}

// ---------------------------------------------------------------------------
// Layer-specific configuration
// ---------------------------------------------------------------------------

/** Configuration for the L0 Empty-Set Consensus Gate. */
export interface L0Config {
  /**
   * If true, zero source files results in a FAIL (passRate = 0).
   *
   * This MUST be true — it fixes the critical empty-set consensus bug
   * where 0 files produced a 100 % pass rate.
   */
  failOnEmptySet: boolean;
  /** Minimum number of files required to consider the audit meaningful. */
  minFiles: number;
}

/** Configuration for the L2 CFG/DFA layer. */
export interface L2Config {
  /** Whether to compute dominator trees. */
  computeDominators: boolean;
  /** Whether to run forward data-flow analysis. */
  runForwardDFA: boolean;
  /** Whether to run backward data-flow analysis. */
  runBackwardDFA: boolean;
  /** Maximum number of fixed-point iterations before declaring non-convergence. */
  maxDFAIterations: number;
  /** Whether to detect unreachable code. */
  detectUnreachableCode: boolean;
}

/** Configuration for the L3 semantic-correctness layer. */
export interface L3Config {
  /**
   * If true, type-based checks MUST use the TypeChecker API rather
   * than text matching.  This fixes the P2 getText().includes('typeof')
   * bug where the old engine missed aliased or re-exported typeof
   * operators.
   */
  enforceTypeCheckerUsage: boolean;
}

/** Configuration for the L5 derailment-detection layer. */
export interface L5Config {
  /** Structured patterns to look for. */
  structuredPatterns: StructuredPattern[];
  /** Maximum allowed fix iterations before declaring derailment. */
  maxFixIterations: number;
  /** Maximum allowed repeated findings before declaring drift. */
  maxRepeatedFindings: number;
}

/** Top-level engine configuration. */
export interface EngineConfig {
  /** L0 configuration. */
  l0: L0Config;
  /** L2 configuration. */
  l2: L2Config;
  /** L3 configuration. */
  l3: L3Config;
  /** L5 configuration. */
  l5: L5Config;
  /** Ship-Gate configuration. */
  sge: SGEConfig;
  /** Output constraints. */
  constraints: OutputConstraints;
  /** Maximum number of audit cycles before forced termination. */
  maxAuditCycles: number;
  /** Project root directory. */
  projectRoot: string;
}

// ---------------------------------------------------------------------------
// Re-export convenience: aggregate report for external consumers
// ---------------------------------------------------------------------------

/** The complete result of running the Semantic Engine v3.0. */
export interface EngineResult {
  /** The audit report. */
  report: RGEAuditReport;
  /** The ship-gate verdict. */
  verdict: ShipGateVerdict;
  /** CFG results keyed by file path. */
  cfgResults: Map<string, CFGResult>;
  /** Dominator trees keyed by file path. */
  dominatorTrees: Map<string, DominatorTree>;
  /** DFA results keyed by file path. */
  dfaResults: Map<string, DFAResult>;
  /** Derailment detections (if any). */
  derailmentDetections: DerailmentDetection[];
  /** Total engine execution time in milliseconds. */
  executionTimeMs: number;
  /** Engine configuration that was used. */
  config: EngineConfig;
}

// ---------------------------------------------------------------------------
// Default values
// ---------------------------------------------------------------------------

/** Default L0 configuration with the empty-set bug fix enabled. */
export const DEFAULT_L0_CONFIG: L0Config = {
  failOnEmptySet: true,
  minFiles: 1,
};

/** Default L2 configuration with all analyses enabled. */
export const DEFAULT_L2_CONFIG: L2Config = {
  computeDominators: true,
  runForwardDFA: true,
  runBackwardDFA: true,
  maxDFAIterations: 100,
  detectUnreachableCode: true,
};

/** Default L3 configuration with TypeChecker enforcement enabled. */
export const DEFAULT_L3_CONFIG: L3Config = {
  enforceTypeCheckerUsage: true,
};

/** Default L5 configuration. */
export const DEFAULT_L5_CONFIG: L5Config = {
  structuredPatterns: [],
  maxFixIterations: 5,
  maxRepeatedFindings: 3,
};

/** Default output constraints. */
export const DEFAULT_OUTPUT_CONSTRAINTS: OutputConstraints = {
  minCodeLines: 10,
  maxCodeLines: 5000,
  minExplanationChars: 50,
  maxExplanationChars: 50000,
  noPlaceholderPatterns: [/TODO/i, /FIXME/i, /\.\.\./, /HACK/i],
};

/** Default SGE configuration. */
export const DEFAULT_SGE_CONFIG: SGEConfig = {
  minPassRate: 1.0,
  alwaysBlockingRules: [],
  blockingSeverities: ['CRITICAL', 'HIGH'],
  waivers: [],
  deliverables: [],
  maxRetryCycles: 3,
};

/** Default engine configuration. */
export const DEFAULT_ENGINE_CONFIG: EngineConfig = {
  l0: DEFAULT_L0_CONFIG,
  l2: DEFAULT_L2_CONFIG,
  l3: DEFAULT_L3_CONFIG,
  l5: DEFAULT_L5_CONFIG,
  sge: DEFAULT_SGE_CONFIG,
  constraints: DEFAULT_OUTPUT_CONSTRAINTS,
  maxAuditCycles: 10,
  projectRoot: process.cwd(),
};
