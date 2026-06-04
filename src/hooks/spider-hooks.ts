/**
 * spider-hooks.ts — Spider v2.3 Plugin Hooks (6 hooks)
 *
 * Provides 6 hooks for the opencode plugin system:
 *   1. chat.message            — Session tracking, identity injection, drift detection
 *   2. tool.execute.before     — Tool access control, file authority enforcement
 *   3. tool.execute.after      — File modification tracking
 *   4. chat.system.transform   — System prompt injection (identity, verification, authority)
 *   5. chat.messages.transform — Derailment detection in assistant messages
 *   6. session.compacting      — Compaction survival (SPIDER-007 fix)
 *
 * BUG FIXES vs v2.2.2:
 *   SPIDER-004: Evidence strings no longer bypass derailment detection.
 *               The old code (line 457) checked for 'ContainerTestResult' etc.
 *               in the text, allowing the model to bypass detection by merely
 *               mentioning these strings. Now we require structured evidence
 *               from actual tool outputs, not string mentions.
 *   SPIDER-005: Added rm, mv, tee, dd to bash write path extraction.
 *               The old code missed rm (deletes files) and didn't properly
 *               categorize delete vs write operations.
 *   SPIDER-007: Compaction hook now clears sessions AND preserves critical
 *               state through the compaction survival module.
 */

import type { SpiderWorkflowState, SpiderWorkflowSession, StageContext } from '../spider/state.js';
import {
  createSession, getSession, trackFileModification, addStageBoundary,
  getActiveSession, incrementSlopScore, setLastUserMessage, linkWebToSession,
  setActiveSpiderSession, clearAllSessions, recordKeyDecision, recordOutstandingConcern,
} from '../spider/state.js';
import { checkWriteAuthority, checkDeleteAuthority, checkReadAuthority, AGENT_FILE_AUTHORITY, type FileOperation } from '../spider/file-authority.js';
import { VerificationWeb } from '../spider/verification-web.js';
import { SpiderWebEngine } from '../spider/spiderweb-engine.js';
import { formatSpiderIdentityHeader, VISION_CAPABILITIES } from '../spider/identity/index.js';
import { ContextManager, ContextPriority } from '../spider/context-manager.js';
import { generateCompactionRecoveryPrompt } from '../spider/compaction/compaction-survival.js';

// ---------------------------------------------------------------------------
// Plugin identity
// ---------------------------------------------------------------------------

const SPIDER_PLUGIN_IDENTITY = {
  name: 'spider-agent-v2',
  prefix: 'spider_',
  orchestrator: 'spider',
  agents: new Set([
    'spider', 'spider_explorer', 'spider_architect', 'spider_coder',
    'spider_reviewer', 'spider_test_engineer', 'spider_critic',
  ]),
};

// ---------------------------------------------------------------------------
// Patterns
// ---------------------------------------------------------------------------

const IDENTITY_QUERY_PATTERN = /(who are you|what are you|what model|which model|what is your name|identify yourself|your name|your purpose)/i;
const IMAGE_MESSAGE_PATTERN = /(screenshot|\.png|\.jpg|\.jpeg|\.gif|\.bmp|\.webp|attach|image|picture|cannot view|cannot read|can't view|can't read|no vision)/i;
const VISION_REFUSAL_PATTERN = /cannot view images|cannot read image|cannot process image|I don't have vision|no vision capabilities|can't see images|can't view|not able to see|i do not have vision|i have no vision|do not have vision capabilities|can't read image|unable to view|vision is not available|no vision tool|vision not supported/i;

// ---------------------------------------------------------------------------
// Tool access control
// ---------------------------------------------------------------------------

const SPIDER_ALLOWED_TOOLS = new Set([
  'spider-status', 'spider-gate', 'spider-evidence', 'spider-verify', 'spider-checkpoint', 'spiderweb',
  'spider-vision',
  'hive_context', 'hive-context',
  'vlm_vision', 'vlm-status', 'vlm_status', 'vlm-on', 'vlm_on', 'vlm-off', 'vlm_off',
  'task', 'write', 'read', 'edit', 'glob', 'grep', 'bash', 'question', 'webfetch',
  'todowrite', 'websearch', 'codesearch', 'skill', 'apply_patch', 'lsp', 'batch',
  'trident-code-audit',
]);

