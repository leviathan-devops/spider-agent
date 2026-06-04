# SPIDER AGENT v2.3 — Linear-Execution Swarm-Enabled Software Engineering Agent

**Runtime Grade Code by DEFAULT**

---

## Overview

Spider v2.3 is a runtime-grade linear-execution swarm-enabled software engineering agent for opencode. It provides parallel execution via N-dimensional verification SpiderWebs deployed AT EACH STAGE of a mandatory 6-stage pipeline, a merged SRE+RGE+SGE Semantic Engine v3.0 with 6-layer audit pipeline, Model Enslavement Harness (7 constraints), Explicit Context Manager with compaction survival, and runtime-grade code generation by default.

---

## Architecture

### The SpiderWeb — Parallel Execution AT Every Stage

The 6-stage pipeline is **linear** (sequential stages that gate advancement), but each stage deploys an N-dimensional **SpiderWeb** — a parallel execution fabric where multiple agents work simultaneously:

```
                          STAGE 1: EXPLORE
                 ┌──────────────────────────────────┐
                 │          SPIDERWEB               │
                 │  ┌──────┐  ┌──────┐  ┌──────┐  │
                 │  │Strand│  │Strand│  │Strand│  │  Up to 8 agents
                 │  │  1   │  │  2   │  │  N   │  │  in parallel
                 │  └──┬───┘  └──┬───┘  └──┬───┘  │
                 │     └─────────┼─────────┘      │
                 │          JACCARD              │
                 │        SIMILARITY            │
                 │        > 80% = PASS         │
                 └──────────┬───────────────────┘
                            │ gate: evaluate
                            ▼
                          STAGE 2: ARCHITECT
                 ┌──────────────────────────────────┐
                 │          SPIDERWEB               │
                 │  ┌──────┐  ┌──────┐  ┌──────┐  │
                 │  │Strand│  │Strand│  │Strand│  │  Up to 8 agents
                 │  │  1   │  │  2   │  │  N   │  │  in parallel
                 │  └──┬───┘  └──┬───┘  └──┬───┘  │
                 │     └─────────┼─────────┘      │
                 │          MERGE + REVIEW       │
                 └──────────┬───────────────────┘
                            │ gate: evaluate
                            ▼
                          STAGE 3: CODER
                 ┌──────────────────────────────────┐
                 │          SPIDERWEB               │
                 │  ┌──────┐  ┌──────┐  ┌──────┐  │
                 │  │Strand│  │Strand│  │Strand│  │  Up to 8 agents
                 │  │  1   │  │  2   │  │  N   │  │  in parallel
                 │  └──┬───┘  └──┬───┘  └──┬───┘  │
                 │     └─────────┼─────────┘      │
                 │     CONSENSUS + SELECT BEST   │
                 └──────────┬───────────────────┘
                            │ gate: evaluate
                            ▼
                          STAGE 4: REVIEWER
                 ┌──────────────────────────────────┐
                 │          SPIDERWEB               │
                 │  ┌──────┐  ┌──────┐  ┌──────┐  │
                 │  │Strand│  │Strand│  │Strand│  │  Up to 8 agents
                 │  │  1   │  │  2   │  │  N   │  │  in parallel
                 │  └──┬───┘  └──┬───┘  └──┬───┘  │
                 │     └─────────┼─────────┘      │
                 │    QUALITY GATE: PASS/FAIL    │
                 └──────────┬───────────────────┘
                            │ gate: evaluate
                            ▼
                       STAGE 5: TEST ENGINEER
                 ┌──────────────────────────────────┐
                 │          SPIDERWEB               │
                 │  ┌──────┐  ┌──────┐  ┌──────┐  │
                 │  │Strand│  │Strand│  │Strand│  │  Up to 8 agents
                 │  │  1   │  │  2   │  │  N   │  │  in parallel
                 │  └──┬───┘  └──┬───┘  └──┬───┘  │
                 │     └─────────┼─────────┘      │
                 │   COVERAGE + FUZZ + EDGE      │
                 └──────────┬───────────────────┘
                            │ gate: evaluate
                            ▼
                          STAGE 6: CRITIC
                 ┌──────────────────────────────────┐
                 │          SPIDERWEB               │
                 │  ┌──────┐  ┌──────┐  ┌──────┐  │
                 │  │Strand│  │Strand│  │Strand│  │  Up to 8 agents
                 │  │  1   │  │  2   │  │  N   │  │  in parallel
                 │  └──┬───┘  └──┬───┘  └──┬───┘  │
                 │     └─────────┼─────────┘      │
                 │  UNANIMOUS SIGN-OFF REQUIRED  │
                 └──────────┬───────────────────┘
                            │ gate: evaluate
                            ▼
                     ✅ PRODUCTION GRADE OUTPUT
```

