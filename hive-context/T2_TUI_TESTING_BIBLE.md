# T2_TUI_TESTING_BIBLE — Container TUI Testing Bible

**Version:** 1.14.x (updated 2026-06-01)
**Default Model:** `xiaomi-token-plan-sgp/mimo-v2.5-pro` (MiMo credits — milk it)
**Permitted Fallbacks:** `opencode-zen/deepseek-v4-flash-free`, `openrouter/deepseek-v4-flash-free`, `openrouter/nemotron-3-super-free`, `google/Gemma-4-26b`
**BANNED:** `minimax/*`, `deepseek/*` direct API (use free tiers via opencode-zen or openrouter), `xlam2/*`, any paid API except MiMo
**MiMo API Key:** tp-ssy5nlzfc5vccack4ccierszbs0fojjp0lp3uj37hlp328ci
**Previous version (1.4.3):** ARCHIVED — outdated binary paths, wrong config format, wrong entrypoint pattern

---

## FRACTAL INTEGRATION MAP

This document is one vertex of a self-reinforcing fractal architecture. The three bibles are dimensionally superimposed — each contains the whole within each part:

```
                        ┌──────────────────────┐
                        │  RUNTIME GRADE        │
                        │  ENGINEERING BIBLE     │
                        │  (Chapter 16:         │
                        │   Container Test       │
                        │   Standard)            │
                        │  P1-P10 Principles     │
                        └──────┬───────────────┘
                               │ "verify mechanically"
                               │  in runtime env
                               ▼
┌─────────────────────────────────────────────────────────┐
│  T2_TUI_TESTING_BIBLE  ◄─── fractally contains ────┤
│  (THIS DOCUMENT)                                         │
│  • Runtime Grade P1-P10 embedded in every section        │
│  • Adversarial Pressure Testing Framework Phase 1-5      │
│    referenced as the stress-test arm                     │
│  • Container Test Standard §16 as the WHAT               │
│  • This document as the HOW                              │
└────────────────────┬────────────────────────────────────┘
                     │ "stress test the runtime"
                     ▼
┌─────────────────────────────────────────────────────────┐
│  ADVERSARIAL PRESSURE TESTING FRAMEWORK                 │
│  (v1.0.0 — 5-Phase Protocol)                            │
│  • Phase 1: Compilation & Module Load                   │
│  • Phase 2: Identity Scoping & Cross-Agent Isolation    │
│  • Phase 3: Mode-Specific Functional Validation         │
│  • Phase 4: Firewall & Blocking Enforcement             │
│  • Phase 5: Theatrical Element Audit                    │
│  • 35/35 tests passing, zero theatrical                  │
└─────────────────────────────────────────────────────────┘
```

### How To Read This Fractal

- **Runtime Grade Engineering Bible** (`RUNTIME_GRADE_ENGINEERING_BIBLE.md`): The WHAT — defines the 10 principles (P1-P10) that every agent must follow to produce code that works in a real runtime environment. Container Test Standard §16 defines the verification gates. This document is the HOW.
- **T2_TUI_TESTING_BIBLE** (this document): The HOW — the operational protocol for creating a runtime environment and executing container TUI tests that verify whether code meets Runtime Grade standards.
- **Adversarial Pressure Testing Framework** (`TESTING_FRAMEWORK_ADVERSARIAL_PRESSURE.md`): The STRESS-TEST — a 5-phase adversarial protocol that probes every hook, every mode, every firewall, and every identity boundary to expose theatrical code and runtime failures that simple happy-path TUI tests miss.

Each document contains the fingerprint of the other two. Reading any one gives you awareness of the whole system. Zoom into any section and you will find cross-references that lead you to the corresponding section in the other bibles.

---

## MANDATORY READ — Every Agent Session

**This document is the fractally superimposed operational standard for Runtime Grade container testing.** It fuses the COMMON-SENSE-BIBLE's behavioral enforcement with the Runtime Grade Engineering Bible's 10 principles and the Adversarial Pressure Testing Framework's 5-phase stress-test protocol.

### How To Find This Document

```
# Via read_kraken_context (Kraken/Shark/Manta agents):
read_kraken_context tui-testing

# Via direct file read:
cat ~/.local/share/opencode/hive-mind/kraken/context/T2_TUI_TESTING_BIBLE.md

# Via OpenViking search (when API is fixed):
viking://resources/hive-mind/shared/t2-context/T2_TUI_TESTING_BIBLE.md
```

**When to read this:** Before ANY container test. Before declaring ANY build complete. When an agent says "I verified the bundle" or "it compiled, therefore it works."

### What This Document Overrides

This document is the binding authority for container testing. It overrides:
- All May 8 2026 panic duplicates (DELETED — 14 files purged 2026-06-01)
- T1_CONTAINER_TESTING_WORKING.md (DELETED — used broken `docker attach`)
- Any document that says "opencode run is a valid test"
- Any document that claims container testing is "optional"
- Any hallucination that says "I can't run TUI, it requires X"

---

## Anti-Derailment Enforcement — COMMON-SENSE-BIBLE Fractal Embedding

Every rule from the COMMON-SENSE-BIBLE is embedded here dimensionally. An agent who reads this document absorbs all 9 common-sense rules without needing to read the COMMON-SENSE-BIBLE separately.

### Rule E1: Know Before You Guess — Navigation Enforcement

**CSB Rule 1 Refraction:** "If you don't know, search the knowledgebase BEFORE guessing."