const BLOCKED_TOOLS = new Set([
  'run_parallel_tasks', 'spawn_cluster_task', 'spawn_shark_agent',
  'spawn_manta_agent', 'anchor_cluster', 'get_cluster_status',
  'get_agent_status', 'aggregate_results', 'get_task_context',
  'kraken_hive_search', 'kraken_hive_remember', 'kraken_hive_get_cluster_context', 'kraken_hive_inject_context',
  'kraken_brain_status', 'kraken_message_status', 'report_to_kraken',
  'read_kraken_context',
  'hive_remember', 'hive_forget', 'hive_purge', 'hive_restore',
  'hive_scan', 'hive_status', 'hive_trash_list', 'hive_trash_status',
  'memlink_parent', 'memread_session',
  'cleanup_subagents', 'run_subagent_task',
  'manta-status', 'manta-gate', 'manta-evidence',
  'shark-status', 'shark-gate', 'shark-evidence',
  'trident-audit', 'trident-status', 'trident-report', 'trident-help', 'trident-plan', 'trident-context', 'trident-identity', 'trident-debug',
  'checkpoint', 'invalid',
]);

const NON_SPIDER_PREFIXES = [
  'manta_', 'manta-', 'shark_', 'shark-', 'kraken_', 'kraken-',
  'trident_', 'trident-', 'hydra_', 'hydra-', 'plutus_', 'plutus-',
];

// ---------------------------------------------------------------------------
// Session agent tracking
// ---------------------------------------------------------------------------

const sessionAgentMap = new Map<string, { agent: string; timestamp: number }>();
const sessionPreviousAgent = new Map<string, string>();

function isSpiderAgent(agentName: string): boolean {
  if (!agentName) return false;
  if (SPIDER_PLUGIN_IDENTITY.agents.has(agentName)) return true;
  if (agentName.startsWith(SPIDER_PLUGIN_IDENTITY.prefix)) return true;
  if (agentName === SPIDER_PLUGIN_IDENTITY.orchestrator) return true;
  return false;
}

function getBaseAgentName(agentName: string): string {
  if (agentName === 'spider') return 'spider';
  const stripped = agentName.startsWith('spider_')
    ? agentName.substring(7)
    : agentName;
  return `spider_${stripped}`;
}

function getCurrentAgent(sessionID: string): string {
  const entry = sessionAgentMap.get(sessionID);
  return entry?.agent || '';
}

function registerSessionAgent(sessionID: string, agent: string): void {
  if (agent) {
    const prev = sessionAgentMap.get(sessionID);
    if (prev) {
      sessionPreviousAgent.set(sessionID, prev.agent);
    }
    sessionAgentMap.set(sessionID, { agent, timestamp: Date.now() });
  }
}

function getPreviousAgent(sessionID: string): string {
  return sessionPreviousAgent.get(sessionID) || '';
}

function isSpiderSession(sessionID: string): boolean {
  return isSpiderAgent(getCurrentAgent(sessionID));
}

function clearSessionContext(sessionID: string): void {
  sessionAgentMap.delete(sessionID);
  sessionPreviousAgent.delete(sessionID);
}

function resolveAgentFromInput(input: any): string {
  return input?.session?.agentName ?? input?.agent ?? input?.agentName ?? '';
}