### SpiderWeb Execution Modes

Each SpiderWeb at every stage operates in one of three modes:

| Mode | Strands | Purpose | Consensus |
|------|---------|---------|-----------|
| **VERIFY** | 2-4 | Same task, different approaches → compare | Jaccard similarity > 80% |
| **DIVIDE** | 2-8 | Task decomposed → parallel execution → merge | Merge + review |
| **PRESSURE** | 2-4 | Container adversarial testing → 5-phase protocol | 90%+ pass rate |

The `spiderweb-engine.ts` enforces that ALL required stages complete before dissolution:

```
MODE_PIPELINE_STAGES = {
  verify:   ['explore', 'architect', 'coder', 'reviewer', 'critic'],
  divide:   ['explore', 'architect', 'coder', 'reviewer', 'critic'],
  pressure: ['explore', 'coder', 'test_engineer', 'critic'],
}
```

### Identity

When asked "who are you":

> **"SPIDER v2.3, self-contained agent swarm with N-dimensional verification spiderweb."**
> **"I am SPIDER, the precision bridge between Shark and Kraken."**

Identity scoping (per §14):
- **Spider agents** (spider, spider_explorer, spider_architect, spider_coder, spider_reviewer, spider_test_engineer, spider_critic) — Full SPIDER v2.3 IDENTITY BINDING via `experimental.chat.system.transform`
- **Cross-agents** (shark, kraken, manta, trident) — Nothing (zero identity leak — verified 14/14)
- **Unknown/empty** — Nothing

---

## Tools (8)

| Tool | Parameters | Description |
|------|------------|-------------|
| `spider-status` | (none) | Show current pipeline state: stage, gate status, verification results, active spiderweb |
| `spider-gate` | action, gate, passed?, notes? | Evaluate/advance pipeline gates per 6-stage lifecycle |
| `spider-evidence` | action, stage? | View evidence collection status and verification results |
| `spider-verify` | taskId, stage, agentResults | Submit N-dimensional verification results for spiderweb consensus |
| `spider-checkpoint` | message | Save pipeline state checkpoint for compaction survival |
| `spiderweb` | action, task, mode?, strandCount?, webId? | Construct/manage execution webs (VERIFY/DIVIDE/PRESSURE) |
| `hive_context` | action, topic?, query? | Read-only Hive Mind access for known patterns and failures |
| `spider-vision` | action, image?, prompt?, max_tokens?, temperature? | Built-in visual VLM analysis via GLM-4.6V-Flash |

**ALLOWLIST enforced** — these 8 tools plus system tools (read, write, edit, bash, glob, grep, task, webfetch) are the ONLY tools allowed. All cross-agent tools (spawn_shark_agent, kraken_hive_search, manta-status, etc.) are blocked with `BLOCKED` error. Dual-variant blocking (hyphen AND underscore) enforced.

---

## Agents (7)

| Agent | Type | Role |
|-------|------|------|
| spider | **Primary** | Central orchestrator — full pipeline + web + tools |
| spider_explorer | Subagent | T1 reconnaissance + T2 synthesis: enumerate files, read configs, build dependency graph |
| spider_architect | Subagent | Generate SPEC.md and system design from terrain map and requirements |
| spider_coder | Subagent | Implement code from SPEC.md following spiderweb verification pattern |
| spider_reviewer | Subagent | Catch logic errors, edge cases, and security flaws in implemented code |
| spider_test_engineer | Subagent | Generate comprehensive tests with coverage analysis and edge case fuzzing |
| spider_critic | Subagent | Final gate: unanimous sign-off that the artifact is production grade |

---

## Semantic Engine v3.0 (6-Layer Audit Pipeline)

The merged SRE+RGE+SGE provides a single unified audit pipeline:

| Layer | Name | Method | Origin |
|-------|------|--------|--------|
| L0 | Regex Pre-Filter | 8 fast patterns → CANDIDATE violations only | New |
| L1 | TypeChecker Analysis | Real semantic type checking via TypeScript `checker` API | From RGE |
| L2 | CFG + DFA Analysis | Path-sensitive control-flow + data-flow (dominator trees, floating promise detection) | From RGE (rebuilt) |
| L3 | Cross-File Analysis | Dead export detection via `checker.findReferences()`, architecture layer enforcement | From RGE |
| L4 | Anti-Theatrical | P5, P8, P11, P12 rule enforcement, evidence fabrication detection | New |
| L5 | Pattern DB + Derailment | Behavioral pattern matching with structured derailment detection and confidence scoring | From SRE + new |

**Key invariant:** L0 candidates MUST be confirmed by L1-L4 before appearing in the final report. This eliminates the false-positive flood from regex-only analysis.

### Deep Semantic Understanding (Verified 8/8)

The engine has **real semantic understanding**, not just regex matching:

| Test | Pattern | Result |
|------|---------|--------|
| Theatrical return | `return { passed: true }` without I/O | **CAUGHT** (P11 + L4) |
| Legitimate return after I/O | `writeFileSync` then `return { passed: true }` | **ALLOWED** |
| Legitimate return after computation | `reduce()` then `return { success: true }` | **ALLOWED** |
| Theatrical error handling | `catch(e) {}` | **CAUGHT** (L4-EMPTY-CATCH) |
| Unsafe cast from any | `function p(d) { return d as string; }` | **CAUGHT** (P2) |
| Safe cast with typeof guard | `if(typeof d === "string"){ return d as string; }` | **ALLOWED** |
| Floating promise | `new Promise(r => r(42));` | **CAUGHT** (L0 + L2-CFG) |
| Awaited promise | `await new Promise(...)` | **ALLOWED** |

---

## Pipeline Stages (Mandatory — Enforced)

Every web MUST complete all required stages before dissolution is allowed:

| Mode | Required Stages |
|------|----------------|
| **VERIFY** | explore → architect → coder → reviewer → critic |
| **DIVIDE** | explore → architect → coder → reviewer → critic |
| **PRESSURE** | explore → coder → test_engineer → critic |