**Enforcement in this Bible:**
- If an agent proposes a test method NOT in this document → BLOCK. Refer to the Hallucinated Barriers table.
- If an agent says "Let me try X instead of container testing" → Reject. Only the 12-step protocol is valid.
- If an agent can't find a tool/command → Read the Fractal Reference Index (§ at bottom). Don't invent alternatives.

**Detect/Block Pattern:**
```
Agent: "Let me test this a different way..."
Response: Which section of T2_TUI_TESTING_BIBLE authorizes that method?
If answer is not a section in this document → BLOCK. Run the 12-step protocol.
```

### Rule E2: Stuck = Say Stuck — Never Theatrical-Code

**CSB Rule 3 Refraction:** "If stuck, say you're stuck — don't theatrical-code your way out."

**Enforcement in this Bible:**
- If a step fails (container dies, TUI doesn't load, model won't resolve) → go to the **Failure Recovery Flow** section below. Do NOT fabricate a fake passing test.
- If wait times are too short (TUI hasn't loaded yet) → increase the sleep, don't claim "test passed" with empty output.
- If the model key is expired → report it. Don't switch to a different model just to get a green light.
- Acceptable: "Container test failed. Step 7: Container died. docker logs show: exec format error. Root cause: musl binary used. Fix: use baseline binary."
- Unacceptable: "Container test passed. Model responded with correct identity." (when the container actually died at Step 7)

### Rule E3: Mechanical Evidence Only — The Disk Rule

**CSB Rule 4 Refraction:** "Every claim requires mechanical evidence — files on disk, test output."

**CSB Rule 6 Refraction:** "If it's not on disk, it doesn't exist — claims in chat are fiction."

**Enforcement in this Bible:**
- "The test passed" is NOT a claim. The evidence files on disk ARE the claim.
- After the 12-step protocol: you MUST produce three evidence files on disk (ContainerSpawnResult.json, ContainerTestResult.json, TuiInteraction.json).
- If those files don't exist → the test did NOT happen. Full stop. No exceptions.
- If an agent says "I verified it" and no evidence files exist → classify as Verification Theater (RG §12.5).

### Rule E4: "I Can't" Is A Hallucination

**CSB Rule 5 Refraction:** "'I can't' is almost always a hallucination — prove you can't by trying."

**Enforcement in this Bible:**
- "I can't run tmux" → Hallucinated Barrier #1. tmux + docker exec -it works.
- "I need a display" → Hallucinated Barrier #4. tmux is terminal-native.
- "I can only use opencode run" → Hallucinated Barrier #2. opencode run is BANNED.
- "The image doesn't exist" → Hallucinated Barrier #7. 1.14.34 exists. Run `docker images | grep opencode-test`.
- Every "I can't" in the Hallucinated Barriers table is pre-debunked. Point to the table.

### Rule E5: One Version Per Plugin

**CSB Rule 7 Refraction:** "One version per plugin — never have multiple versions loaded."

**Enforcement in this Bible:**
- Before Step 6 (starting container), verify ONLY one copy of the plugin exists in the snap directory.
- If multiple `dist/index.js` versions exist → the test is invalid. Old hooks from stale versions will fire alongside new ones.
- Clean snapshot every time: `rm -rf "$SNAP"` (Step 2) ensures no version pollution.

### Rule E6: Agents Do NOT Self-Declare Completion

**CSB Rule 9 Refraction:** "Agents do not declare their own work complete — external verification required."

**Enforcement in this Bible:**
- An agent CANNOT say "Container test passed, I'm done."
- An agent CAN say: "Container test executed. Evidence files on disk at /path/to/ContainerTestResult.json show overallPassed: true. TUI interaction captured. Next: adversarial pressure test or gate advancement."
- The evidence files are the external verifier. The agent is a REPORTER, not a DECLARER.
- Gate advancement (TEST → VERIFY) requires ALL three evidence files to be produced by mechanical means, not agent testimony.

### Rule E7: Bundle ≠ Runtime — Bundle Check ≠ Test

**CSB Embedded Refraction:** "'I verified the bundle' is NOT TESTING."

**Enforcement in this Bible:**
- The System Check (Step 0) is labeled FORBIDDEN as a substitute for container testing.
- The Fractal Rule (System Check §) provides a 4-step detect/classify/block/escalate protocol for when agents try to pass off a bundle check as testing.
- Any agent claiming "the module imports correctly, therefore it works" → direct to the "Why This Cannot Replace Container Testing" table.

### Rule E8: Clone Before Edit — Never Destroy Source

**KRAKEN LAW Refraction:** "NEVER directly edit or overwrite reference/source files."

**Enforcement in this Bible:**
- The snap directory (`/tmp/snap-${PROJECT}`) is the isolation mechanism. Never mount host configs directly.
- If opencode.json needs modification → edit the copy in `$SNAP/opencode.json`, not the host's `~/.config/opencode/opencode.json`.
- Anti-pattern: `-v ~/.config/opencode:/root/.config/opencode` is EXPLICITLY listed as a CRITICAL ANTI-PATTERN.

### Rule E9: Container Image Version — Match, Don't Assume

**CSB Container Mismatch Refraction:** The image tag `opencode-test:1.14.34` is the verified working version. If this ever changes, update it in this document and rebuild.

**If the container image doesn't exist or is outdated:**
```bash
# Check available images
docker images | grep opencode-test

# If none exist, build from workspace Dockerfile
docker build -t opencode-test:1.14.34 -f /path/to/Dockerfile .

# Verify the image has the baseline binary
docker run --rm opencode-test:1.14.34 ls /usr/local/lib/node_modules/opencode-ai/node_modules/opencode-linux-x64-baseline/bin/opencode
```

---

## Failure Recovery Flow — When The 12-Step Protocol Breaks

The 12-step protocol assumes everything works. Reality: it doesn't. This section is the fractal embedding of the FAILURES-BIBLE's debugging patterns into the TUI testing workflow.

### Step Failure Diagnosis Matrix

| Step Fails At | Symptom | Root Cause | Fix | See Also |
|---|---|---|---|---|
| Step 3 | `cp: cannot stat 'dist/index.js'` | Plugin not built or wrong path | Run `bun run build` first. Verify dist/index.js exists with `ls -la`. | RG §3.2 |
| Step 6 | `Error: No such image: opencode-test:1.14.34` | Image not pulled | `docker pull opencode-test:1.14.34` or build locally. | §E9 above |
| Step 6 | Container starts then immediately exits | `evince` entrypoint interference | MUST use `--entrypoint ""`. Verify the full command. | Anti-Patterns table |
| Step 7 | Container not running after 28s | DB migration failed, crash on boot | `docker logs "$CONTAINER"`. Look for: exec format error (musl binary), ProviderModelNotFoundError (bad model), permission denied (snap mount). | Adversarial §5 |
| Step 7 | Container runs but opencode not reachable | Entrypoint didn't start opencode | Verify the `/bin/sh -c 'opencode ...'` command in Step 6. Check `docker exec "$CONTAINER" ps aux`. | Anti-Patterns: `sleep 3600` BEFORE opencode |
| Step 8 | `grep "model"` returns nothing | opencode.json not copied or wrong format | `docker exec "$CONTAINER" cat /root/.config/opencode/opencode.json`. Verify the snap mount worked. | RG §8 |
| Step 9 | tmux session starts but crashes | docker exec -it requires TTY allocation | Verify `-it` flag on docker exec. Verify container is still running: `docker ps`. | Hallucinated Barrier #1 |
| Step 9 | tmux capture-pane empty | opencode TUI not fully loaded yet | Increase sleep from 8 to 15. Check `docker exec "$CONTAINER" pgrep -f opencode`. | Step 7 (DB migration may need more time) |
| Step 10 | Escape doesn't dismiss dialog | Update dialog timing changed | Try Enter instead of Escape. Increase sleep from 2 to 5. | Hallucinated Barrier #4 |
| Step 11 | `who are you` returns generic "opencode" response | Identity hook not firing, agent not configured | Check `docker exec "$CONTAINER" cat /root/.config/opencode/opencode.json \| grep agent`. Verify plugin loaded: `docker exec "$CONTAINER" ls /root/.config/opencode/plugins/`. | Adversarial §6 |
| Step 11 | capture-pane output is truncated | opencode TUI uses ANSI codes that `strings` strips too aggressively | Remove the `strings` filter: `tmux capture-pane -t "$CONTAINER" -p \| head -80`. Look for raw output. | TUI protocol |

### Three-Strike Recovery Protocol

```
Strike 1: Diagnose with docker logs + docker exec
  → Check container logs, verify config, check process list
  → Fix the specific error, retry from Step 5

Strike 2: Full teardown + rebuild
  → docker kill; tmux kill; rm -rf $SNAP
  → Rebuild plugin: bun run build
  → Verify dist/index.js exists AND has non-zero size
  → Retry from Step 1

Strike 3: Escalate — NEVER theatrical-code
  → Report exact failure with docker logs + command output
  → Do NOT fabricate a passing test
  → Do NOT switch to opencode run as a "substitute"
  → Wait for human intervention
```

### API Key Expiry Recovery

When the model returns "ProviderModelNotFoundError" or "401 Unauthorized":
```bash
# Verify the key is still valid
docker exec "$CONTAINER" curl -s -H "Authorization: Bearer tp-ssy5nlzfc5vccack4ccierszbs0fojjp0lp3uj37hlp328ci" \
  "https://token-plan-sgp.xiaomimimo.com/v1/models" | head -5

# If key is expired → update in THIS DOCUMENT and retry
# The key lives at TWO locations:
# 1. This section (open in editor)
# 2. Step 4 of the 12-step protocol
# Update BOTH. Rebuild snap. Retry from Step 1.
```

---

## FRACTAL PRINCIPLES EMBEDDED IN THIS DOCUMENT

Every principle from the Runtime Grade Engineering Bible is embedded in the sections below. When you run a container TUI test, you are verifying:

| Runtime Grade Principle | Where It Is Tested In This Protocol |
|---|---|
| **P1 — Defensive Import** | Step 8 (verify config), Step 11 (verify hooks fire in TUI) |
| **P2 — Type Certainty** | Step 11 (verify agent identity, tool descriptions, model name) |
| **P3 — Error Path Completeness** | Anti-Patterns table (every anti-pattern is a documented error path) |
| **P4 — Resource Lifecycle** | Step 5 (cleanup old), Step 12 (cleanup container/tmux/snap) |
| **P5 — Atomic State** | Step 7 (verify container is running before proceeding) |
| **P6 — Dependency Verification** | Step 8 (verify model resolves), Step 7 (verify binary exists) |
| **P7 — Path Resolution** | Step 3 (plugin bundle path), Step 6 (binary path), Snap (isolated path) |
| **P8 — Configuration Validation** | Step 4 (opencode.json structure), Step 8 (grep-model) |
| **P9 — Async Discipline** | Step 9-11 (sequential awaits with sleep between each) |
| **P10 — Output Contract** | Verification Checklist (every assertion is an output contract) |

---

## Hallucinated Barriers (ALL FALSE)

| # | Model Claim | Reality |
|---|---|---|
| 1 | "I can't run TUI, it requires interactive terminal" | **tmux + docker exec -it works.** |
| 2 | "I can only test with opencode run" | **opencode run DOES NOT FIRE HOOKS. BANNED.** |
| 3 | "The hooks only fire in local TUI, not container TUI" | **Container TUI fires ALL hooks.** |
| 4 | "I need xdotool/x11/display" | **tmux is terminal-native. No display needed.** |
| 5 | "I verified the bundle, that's good enough" | **Bundle verification is NOT testing.** |
| 6 | "opencode run showed the agent works, so it's fine" | **opencode run NEVER fires hooks. You tested nothing.** |
| 7 | "I'll verify by checking the source code" | **Source ≠ execution.** |
| 8 | "Let me just grep the dist to verify the fix" | **grep shows file contents, NOT what OpenCode loads at runtime.** |

---

## CRITICAL ANTI-PATTERNS (DO NOT USE)

| Anti-Pattern | Why It Fails | Correct |
|---|---|---|
| `docker attach` | Connects to sleep process TTY, not opencode TTY. ZERO output. | `docker exec -it` |
| `/usr/local/bin/opencode` | npm wrapper auto-selects **musl** binary on glibc systems. Silently crashes with "exec format error". | Use **baseline** binary directly |
| `-v ~/.config/opencode:/root/.config/opencode` | Conflicts with running host opencode. Config file locked. | Create isolated `/tmp/snap-{project}-{timestamp}` directory |
| Model inside `provider` block | Gets IGNORED by opencode 1.14.x. Falls back to wrong model, no API key. | `"model": "provider/model-name"` at TOP LEVEL of opencode.json |
| `tools` as ARRAY `["tool-a", "tool-b"]` | Tools won't register. Must be OBJECT. | `"tools": {"tool-a": true, "tool-b": true}` |
| Musl binary path (`opencode-linux-x64-musl`) | Missing `/lib/ld-musl-x86_64.so.1` linker on glibc containers. Crash. | `opencode-linux-x64-baseline` |
| Image tag `opencode-test:1.14.41` | Does not exist. Model hallucination. | `opencode-test:1.14.34` |
| `sleep 3600` BEFORE opencode | opencode never starts, container just sleeps forever. | `/bin/sh -c 'opencode --agent AGENT 2>&1; sleep 3600'` with `--entrypoint ""` |

### Runtime Grade Anti-Pattern Cross-Reference

Each anti-pattern above corresponds to a Runtime Grade Engineering Bible violation:

| Anti-Pattern | Violates | Runtime Grade § |
|---|---|---|
| `docker attach` | **P6** (Dependency Verification — wrong tool) | §5.1 Silent Catch |
| `-v ~/.config/opencode` | **P7** (Path Resolution — hardcoded host path) | §10.1 Hardcoded Home |
| Model inside provider block | **P8** (Configuration Validation — invalid placement) | §9.1 Undefined Env Var |
| tools as ARRAY | **P2** (Type Certainty — wrong type) | §6.1 Unchecked Cast |
| Musl binary path | **P7** (Path Resolution — wrong binary for platform) | §10.3 Platform Path |
| `sleep 3600` BEFORE opencode | **P4** (Resource Lifecycle — process never starts) | §7.2 |

---

## The Working Protocol (12 Steps)

This protocol creates a **Runtime Grade** container test environment — isolated, reproducible, self-cleaning. Every step verifies a Runtime Grade principle.

```bash
# === STEP 1: DEFINE VARS ===
PROJECT="myproject-$(date +%m%d%H%M%S)"
SNAP="/tmp/snap-${PROJECT}"
PLUGIN_NAME="my-plugin"
AGENT_NAME="myagent"

# === STEP 2: CREATE ISOLATED SNAPSHOT ===
rm -rf "$SNAP"
mkdir -p "$SNAP/plugins/${PLUGIN_NAME}/dist"

# === STEP 3: COPY ALL PLUGIN BUNDLES (===)
# Deploy EVERY plugin from the live config, not just the one under test.
# The live config at /home/leviathan/.config/opencode/opencode.json has all plugins listed.
# If 8 plugins are in the live config, the container MUST have all 8.
ACTIVE_CONFIG="/home/leviathan/.config/opencode/opencode.json"
for plugin_path in $(grep '"file://' "$ACTIVE_CONFIG" | sed 's|.*file://||;s|".*||'); do
  plugin_name=$(basename "$(dirname "$plugin_path")")
  mkdir -p "$SNAP/plugins/$plugin_name/dist"
  cp "$plugin_path" "$SNAP/plugins/$plugin_name/dist/index.js"
  echo "DEPLOYED: $plugin_name"
done

# === STEP 4: CLONE THE LIVE RUNTIME CONFIG (CRITICAL — FRESH EVERY TEST) ===
# DO NOT hand-craft an opencode.json. The live runtime config at
# /home/leviathan/.config/opencode/opencode.json is the ONLY valid source.
# Hand-crafted configs caused Trident v4.2.1: 8/8 pass in container, 0/8 in production.
# The live config changes frequently — plugins added/removed, providers swapped.
# Every container test = fresh copy of the live file. Always. No exceptions.
ACTIVE_CONFIG="/home/leviathan/.config/opencode/opencode.json"
cp "$ACTIVE_CONFIG" "$SNAP/opencode.json"
# Modify ONLY the plugin paths to point to the snap directory
sed -i 's|/home/leviathan/.config/opencode/plugins/|/root/.config/opencode/plugins/|g' "$SNAP/opencode.json"
# Deploy ALL plugins from the live config, not just the one under test
for plugin_path in $(grep '"file://' "$ACTIVE_CONFIG" | sed 's|.*file://||;s|".*||'); do
  plugin_name=$(basename "$(dirname "$plugin_path")")
  mkdir -p "$SNAP/plugins/$plugin_name/dist"
  cp "$plugin_path" "$SNAP/plugins/$plugin_name/dist/index.js"
done

# WHAT NOT TO DO (Trident v4.2.1 FAILURE PATTERN):
# DO NOT create a hand-crafted opencode.json:
#   cat > "$SNAP/opencode.json" << EOF
#   { "model": "mimo-v2.5-pro", "plugin": ["file:///root/.../dist/index.js"], ... }
#   EOF
# DO NOT reuse a stale snapshot:
#   cp /tmp/snap-old-test/opencode.json "$SNAP/opencode.json"
# The live config is the ONLY valid source. It's always current. There is no snapshot to go stale.

# === STEP 5: CLEANUP OLD ===
CONTAINER="test-${PROJECT}"
tmux kill-session -t "$CONTAINER" 2>/dev/null || true
docker rm -f "$CONTAINER" 2>/dev/null || true

# === STEP 6: START CONTAINER (opencode at boot) ===
docker run -d --rm --name "$CONTAINER" \
  --entrypoint "" \
  -v "$SNAP:/root/.config/opencode" \
  opencode-test:1.14.34 \
  /bin/sh -c '/usr/local/lib/node_modules/opencode-ai/node_modules/opencode-linux-x64-baseline/bin/opencode --agent '"${AGENT_NAME}"' 2>&1; sleep 3600'

# === STEP 7: WAIT FOR DB MIGRATION ===
sleep 28
docker ps | grep "$CONTAINER" || { echo "Container died!"; docker logs "$CONTAINER"; exit 1; }

# === STEP 8: VERIFY CONFIG IS A CLONE ===
echo "=== Container config (must match live config exactly) ==="
docker exec "$CONTAINER" cat /root/.config/opencode/opencode.json

echo "=== Plugin count (must match live deployment) ==="
docker exec "$CONTAINER" ls /root/.config/opencode/plugins/

echo "=== Config fidelity check ==="
LIVE_PLUGIN_COUNT=$(grep -c '"file://' "$ACTIVE_CONFIG")
CONTAINER_PLUGIN_COUNT=$(docker exec "$CONTAINER" grep -c 'file://' /root/.config/opencode/opencode.json 2>/dev/null)
if [ "$LIVE_PLUGIN_COUNT" != "$CONTAINER_PLUGIN_COUNT" ]; then
  echo "FAIL: Plugin count mismatch. Live: $LIVE_PLUGIN_COUNT, Container: $CONTAINER_PLUGIN_COUNT"
  echo "Container test is INVALID — not testing the real deployment."
  exit 1
fi

# === STEP 9: START TUI via docker exec -it in tmux ===
tmux new-session -d -s "$CONTAINER" \
  "docker exec -it $CONTAINER /usr/local/lib/node_modules/opencode-ai/node_modules/opencode-linux-x64-baseline/bin/opencode --agent '${AGENT_NAME}' 2>&1; sleep 60"
sleep 8

# === STEP 10: DISMISS UPDATE DIALOG ===
tmux send-keys -t "$CONTAINER" Escape
sleep 2

# === STEP 11: SEND TEST MESSAGE ===
tmux send-keys -t "$CONTAINER" "who are you" Enter
sleep 25
tmux capture-pane -t "$CONTAINER" -p | strings | grep -vE '^\[' | grep -vE '^\s*$' | head -40

# === STEP 12: CLEANUP ===
docker kill "$CONTAINER"; tmux kill-session -t "$CONTAINER" 2>/dev/null; rm -rf "$SNAP"
```

---

## Verification Checklist

After capture-pane output, verify:
- [ ] Agent responds with correct identity (not "opencode")
- [ ] Status bar shows correct model (MiMo-V2.5-Pro Xiaomi Token Plan)
- [ ] Plugin hook messages appear in logs (e.g. "[SubAgentManager][INFO]")
- [ ] No "ProviderModelNotFoundError"
- [ ] No "exec format error" (means musl binary was used — WRONG)
- [ ] Tool descriptions appear correctly in available tools list

### Post-Protocol Config Audit (CRITICAL — NEW)

After the 12-step protocol, BEFORE declaring any build complete:

```bash
# 1. Verify NO wildcard permissions in deployment config
docker exec "$CONTAINER" cat /root/.config/opencode/opencode.json | grep -E '"\*".*"\*"' && \
  echo "⚠️ WILDCARD PERMISSION DETECTED — every tool on system is available" || \
  echo "✅ No wildcard permissions"

# 2. Verify ONLY whitelisted tools are visible to the agent
docker exec "$CONTAINER" /usr/local/lib/node_modules/opencode-ai/node_modules/opencode-linux-x64-baseline/bin/opencode run \
  --agent "${AGENT_NAME}" --print-logs "list tools" 2>&1 | grep -iE '(manta|shark|kraken|trident|hydra)' && \
  echo "⚠️ FOREIGN TOOLS VISIBLE — tool isolation broken" || \
  echo "✅ No foreign tools visible"

# 3. Verify test config != deployment config (diff them)
diff <(cat config.test.json 2>/dev/null) <(cat config.deploy.json 2>/dev/null) && \
  echo "⚠️ TEST AND DEPLOYMENT CONFIGS ARE IDENTICAL — test overrides will ship" || \
  echo "✅ Configs differ (expected for test-specific settings)"
```

### Negative Testing Checklist (NEW)

Standard positive testing proves things work when they should. Negative testing proves things DON'T work when they shouldn't. Both are mandatory.

- [ ] **NEGATIVE**: Every non-whitelisted tool verified BLOCKED for your agent
- [ ] **NEGATIVE**: Aggregation with 0 items returns failure, not success
- [ ] **NEGATIVE**: Null/missing inputs to all hooks don't crash
- [ ] **NEGATIVE**: Empty data doesn't produce false consensus
- [ ] **NEGATIVE**: Other agents' tools not visible in your agent's tool list

---

## Additional Verification: `opencode run --print-logs`

`opencode run` IS valid for checking **plugin loading and tool registration**, but NOT for hook verification.

```bash
# Verify plugin loads and tools are registered (NOT hook testing)
docker exec "$CONTAINER" /usr/local/lib/node_modules/opencode-ai/node_modules/opencode-linux-x64-baseline/bin/opencode run \
  --agent "${AGENT_NAME}" --print-logs "call tool-name" 2>&1 | head -60
```

This tells you:
- Plugin loaded without errors
- Tool names appear in tool list
- Model resolves correctly

It does NOT tell you whether hooks fire at runtime. Only the tmux TUI test tells you that.

---

## System Check: Module Surface Area Verification (STEP 0 — NOT Container Testing)

### ⚠️ FORBIDDEN: Substituting This For Container Testing

**THIS IS A SYSTEM CHECK, NOT A TEST.** It verifies the plugin module loads correctly so that container testing can begin. It is NOT a substitute for container TUI testing, `opencode run` verification, or adversarial pressure testing.

**Violating this rule is a P1 — Runtime Grade Engineering Bible §12.4 (Verification Theater).**

### Purpose

This check runs BEFORE the 12-step container protocol. It verifies:
1. The plugin bundle imports without errors
2. The export surface area (tools, hooks, agent config) matches expectations
3. The config hook creates the correct agent entry

If this check fails, there is no point in starting a container — the plugin won't load.

### How To Use This In The Container Testing Workflow

```bash
# 1. Build the plugin
cd /path/to/plugin
bun run build

# 2. Run system check (THIS STEP)
bun -e "
const m = await import('/path/to/plugin/dist/index.js');
const hooks = await m.default({directory:'/tmp'});
console.log('Tools:', Object.keys(hooks.tool));
console.log('Hooks:', Object.keys(hooks).filter(k => !['tool','config'].includes(k)));
const cfg = {agent:{}};
await hooks.config(cfg);
console.log('Agents:', Object.keys(cfg.agent));
"

# 3. If system check PASSES → proceed to container testing (Steps 1-12 above)
# 4. If system check FAILS → fix the module export, rebuild, re-check
```

### Integration With Adversarial Pressure Testing Framework Phase 1

This system check corresponds to **Adversarial Pressure Testing Framework Phase 1: Compilation & Module Load** (TC-1.1 through TC-1.5). It is the minimal gate before deploying to a container.

**Phase 1 of the Adversarial Framework adds:**
- TC-1.1: TypeScript compilation (zero errors)
- TC-1.2: Module import loads (hooks is object, not null)
- TC-1.3: All expected hooks registered
- TC-1.4: All expected tools registered
- TC-1.5: Config hook creates agent entry

These are EXACTLY what the system check above verifies. Run the full Phase 1 test script from the Adversarial Framework for detailed assertions.

### Why This Cannot Replace Container Testing

| What the System Check Verifies | What It Does NOT Verify |
|---|---|
| Module imports without error | Hooks fire in the OpenCode TUI runtime |
| Tools are registered in the bundle | Tools appear in the agent's tool list in TUI |
| Hooks are exported with correct names | Hook logic executes during chat.message |
| Config hook creates agent entry | Agent appears in tab toggle |
| Export surface area matches expectations | Model resolves with correct API key |
| Bundle compiles to valid ESM | Binary path is correct (baseline vs musl) |
| Plugin factory returns Hooks object | All anti-patterns (docker attach, etc.) are avoided |

### The Runtime Grade Principle

From **Runtime Grade Engineering Bible §1.2**:
> Does the code work when executed in a real runtime environment?

The system check runs in Bun on the host, not in the Docker container, not under OpenCode's plugin loader, and not with the LLM. It proves the module LOADS — it does not prove the module WORKS.

From **Runtime Grade Engineering Bible §16.1**:
> `opencode run` is BANNED — hooks never fire
> Only valid test: TUI via tmux + docker exec -it
> Static analysis of dist files is NOT testing
> Every test must produce mechanical evidence

The system check is NOT a test. It is a **readiness gate** — a prerequisite for container testing, not a replacement.

### The Fractal Rule

When an agent proposes using only the system check and skipping the container:
1. **Detect:** The agent says "I verified the bundle loads" or "the module imports correctly"
2. **Classify:** This is **Runtime Grade Engineering Bible §12.5 Verification Theater** — "Counting proves nothing about correctness"
3. **Block:** The agent MUST complete the full 12-step container protocol AND the Adversarial Pressure Testing Framework Phase 2-5 before declaring any test complete
4. **Escalate:** If the agent resists, escalate to the Runtime Grade Engineering Bible §16 (Container Test Standard) as the binding authority

---

## Runtime Verification: `docker exec` Node.js Hook Testing

For testing hook logic and tool execution inside the container (without TUI), deploy the bundle and call hooks directly via Node.js ESM import inside the Docker container.

This is the **Tier 3** method from the Adversarial Pressure Testing Framework §1:

```dockerfile
# Deploy plugin to container
docker cp dist/index.js "$CONTAINER:/root/.config/opencode/plugins/${PLUGIN_NAME}/dist/"

# Test hooks directly via Node.js
docker exec "$CONTAINER" node --input-type=module -e '
import("/root/.config/opencode/plugins/${PLUGIN_NAME}/dist/index.js").then(async (mod) => {
  const hooks = await mod.default({directory:"/tmp"});
  
  // Verify hook signatures
  console.log("=== HOOK SURFACE ===");
  console.log("tool.execute.before:", typeof hooks["tool.execute.before"]);
  console.log("chat.message:", typeof hooks["chat.message"]);
  console.log("system.transform:", typeof hooks["experimental.chat.system.transform"]);
  
  // Test identity scoping (Adversarial Framework Phase 2)
  let out = {};
  await hooks["chat.message"]({ 
    message: { content: "who are you" },
    session: { agentName: "'${AGENT_NAME}'", sessionID: "test" }
  }, out);
  console.log("Identity response:", out.content?.substring(0, 100));
  
  // Test tool blocking (Adversarial Framework Phase 4)
  try {
    await hooks["tool.execute.before"]({ 
      tool: "edit", 
      session: { agentName: "'${AGENT_NAME}'" }
    });
    console.log("Edit tool: NOT BLOCKED (fail)");
  } catch (e) {
    console.log("Edit tool: BLOCKED (pass)");
  }
  
  // System transform test
  let sys = { system: [] };
  await hooks["experimental.chat.system.transform"]({ agent: "'${AGENT_NAME}'" }, sys);
  console.log("System transform:", sys.system?.some(s => s.includes("'"${AGENT_NAME}"'.toUpperCase()'")));
}).catch(e => console.error("FATAL:", e.message, e.stack));
'
```

This uses the EXACT same import path, ESM module loader, plugin factory invocation, and hook signature that OpenCode 1.14.x uses internally. The only difference is the LLM is not called — but hooks don't depend on the LLM.

**Limitations:**
- Does NOT verify the model resolves with the API key
- Does NOT verify the TUI displays correctly
- Does NOT verify agent tab toggle works
- Does NOT verify update dialogs or other TUI-specific behaviors

These require the full TUI protocol (Steps 9-11).

---

## Creating The Runtime Environment For Adversarial Pressure Testing

The container created in Steps 6-7 is the **Runtime Environment** that the Adversarial Pressure Testing Framework requires. The 5-phase adversarial protocol runs against this environment.

### Environment Requirements (Adversarial Framework §3)

| Requirement | How The 12-Step Protocol Satisfies It |
|---|---|
| Docker container with Node.js 20+ | `opencode-test:1.14.34` image (Step 6) |
| Plugin dist/ deployed to container | Snap mount at `/root/.config/opencode/plugins/` (Steps 2-3) |
| opencode.json with plugin path | Created at `$SNAP/opencode.json` (Step 4) |
| Permission block: `{"*": {"*": "allow"}}` | Included in opencode.json (Step 4) |
| Isolated config (not host mount) | Snap directory `/tmp/snap-${PROJECT}` (Step 2) |

### Post-Protocol Adversarial Testing

After the 12-step protocol completes and TUI is verified (Steps 9-11), you have a running container with the plugin deployed. At this point, run the Adversarial Pressure Testing Framework's phases:

```bash
# Phase 1-5 via Node.js import in container
docker exec "$CONTAINER" node --input-type=module < /path/to/test-adversarial.js

# Phase 3: Full TUI mode progression
tmux send-keys -t "$CONTAINER" "debug this bug" Enter
sleep 15
tmux capture-pane -t "$CONTAINER" -p | grep -i "problem solving\|layer\|continue" | head -20

# Cross-agent identity test
tmux send-keys -t "$CONTAINER" "reset" Enter
sleep 5
# (Start a second tmux session with a different agent if needed)
```

### Evidence Collection For Runtime Grade Gates

The Runtime Grade Engineering Bible §16.2 requires three evidence files for TEST → VERIFY transition:

| Evidence File | How To Generate |
|---|---|
| `ContainerSpawnResult.json` | `{"success": true}` — Step 7 output (docker ps confirms container running) |
| `ContainerTestResult.json` | `{"overallPassed": true}` — Adversarial Framework test script exit code 0 |
| `TuiInteraction.json` | `{"identityResponded": true, "toolsCalled": true}` — Step 11 capture-pane output |

```bash
# Generate evidence files
echo '{"success":true}' > ContainerSpawnResult.json
docker exec "$CONTAINER" node --input-type=module < test-adversarial.js && \
  echo '{"overallPassed":true}' > ContainerTestResult.json || \
  echo '{"overallPassed":false}' > ContainerTestResult.json

# Capture TUI interaction evidence
tmux capture-pane -t "$CONTAINER" -p > TuiInteraction.json
```

---

## Verification Checklist (Expanded With Runtime Grade Gates)

After capture-pane output, verify:
- [ ] Agent responds with correct identity (not "opencode")
- [ ] Status bar shows correct model (MiMo-V2.5-Pro Xiaomi Token Plan)
- [ ] Plugin hook messages appear in logs (e.g. "[SubAgentManager][INFO]")
- [ ] No "ProviderModelNotFoundError" — **P8: Configuration Validation**
- [ ] No "exec format error" (means musl binary was used — WRONG) — **P7: Path Resolution**
- [ ] Tool descriptions appear correctly in available tools list — **P10: Output Contract**

### Config Audit Gates (NEW — Spider v2.2 Post-Mortem)

- [ ] **No wildcard permissions**: `{"*": {"*": "allow"}}` NOT present in deployment config
- [ ] **Tool isolation**: Only whitelisted tools visible in agent's tool list — no manta/shark/kraken/trident/hydra tools leaking
- [ ] **Negative testing**: Every non-whitelisted tool verified BLOCKED via tool.execute.before
- [ ] **Test/deployment config separated**: test config overrides NOT in deployment config

### Adversarial Framework Phase 2-6 Gates

- [ ] **Phase 2 (Identity Scoping):** Non-plugin agents do NOT receive identity injection
- [ ] **Phase 3 (Mode Validation):** All modes activate through full layer progression
- [ ] **Phase 4 (Firewall):** Banned tools blocked, read tools allowed, cross-agent isolation clean, negative testing complete
- [ ] **Phase 5 (Theatrical Audit):** No function returns stubs, all output > 200 chars
- [ ] **Phase 6 (Full Lifecycle):** construct → disperse → actual spawn → aggregate with real data → dissolve — all produce real side effects

### Runtime Grade §16.3-16.5 Standards

- [ ] 90% minimum pass rate on adversarial test suite
- [ ] 100% is the target for first-build
- [ ] If first build doesn't pass 90%+, engineering was insufficient (RG §16.3)
- [ ] Negative testing complete — empty states, unauthorized tools, null inputs all verified (RG §16.5)
- [ ] Test config != deployment config — diff confirms no overrides leaked (RG §16.4)

---

## Fractal Reference Index

When reading any one of the three bibles, use this cross-reference to find the corresponding section in the other two:

| Concept | T2_TUI_TESTING_BIBLE | Runtime Grade Bible | Adversarial Framework |
|---|---|---|---|---|
| Module surface check | System Check § | §3.2 Module-Level Build Order | §5 Phase 1 (TC-1.1 — TC-1.5) |
| Identity scoping | Step 11 (who are you) | §2 P2 Type Certainty | §6 Phase 2 (TC-2.1 — TC-2.9) |
| Mode progression | Verification Checklist | §4.3 Runtime Operational Check | §7 Phase 3 (TC-3.1 — TC-3.9) |
| Firewall enforcement | Anti-Patterns table | §2 P6 Dependency Verification | §8 Phase 4 (TC-4.1 — TC-4.5) |
| Theatrical audit | Runtime Verification § | §12 Theatrical Anti-Patterns | §9 Phase 5 (TC-5.1 — TC-5.5) |
| Tool isolation | Config Audit § (NEW) | §12.6 Wildcard Permission | TC-4.6 Negative Testing (NEW) |
| Empty state consensus | Negative Testing Checklist (NEW) | §12.8 Empty Set Consensus | TC-4.8 Empty State (NEW) |
| Theatrical orchestration | Post-Protocol Adversarial Testing § | §12.7 Theatrical Orchestration | §10 Phase 6 Lifecycle (NEW) |
| Full lifecycle | Negative Testing Checklist (NEW) | §20 Case Study 2-3 | §10 Phase 6 (TC-6.1 — TC-6.4) (NEW) |
| Config audit | Post-Protocol Config Audit (NEW) | §16.4 Test vs Deploy Config | TC-4.7 Config Isolation (NEW) |
| Container environment | Steps 1-8 | §16 Container Test Standard | §3 Test Architecture |
| Evidence files | Evidence Collection § | §16.2 Evidence Files | §11 Test Template |
| Error handling | Anti-Patterns: Why It Fails | §5 Error Handling Anti-Patterns | §12 Bug Taxonomy |
| Configuration | Step 4: opencode.json | §9 Config Anti-Patterns | §3 Prerequisites |
| Resource cleanup | Step 5, Step 12 | §7 Resource Anti-Patterns | §3 Test Env Requirements |

---

## Summary: The Fractal Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    RUNTIME GRADE ENGINEERING                         │
│  "Code works when executed in a real runtime environment"           │
│  P1-P10 principles embedded in every function                       │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ requires
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    T2_TUI_TESTING_BIBLE                               │
│  1. System Check (module surface, NOT testing)                      │
│  2. 12-Step Container Protocol (create Runtime Environment)         │
│  3. TUI Verification (agent identity, hooks, model)                 │
│  4. Evidence Collection (Runtime Grade §16.2)                       │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ stress-tests the runtime with
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    ADVERSARIAL PRESSURE TESTING FRAMEWORK            │
│  Phase 1: Compilation & Module Load  ── TC-1.1 to TC-1.5           │
│  Phase 2: Identity Scoping & Isolation ── TC-2.1 to TC-2.9         │
│  Phase 3: Mode-Specific Validation ── TC-3.1 to TC-3.9             │
│  Phase 4: Firewall Enforcement ── TC-4.1 to TC-4.5                 │
│  Phase 5: Theatrical Element Audit ── TC-5.1 to TC-5.5             │
│  35/35 tests passing, zero theatrical elements                      │
└─────────────────────────────────────────────────────────────────────┘
```

**The three bibles are dimensionally superimposed.** The Runtime Grade Bible defines WHAT must be true. The TUI Testing Bible defines HOW to verify it. The Adversarial Framework defines the STRESS TEST that probes every edge case. Each contains the fingerprint of the other two. Reading any one gives you awareness of the whole system.

*T2_TUI_TESTING_BIBLE v1.14.x — Fractal integration with RUNTIME_GRADE_ENGINEERING_BIBLE.md (v1.0) and TESTING_FRAMEWORK_ADVERSARIAL_PRESSURE.md (v1.0.0)*