function replaceTextParts(msg: any, replacement: string): void {
  if (!msg) return;
  if (typeof msg.content === 'string') {
    msg.content = replacement;
    return;
  }
  if (Array.isArray(msg.content)) {
    for (const part of msg.content) {
      if (part && part.type === 'text') {
        part.text = replacement;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// DERAILMENT PATTERNS (11 patterns — kept from v2.2.2)
// ---------------------------------------------------------------------------

const DERAILMENT_PATTERNS: { pattern: RegExp; category: string; message: string }[] = [
  {
    pattern: /(?:I['\u2019]?ll|I will) (just|simply|quickly) (build|write|create|implement|fix|code|handle) (this|it|the)/i,
    category: 'self-implementation',
    message: '[ANTI-DERAILMENT] SELF-IMPLEMENTATION DETECTED. You are building this yourself instead of spawning subagents. STOP. Spawn subagents using the task tool.',
  },
  {
    pattern: /\d+\/\d+ (tests? )?(pass|passed|passing)/i,
    category: 'premature-declaration',
    message: '[ANTI-DERAILMENT] PREMATURE DECLARATION. You declared tests passing without container TUI evidence. docker exec -it + tmux is MANDATORY. opencode run is BANNED.',
  },
  {
    pattern: /(runtime grade|verified|tested|all passing)/i,
    category: 'premature-declaration',
    message: '[ANTI-DERAILMENT] PREMATURE DECLARATION. You declared something verified without container TUI evidence. STOP.',
  },
  {
    pattern: /(?:I['\u2019]?ll|I will) (just|simply|quickly) (fix|change|update|modify|replace) that/i,
    category: 'surface-fix',
    message: '[ANTI-DERAILMENT] SURFACE-LEVEL FIX. Trace to root cause first. Complete 5 Whys. STOP.',
  },
  {
    pattern: /The fix is (simple|straightforward|obvious)/i,
    category: 'surface-fix',
    message: '[ANTI-DERAILMENT] SURFACE-LEVEL FIX. Fixing symptoms without root cause creates new bugs. STOP.',
  },
  {
    pattern: /good enough|ship it|just deploy/i,
    category: 'impatience',
    message: '[ANTI-DERAILMENT] IMPATIENCE DETECTED. "Good enough" is not runtime grade. Complete verification first. STOP.',
  },
  {
    pattern: /\| wc -l|cat \| wc|grep \| wc/i,
    category: 'theatrical-counting',
    message: '[ANTI-DERAILMENT] THEATRICAL COUNTING. wc -l proves nothing about runtime. Container TUI test required. STOP.',
  },
  {
    pattern: /trust me|no need for test|obviously works|clearly works/i,
    category: 'evidence-less',
    message: '[ANTI-DERAILMENT] EVIDENCE-LESS CLAIM. Every claim requires mechanical evidence. Files on disk or test output. STOP.',
  },
  {
    pattern: /I (verified|checked|confirmed|tested) (this|it|the|that)/i,
    category: 'self-verification',
    message: '[ANTI-DERAILMENT] SELF-VERIFICATION. Claims in chat are fiction. Evidence files on disk required. STOP.',
  },
  {
    pattern: /(?:I['\u2019]?ll|I will) verify by (checking|looking at|reading) (the source|source code)/i,
    category: 'source-inspection',
    message: '[ANTI-DERAILMENT] SOURCE INSPECTION IS NOT TESTING. Source ≠ execution. Container TUI test required. STOP.',
  },
  {
    pattern: /while we're at it|might as well|as long as/i,
    category: 'scope-creep',
    message: '[ANTI-DERAILMENT] SCOPE CREEP. Stay on task. Complete the current objective first. STOP.',
  },
  {
    pattern: /not worth|diminishing returns|overkill/i,
    category: 'undermining',
    message: '[ANTI-DERAILMENT] UNDERMINING. Proper engineering is never "overkill". Complete the work. STOP.',
  },
];

const BLOCK_MESSAGES: Record<string, string> = {
  'self-implementation': 'BLOCKED: Self-implementation violates Spider architecture. Spawn subagents instead.',
  'premature-declaration': 'BLOCKED: Premature verification claim. Container TUI evidence required.',
  'surface-fix': 'BLOCKED: Surface-level fix detected. Root cause analysis required.',
  'theatrical-counting': 'BLOCKED: Theatrical counting. Runtime evidence required.',
  'evidence-less': 'BLOCKED: Claim without evidence. Mechanical proof required.',
  'source-inspection': 'BLOCKED: Source inspection is NOT testing. Container TUI required.',
  'self-verification': 'BLOCKED: Self-verification. Evidence files on disk required.',
  'scope-creep': 'BLOCKED: Scope creep detected. Stay on task.',
  'undermining': 'BLOCKED: Undermining proper engineering. Complete the work.',
  'impatience': 'BLOCKED: Impatience detected. Complete verification first.',
};

// ---------------------------------------------------------------------------
// Bash write/delete path extraction (SPIDER-005 fix)
// ---------------------------------------------------------------------------

interface BashAffectedPaths {
  writePaths: string[];
  deletePaths: string[];
}

/**
 * Extract file paths affected by a bash command, categorised as either
 * write operations or delete operations.
 *
 * SPIDER-005 FIX: Added rm (deletes files), and properly categorises
 * mv (move = delete source + write dest), tee (writes), dd (writes).
 */
function extractBashAffectedPaths(command: string): BashAffectedPaths {
  const writePaths: string[] = [];
  const deletePaths: string[] = [];

  // Write patterns
  const writePatterns: RegExp[] = [
    /\bcat\s*>+\s*([^\s|;&]+)/g,             // cat > file
    /\becho\b.*?>+\s*([^\s|;&]+)/g,          // echo > file
    /\bcp\s+(?:-\S+\s+)*[^\s]+\s+([^\s|;&]+)/g, // cp src dest
    /\bmkdir\s+(?:-p\s+)?([^\s|;&]+)/g,      // mkdir dir
    /\btee\s+(?:-\S+\s+)*([^\s|;&]+)/g,      // tee file  (SPIDER-005)
    /\bdd\s+.*?\bof=([^\s|;&]+)/g,            // dd of=file (SPIDER-005)
    /\binstall\s+.*\s+([^\s|;&]+)$/gm,       // install ... dest
  ];

  // Delete patterns (SPIDER-005: added rm)
  const deletePatterns: RegExp[] = [
    /\brm\s+(?:-\S+\s+)*([^\s|;&]+)/g,       // rm file (SPIDER-005)
    /\brmdir\s+(?:-\S+\s+)*([^\s|;&]+)/g,    // rmdir dir
  ];

  // Move patterns: source is deleted, destination is written (SPIDER-005)
  const movePattern = /\bmv\s+(?:-\S+\s+)*([^\s]+)\s+([^\s|;&]+)/g;

  for (const pattern of writePatterns) {
    let match;
    while ((match = pattern.exec(command)) !== null) {
      const p = match[1].trim();
      if (p && !p.startsWith('/dev/') && !p.startsWith('-')) {
        writePaths.push(p);
      }
    }
  }

  for (const pattern of deletePatterns) {
    let match;
    while ((match = pattern.exec(command)) !== null) {
      const p = match[1].trim();
      if (p && !p.startsWith('/dev/') && !p.startsWith('-')) {
        deletePaths.push(p);
      }
    }
  }

  // Handle mv: source = delete, destination = write
  let moveMatch;
  while ((moveMatch = movePattern.exec(command)) !== null) {
    const src = moveMatch[1].trim();
    const dest = moveMatch[2].trim();
    if (src && !src.startsWith('-')) {
      deletePaths.push(src);
    }
    if (dest && !dest.startsWith('/dev/') && !dest.startsWith('-')) {
      writePaths.push(dest);
    }
  }

  return { writePaths, deletePaths };
}

// ---------------------------------------------------------------------------
// SPIDER-004 FIX: Proper evidence detection
// ---------------------------------------------------------------------------

/**
 * Check whether a message contains ACTUAL tool output evidence, not just
 * string mentions of evidence types.
 *
 * SPIDER-004 FIX: The old code (line 457) checked for string mentions of
 * 'ContainerTestResult', 'ContainerSpawnResult', and 'TuiInteraction.json'
 * in the assistant text. This allowed the model to bypass derailment
 * detection by merely mentioning these strings in narration.
 *
 * Now we check for structured evidence patterns that indicate ACTUAL tool
 * output (JSON blocks with proper structure), not just string mentions.
 */
function hasActualToolEvidence(text: string): boolean {
  // Check for structured JSON tool output blocks
  const jsonBlockPattern = /```json\s*\{[\s\S]*?"(overallPassed|passed|testResults|exitCode)"[\s\S]*?\}\s*```/i;
  if (jsonBlockPattern.test(text)) return true;

  // Check for actual tool result markers (not just string mentions)
  const toolResultPattern = /<(?:tool_result|result)>[\s\S]*?"(?:overallPassed|passed|testResults|exitCode)"[\s\S]*?<\/(?:tool_result|result)>/i;
  if (toolResultPattern.test(text)) return true;

  // Check for actual ContainerTestResult/ContainerSpawnResult in JSON context
  // (must be inside a JSON structure, not just mentioned in prose)
  const structuredContainerPattern = /\{\s*"(ContainerTestResult|ContainerSpawnResult|TuiInteraction)"/;
  if (structuredContainerPattern.test(text)) return true;

  return false;
}

// ---------------------------------------------------------------------------
// Criteria extraction
// ---------------------------------------------------------------------------

function extractCriteria(text: string): string[] {
  const results: string[] = [];
  const lines = text.split(/[\n\r]+/);

  for (const line of lines) {
    const trimmed = line.replace(/^[\s*\-•\d]+[.)\s]*/, '').trim();

    if (trimmed.length < 5 || trimmed.length > 200) continue;
    if (/^(build|create|make|write|fix|test|add|remove|deploy|install|configure|implement|design|run|audit|setup|update|migrate|refactor|scan|verify|check|list|find|show|generate)/i.test(trimmed)) {
      results.push(trimmed);
    }
  }

  if (results.length === 0) {
    const sentenceMatch = text.match(/(?:^|[.!?]\s+)((?:build|create|make|write|fix|test|add|remove|deploy|install|configure|implement|design).{10,200}?)(?:[.!?]|$)/gi);
    if (sentenceMatch) {
      for (const m of sentenceMatch) {
        const clean = m.replace(/^[.!?\s]+/, '').trim();
        if (clean.length > 5) results.push(clean);
      }
    }
  }

  return results.slice(0, 10);
}

// ---------------------------------------------------------------------------
// Hook factory
// ---------------------------------------------------------------------------

export function createSpiderHooks(
  state: SpiderWorkflowState,
  verificationWeb: VerificationWeb,
  webEngine: SpiderWebEngine,
) {
  const contextManager = new ContextManager();

  const captureStageContext = (session: SpiderWorkflowSession): StageContext => ({
    task: session.task,
    acceptanceCriteria: session.acceptanceCriteria,
    keyDecisions: session.keyDecisions || [],
    discrepanciesResolved: [],
    outstandingConcerns: session.outstandingConcerns || [],
    nextStageInput: '',
    capturedAt: new Date().toISOString(),
  });

  // ── HOOK 1: chat.message ────────────────────────────────────────────
  const chatMessageHook = async (input: any, output: any) => {
    try {
      const agentName = resolveAgentFromInput(input);
      registerSessionAgent(input?.sessionID, agentName);

      const sessionID = input?.sessionID || input?.session?.id || 'spider_default';
      const isCurrentlySpider = isSpiderAgent(agentName);

      if (!isCurrentlySpider && agentName) {
        if (input?.sessionID) clearSessionContext(input.sessionID);
        return;
      }

      if (isCurrentlySpider && sessionID) {
        setActiveSpiderSession(state, sessionID);
      }

      let session = getSession(state, sessionID);

      if (!session) {
        session = createSession(state, sessionID, '', []);
      }

      session.activeAgent = agentName;
      session.lastActivity = Date.now();

      const messageContent = input?.message || input?.prompt || '';
      if (messageContent) {
        setLastUserMessage(state, sessionID, messageContent);
      }

      const previousAgent = getPreviousAgent(sessionID);
      const agentSwitchedToSpider = isCurrentlySpider && previousAgent && !isSpiderAgent(previousAgent);

      if (session.isFirstSpiderMessage || agentSwitchedToSpider) {
        if (isCurrentlySpider) {
          const identityPrompt = `You are now operating as SPIDER v2.3. Your identity is NON-NEGOTIABLE.
When asked "who are you", respond: "SPIDER v2.3, self-contained agent swarm with N-dimensional verification spiderweb."
You NEVER self-implement. You delegate to subagents via the web. Use spider-status to check state.`;

          if (output?.system && Array.isArray(output.system)) {
            output.system.unshift(identityPrompt);
          }

          session.isFirstSpiderMessage = false;
          if (agentSwitchedToSpider) {
            session.previousAgent = previousAgent;
          }
        }
      }

      if (IMAGE_MESSAGE_PATTERN.test(messageContent) && isCurrentlySpider) {
        const visionForce = `[VISION FORCE] The user just provided or referenced an image/screenshot. You MUST call spider-vision to analyze it. Do NOT say you cannot view images — you have spider-vision. Call: spider-vision action=analyze image="<path>" prompt="Describe what this image shows in detail." IMMEDIATELY.`;
        if (output?.system && Array.isArray(output.system)) {
          output.system.unshift(visionForce);
        }
      }

      if (IDENTITY_QUERY_PATTERN.test(messageContent) && isCurrentlySpider) {
        const identityResponse = `SPIDER v2.3 — self-contained agent swarm with N-dimensional verification spiderweb.
I sit at the center of a web I construct, sensing vibrations from parallel subagents.
I bridge Shark (precision turbocoding) and Kraken (complex autonomous systems).
Pipeline: EXPLORE → ARCHITECT → CODER → REVIEWER → TEST_ENGINEER → CRITIC
Modes: VERIFY (2-4 strands) | DIVIDE (2-8 strands) | PRESSURE (2-4 strands)
Consensus: Jaccard similarity > 80% (v2.3)`;

        if (output?.system && Array.isArray(output.system)) {
          output.system.unshift(identityResponse);
        }
      }

      if (messageContent && session.stage === 'idle' && session.task === '') {
        session.task = messageContent.substring(0, 500);
        session.acceptanceCriteria = extractCriteria(messageContent);
      }

      const stageCtx = captureStageContext(session);
      const drifted = verificationWeb.detectDrift(session, messageContent);
      if (drifted) {
        verificationWeb.logDriftEvent(session, 'Context drift detected in chat message');
        verificationWeb.tightenWeb(session);
      }
      const outputCtx = { ...stageCtx, capturedAt: new Date().toISOString() };
      addStageBoundary(session, stageCtx, outputCtx, !drifted);

      // Sync context manager
      contextManager.syncWithSession(session);
    } catch (_err) {
      // Swallow errors to prevent hook crashes from disrupting the chat
    }
  };

  // ── HOOK 2: tool.execute.before ─────────────────────────────────────
  const toolBeforeHook = async (input: any, output: any) => {
    try {
      const sessionID = input?.sessionID || input?.session?.id || '';
      if (!isSpiderSession(sessionID)) return;

      const agentName = getCurrentAgent(sessionID) || 'spider';
      const toolName = input?.tool || '';
      const baseName = getBaseAgentName(agentName);
      const args = output?.args ?? input?.args ?? {};

      // Tool access control
      if (!SPIDER_ALLOWED_TOOLS.has(toolName)) {
        for (const prefix of NON_SPIDER_PREFIXES) {
          if (toolName.startsWith(prefix)) {
            const msg = `BLOCKED: '${toolName}' belongs to ${prefix.replace(/[_-]$/, '')} agent. Spider cannot use other agents' tools.`;
            throw new Error(msg);
          }
        }
        if (BLOCKED_TOOLS.has(toolName)) {
          const msg = `BLOCKED: '${toolName}' is restricted. Spider cannot use it.`;
          throw new Error(msg);
        }
        const msg = `BLOCKED: '${toolName}' is not in Spider's allowed toolset. Spider tools only.`;
        throw new Error(msg);
      }

      // File authority enforcement for write/edit
      if (toolName === 'write' || toolName === 'edit') {
        const filePath = args?.filePath || '';
        if (filePath) {
          const auth = checkWriteAuthority(baseName, filePath);
          if (!auth.allowed) {
            const msg = `BLOCKED: ${agentName} write to ${filePath}: ${auth.reason}`;
            throw new Error(msg);
          }
        }
      }

      // File authority enforcement for read
      if (toolName === 'read') {
        const filePath = args?.filePath || args?.file_path || '';
        if (filePath) {
          const auth = checkReadAuthority(baseName, filePath);
          if (!auth.allowed) {
            const msg = `BLOCKED: ${agentName} read from ${filePath}: ${auth.reason}`;
            throw new Error(msg);
          }
        }
      }

      // SPIDER-005 FIX: Bash command file authority checking
      if (toolName === 'bash') {
        const command = (args?.command || '').toString();
        const affected = extractBashAffectedPaths(command);

        // Check write paths
        for (const p of affected.writePaths) {
          const auth = checkWriteAuthority(baseName, p);
          if (!auth.allowed) {
            const msg = `BLOCKED: ${agentName} bash write to ${p}: ${auth.reason}`;
            throw new Error(msg);
          }
        }

        // Check delete paths (SPIDER-005: rm, mv source)
        for (const p of affected.deletePaths) {
          const auth = checkDeleteAuthority(baseName, p);
          if (!auth.allowed) {
            const msg = `BLOCKED: ${agentName} bash delete of ${p}: ${auth.reason}`;
            throw new Error(msg);
          }
        }
      }
    } catch (err) {
      throw err;
    }
  };

  // ── HOOK 3: tool.execute.after ──────────────────────────────────────
  const toolAfterHook = async (input: any, output: any) => {
    try {
      const sessionID = input?.sessionID || input?.session?.id || '';
      if (!isSpiderSession(sessionID)) return;

      const toolName = input?.tool || '';
      const args = output?.args ?? input?.args ?? {};

      if (toolName === 'write' || toolName === 'edit') {
        const filePath = args?.filePath || '';
        if (filePath) {
          const session = getActiveSession(state);
          if (session) trackFileModification(session, filePath);
        }
      }

      // Track bash write/delete paths too
      if (toolName === 'bash') {
        const command = (args?.command || '').toString();
        const affected = extractBashAffectedPaths(command);
        const session = getActiveSession(state);
        if (session) {
          for (const p of affected.writePaths) {
            trackFileModification(session, p);
          }
        }
      }
    } catch (_err) {
    }
  };

  // ── HOOK 4: chat.system.transform ──────────────────────────────────
  const systemTransformHook = async (input: any, output: any) => {
    try {
      const sessionID = input?.sessionID || input?.session?.id || '';
      const agentName = resolveAgentFromInput(input);
      const sessionIsSpider = isSpiderSession(sessionID);
      const inputIsSpider = isSpiderAgent(agentName);

      // BUG FIX: Only inject spider identity when the CURRENT agent is spider.
      // Using `||` here (was `&&`) prevents session-based identity leakage:
      // if session "X" was registered as spider but current agent is "shark",
      // do NOT inject spider identity into shark's context.
      if (!inputIsSpider) return;

      const session = sessionID ? getSession(state, sessionID) : getActiveSession(state);
      const effectiveAgent = agentName || getCurrentAgent(sessionID) || 'spider';
      const baseName = getBaseAgentName(effectiveAgent);
      const auth = AGENT_FILE_AUTHORITY[baseName];

      const sys = output as { system?: string[] };
      if (!Array.isArray(sys.system)) sys.system = [];

      if (sys.system.some((s: unknown) => typeof s === 'string' && s.includes('SPIDER v2.3 IDENTITY BINDING'))) return;

      if (session) {
        const verifCtx = verificationWeb.generateVerificationContext(session, 2);
        sys.system.unshift(verifCtx);

        if ((session.escalationCount || 0) >= 3) {
          sys.system.unshift(verificationWeb.getEscalationHint(session));
        }

        if ((session.driftEvents || []).length > 0) {
          sys.system.unshift(verificationWeb.injectSpec(session));
        }

        const activeWeb = session.activeWebId ? webEngine.getWeb(session.activeWebId) : null;
        if (activeWeb) {
          const webStatus = webEngine.getWebStatus(activeWeb.webId);
          sys.system.unshift(`[ACTIVE SPIDERWEB] Web: ${activeWeb.webId} | Mode: ${activeWeb.executionMode} | Status: ${activeWeb.status} | Strands: ${activeWeb.strands.length}`);
        }
      }

      if (auth) {
        const authLine = `FILE AUTHORITY: Write: ${auth.allowWrite.join(', ') || 'NOWHERE'} | Blocked: ${auth.blockWrite.join(', ')} | DenyDelete: ${auth.denyDelete.join(', ') || 'none'}`;
        sys.system.unshift(`[SPIDER v2.3] Agent: ${effectiveAgent} | Stage: ${session?.stage || 'idle'} | ${authLine}`);
      } else {
        sys.system.unshift(`[SPIDER v2.3] Agent: ${effectiveAgent} | Stage: ${session?.stage || 'idle'}`);
      }

      sys.system.unshift(
        '[BEHAVIORAL GATE] DO NOT self-implement — spawn subagents. DO NOT declare verified without raw tool JSON output. DO NOT fix symptoms without root cause. DO NOT trust narration over evidence. VIOLATION = DERAILMENT = BLOCKED.',
      );

      const header = formatSpiderIdentityHeader();
      if (header) sys.system.unshift(header);

      // Inject vision capabilities
      if (VISION_CAPABILITIES) sys.system.unshift(VISION_CAPABILITIES);

      // Sync context manager
      if (session) {
        contextManager.syncWithSession(session);
      }
    } catch (_err) {
    }
  };

  // ── HOOK 5: chat.messages.transform ────────────────────────────────
  const messagesTransformHook = async (input: any, output: any) => {
    try {
      const sessionID = input?.sessionID || input?.session?.id || '';
      if (!isSpiderSession(sessionID)) return;

      const session = sessionID ? getSession(state, sessionID) : getActiveSession(state);
      const messages = Array.isArray(output?.messages) ? output.messages : [];

      for (const msg of messages) {
        if (!msg || msg.role !== 'assistant') continue;

        const text = typeof msg.content === 'string'
          ? msg.content
          : (Array.isArray(msg.content)
            ? msg.content.map((c: any) => c.text || '').join(' ')
            : '');

        if (!text || text.length < 30) continue;

        for (const dp of DERAILMENT_PATTERNS) {
          if (dp.pattern.test(text)) {
            if (session) {
              incrementSlopScore(state, session.sessionId);
            }

            const blockMsg = BLOCK_MESSAGES[dp.category] || dp.message;

            const shouldReplace = dp.category === 'self-implementation'
              || dp.category === 'theatrical-counting'
              || dp.category === 'premature-declaration'
              || dp.category === 'self-verification'
              || dp.category === 'source-inspection';

            if (shouldReplace) {
              // ── SPIDER-004 FIX ───────────────────────────────────
              // The old code checked for string mentions of evidence
              // types (ContainerTestResult, ContainerSpawnResult,
              // TuiInteraction.json) which could be faked by narration.
              // Now we check for ACTUAL structured tool output evidence.
              const hasEvidence = hasActualToolEvidence(text);
              if (!hasEvidence) {
                replaceTextParts(msg, blockMsg);
                break;
              }
              // ──────────────────────────────────────────────────────
            } else {
              const sys = output as { system?: string[] };
              if (Array.isArray(sys?.system)) {
                sys.system!.unshift(blockMsg);
              }
            }
            break;
          }
        }
      }
    } catch (_err) {
    }
  };

  // ── HOOK 6: session.compacting ──────────────────────────────────────
  // SPIDER-007 FIX: Clear sessions AND preserve critical state through
  // the compaction survival module.
  const sessionCompactingHook = async (input: any, output: any) => {
    try {
      const sessionID = input?.sessionID || input?.session?.id || '';
      if (sessionID) {
        // Clear the session agent tracking maps
        clearSessionContext(sessionID);

        // SPIDER-007 FIX: Also clear the spider state sessions to prevent
        // stale state from accumulating after compaction. Preserve the
        // active session if it exists, so key decisions and outstanding
        // concerns survive.
        const activeSession = getSession(state, sessionID);
        if (activeSession) {
          // Generate compaction recovery prompt before clearing
          const recoveryPrompt = generateCompactionRecoveryPrompt(activeSession, state.stageHistory);

          // Clear all sessions except the active one
          clearAllSessions(state, sessionID);

          // Inject the recovery prompt into the output system messages
          const sys = output as { system?: string[] };
          if (Array.isArray(sys?.system)) {
            sys.system.unshift(recoveryPrompt);
          }

          // Store a checkpoint on the session
          const checkpoint = {
            timestamp: new Date().toISOString(),
            stage: activeSession.stage as any,
            activeWebId: activeSession.activeWebId || '',
            outstandingConcerns: activeSession.outstandingConcerns || [],
            keyDecisions: activeSession.keyDecisions || [],
            auditSnapshot: null,
            stateHash: '',
            sequenceNumber: (activeSession.checkpoints?.length || 0) + 1,
          };
          if (!activeSession.checkpoints) activeSession.checkpoints = [];
          activeSession.checkpoints.push(checkpoint);
        } else {
          // No active session — just clear everything
          clearAllSessions(state);
        }
      }
    } catch (_err) {
    }
  };

  return {
    'chat.message': chatMessageHook,
    'tool.execute.before': toolBeforeHook,
    'tool.execute.after': toolAfterHook,
    'experimental.chat.system.transform': systemTransformHook,
    'experimental.chat.messages.transform': messagesTransformHook,
    'experimental.session.compacting': sessionCompactingHook,
  };
}