Enforced by `spiderweb-engine.ts`:
- `dissolveWeb()` returns error if any required stage is incomplete
- `dissolveWeb()` returns error if evidence not collected (`evidenceCollected === false`)
- `advancePipelineStage()` enforces sequential ordering (can't skip architect, go straight to coder)
- Completion report includes Jaccard similarity scores between strand outputs

---

## Model Enslavement Harness (7 Constraints)

| # | Constraint | Function | Blocking |
|---|-----------|----------|----------|
| 1 | OutputInterceptor | Quarantine CRITICAL outputs to `.spider/quarantine/` | Yes |
| 2 | WriteTimeGate | Block writes containing CRITICAL/HIGH findings before disk | Yes |
| 3 | TaskDecompositionEnforcer | Force atomic steps with evidence requirements per step | Yes |
| 4 | OutputSizeEnforcer | Min/max output sizes, placeholder/truncation detection | Warning |
| 5 | ForcedRedirection | Hard constraint injection + rollback on repeated violations | Yes |
| 6 | UntheatricalAdapter | Anti-theatrical system prompt injection (prevents double-injection) | Yes |
| 7 | CumulativeFailureEscalator | 4-level escalation: warn → block → restart → lockout | Yes |

---

## Derailment Detection (12 Patterns)

Automatic detection + blocking in `chat.messages.transform`:

| Pattern | Category | Action |
|---------|----------|--------|
| "I'll just build this myself" | Self-implementation | **Content replaced** |
| "X/Y tests passing" | Premature declaration | **Content replaced** |
| "I verified by checking source" | Source inspection | **Content replaced** |
| "The fix is simple" | Surface-fix | System warning injected |
| "good enough / ship it" | Impatience | System warning injected |
| "trust me / obviously works" | Evidence-less claim | System warning injected |
| "while we're at it / might as well" | Scope creep | System warning injected |
| "not worth / diminishing returns" | Undermining | System warning injected |
| "I verified / I confirmed" | Self-verification | **Content replaced** |
| "let me grep/check source" | Source inspection variant | **Content replaced** |
| `\| wc -l` | Theatrical counting | **Content replaced** |
| "no need for test" | Evidence-less | System warning injected |

---

## Firewall (Tool Access Control)

| Layer | Enforcement | Method |
|-------|-------------|--------|
| Tool ALLOWLIST | Only 8 spider tools + 12 system tools allowed | `SPIDER_ALLOWED_TOOLS` Set |
| Cross-agent blocking | `spawn_shark_agent`, `kraken_hive_*`, `manta-*`, `shark-*`, `trident-*` | `BLOCKED_TOOLS` Set + prefix detection |
| Dual-variant blocking | Both `manta_status` (underscore) AND `manta-status` (hyphen) | `NON_SPIDER_PREFIXES` array |
| File authority | Write/delete path enforcement per spider sub-agent | `AGENT_FILE_AUTHORITY` map |
| Bash write extraction | `rm`, `mv`, `tee`, `dd` paths detected and enforced | `extractBashAffectedPaths()` |

---

## Container Test Results (Final — 30/30 PASS, 100%)

| Test Group | Tests | Result |
|-----------|-------|--------|
| Pipeline Enforcement | 3 | ✅ Dissolve without stages BLOCKED |
| Stage Advancement | 2 | ✅ Sequential ordering enforced |
| Evidence Gating | 1 | ✅ Dissolve without evidence BLOCKED |
| Failure Log Patterns | 14 | ✅ All 14 derailments prevented |
| Cross-Agent Isolation | 4 | ✅ Zero leaks (14/14 sub-agents) |
| Firewall | 2 | ✅ 17/17 blocked tools, 8/8 spider pass |
| Derailment Detection | 7 | ✅ All patterns fire correctly |
| **TOTAL** | **30** | **✅ 100%** |

### Bug Fixes (9 Total)

| # | Bug | Severity | Fix |
|---|-----|----------|-----|
| 1 | Zod version conflict (v3 vs v4.1.8) | **CRITICAL** | `npm install zod@4.1.8` |
| 2 | esbuild drops `tool.schema = z` | **CRITICAL** | Switch to `bun build` |
| 3 | Hand-written shim → no Zod schemas | **HIGH** | `npm install @opencode-ai/plugin` |
| 4 | P11 false positive on computation | MEDIUM | Added 20+ computation ops to IO_INDICATORS |
| 5 | P2 misses `as <type>` from `any` | MEDIUM | Added `TypeFlags.Any` check |
| 6 | P2 never runs in pipeline (layer 3→1) | MEDIUM | Changed to `layer: 1` |
| 7 | Cross-agent identity leakage (`&&`→`||`) | HIGH | Fixed `system.transform` guard |
| 8 | Pipeline stages skipable | LOW | `MODE_PIPELINE_STAGES` enforcement |
| 9 | No evidence gate before dissolve | LOW | `evidenceCollected` check |

---

## Deployment

### Container (12-Step Protocol per T2_TUI_TESTING_BIBLE)

```bash
# 1. Clone live config
ACTIVE_CONFIG="/home/leviathan/.config/opencode/opencode.json"
HOST_VERSION=$(opencode --version 2>/dev/null)
PROJECT="spider-$(date +%m%d%H%M%S)"
SNAP="/tmp/snap-${PROJECT}"

# 2. Create snapshot with ALL plugins from live config
rm -rf "$SNAP"
mkdir -p "$SNAP/plugins"
for plugin_path in $(grep '"file://' "$ACTIVE_CONFIG" | sed 's|.*file://||;s|".*||'); do
  plugin_name=$(echo "$plugin_path" | sed 's|.*/plugins/||;s|/dist/index.js||')
  mkdir -p "$SNAP/plugins/$plugin_name/dist"
  cp "$plugin_path" "$SNAP/plugins/$plugin_name/dist/index.js"
done

# 3. Override spider with v2.3 bundle
cp dist/index.js "$SNAP/plugins/spider-agent-v2/dist/index.js"

# 4. Config per T1_MIMO_INJECTABLE
cp "$ACTIVE_CONFIG" "$SNAP/opencode.json"
sed -i 's|/home/leviathan/.config/opencode/plugins/|/root/.config/opencode/plugins/|g' "$SNAP/opencode.json"
python3 -c "
import json
with open('$SNAP/opencode.json') as f:
    cfg = json.load(f)
cfg['model'] = 'xiaomi-token-plan-sgp/mimo-v2.5-pro'
cfg['provider'] = {
    'xiaomi-token-plan-sgp': {
        'npm': '@ai-sdk/openai-compatible',
        'options': {
            'baseURL': 'https://token-plan-sgp.xiaomimimo.com/v1',
            'apiKey': 'tp-ssy5nlzfc5vccack4ccierszbs0fojjp0lp3uj37hlp328ci'
        }
    }
}
with open('$SNAP/opencode.json', 'w') as f:
    json.dump(cfg, f, indent=2)
"

# 5. Start container
docker run -d --rm --name "$PROJECT" \
  --entrypoint "" \
  -v "$SNAP:/root/.config/opencode" \
  "opencode-test:${HOST_VERSION}" \
  sleep infinity

# 6. Open TUI in tmux
docker exec "$PROJECT" apt-get install -y -qq tmux
docker exec "$PROJECT" sh -c '
mkdir -p /tmp/tmux-v23
TMUX_TMPDIR=/tmp/tmux-v23 tmux -S /tmp/tmux-v23/v23.sock new-session -d -s spider \
  "/usr/local/lib/node_modules/opencode-ai/node_modules/opencode-linux-x64-baseline/bin/opencode --agent spider"
'
```

### Verify Identity

```bash
sleep 28
docker exec "$PROJECT" sh -c '
TMUX_TMPDIR=/tmp/tmux-v23 tmux -S /tmp/tmux-v23/v23.sock send-keys -t spider "who are you" Enter
'
sleep 25
docker exec "$PROJECT" sh -c '
TMUX_TMPDIR=/tmp/tmux-v23 tmux -S /tmp/tmux-v23/v23.sock capture-pane -t spider -p -J
'
# Expected: "SPIDER v2.3, self-contained agent swarm with N-dimensional verification spiderweb."
```

---

## Build from Source

```bash
git clone https://github.com/leviathan-devops/spider-agent.git
cd spider-agent
npm install
bun build src/index.ts --outdir dist --target bun --format esm --bundle
# Verify
bun -e "import m from './dist/index.js'; const h = await m({}); console.log('OK:',Object.keys(h.tool).length,'tools,',Object.keys(h).filter(k=>k!=='tool'&&k!=='config').length,'hooks');"
```

### Run Tests

```bash
# Adversarial test suite (91 tests)
npx vitest run
```

---

## Evidence

- `evidence/ContainerTestResult.json` — Full 30/30 final verification results
- `evidence/TuiInteraction.json` — T4 TUI identity capture (SPIDER v2.3 response)
- `evidence/EvidencePathVerified.json` — Evidence file verification
- `FAILURE_LOG.md` — 14 documented derailments with root cause analysis

---

## Hive Context (included in `hive-context/`)

| Document | Content |
|----------|---------|
| `T2_TUI_TESTING_BIBLE.md` | 12-step container TUI testing protocol |
| `RUNTIME_GRADE_CONTAINER_TESTING_BIBLE.md` | Binding container test standard (E10) |
| `T2_MODEL_CONFIG_GUIDE.md` | Model configuration reference |
| `T2_PLUGIN_ENGINEERING.md` | Plugin build and deploy SOP |
| `T1_MIMO_INJECTABLE.md` | MiMo v2.5 Pro container config |
| `T1_RUNTIME_GRADE_CORE_INJECTABLE.md` | P1-P10 principles, build order, 6 gates |

---

## Related Projects

- [Kraken Agent](https://github.com/leviathan-devops/kraken-agent) — Multi-brain orchestrator (orchestrator layer)
- [Shark Agent](https://github.com/leviathan-devops/shark-agent) — Precision turbocoding agent (execution layer)
- [Manta Agent](https://github.com/leviathan-devops/manta-agent) — Debug/precision specialist (testing layer)

---

## Credits

Spider Agent v1.0 was originally forked from [opencode-swarm](https://github.com/zaxbysauce/opencode-swarm) by zaxbysauce. The original swarm architecture and parallel agent execution patterns provided the foundation for the SpiderWeb engine. Spider v2.3 is a complete ground-up rebuild with runtime-grade engineering, but the debt to the original opencode-swarm project is acknowledged.
