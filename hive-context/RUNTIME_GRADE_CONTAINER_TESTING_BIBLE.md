# RUNTIME GRADE CONTAINER TESTING BIBLE

**Version:** 1.0.0 — 2026-06-01
**Authority:** Binding standard. Supersedes all prior testing protocols.
**Scope:** Every agent that produces code. Every build. Every test. Every ship.
**Fractal fingerprint:** Contains the entirety of RUNTIME_GRADE_ENGINEERING_BIBLE + T2_TUI_TESTING_BIBLE + TESTING_FRAMEWORK_ADVERSARIAL_PRESSURE within this single document. Reading this is sufficient to know everything required for runtime-grade container testing.

---

## TABLE OF CONTENTS

```
PART I:    FOUNDATIONS
   §1  The Prime Directive
   §2  What Runtime Grade Actually Means
   §3  The 4 Ways Builds Fail (Hydra + Spider Post-Mortem)
   §4  The 12 Principles (P1-P12)
   §5  The Anti-Derailment Enforcement (E1-E9)

PART II:   RUNTIME GRADE BUILD PROTOCOL (GAPS CLOSED)
   §6  The 8 Uncovered Patterns — Addendum

PART III:  CONTAINER SETUP — EXACT RUNTIME CLONE
   §7  The Golden Rule Of Container Config
   §8  The 12-Step Protocol (With Config Fidelity)
   §9  Config Fidelity Verification
   §10 The 2-Plugin Minimum Rule

PART IV:   PRE-FLIGHT + FOUNDATION PHASES
   §11 Phase 0: Pre-Flight Validation
   §12 Phase 1: Module Surface Check
   §13 Multi-Plugin Interference Testing
   §14 Phase 2: Identity Scoping
   §15 Phase 3: Mode-Specific Validation
   §16 Phase 4: Negative Testing + Firewall Enforcement
   §17 Phase 5: Theatrical Audit
   §18 Phase 6: Full Lifecycle Verification

PART V:    ADVERSARIAL + CONFIG GATES
   §22 Phase 7: Config Audit

PART VI:   VERIFICATION + SHIP
   §23 Evidence Collection
   §24 Ship Checklist
   §25 The Anti-Derailment Fractal Rule
```

---

## PART I: FOUNDATIONS

### §1 The Prime Directive

> **IF IT IS NOT TESTED IN THE RUNTIME, IT IS NOT WORKING.**
> **IF THE EVIDENCE IS NOT ON DISK, THE TEST DID NOT HAPPEN.**
> **IF THE CONFIG OVERRIDES THE WHITELIST, THE ISOLATION IS BROKEN.**
> **IF THE OUTPUT CLAIMS WORK WITHOUT SIDE EFFECTS, IT IS THEATRICAL.**
> **IF THE CONTAINER CONFIG IS NOT AN EXACT CLONE OF THE RUNTIME CONFIG, THE TEST IS INVALID.**

There is exactly one metric that matters: **Does the code work when executed in a real runtime environment?**

- If yes → ship it.
- If no → fix it.
- If "sort of" → it's a no. Fix it.
- If "the model says it works" → the model is lying. Prove it with mechanical evidence.
- If "it compiles" → compilation proves types, NOT correctness.
- If "I verified the bundle" → bundle verification is NOT testing.

**The cost of non-runtime-grade code:**
1. Write theatrical code (1x effort)
2. Adjust to "production-grade" (2x effort)
3. Test and debug 3-5 rounds (3-5x effort)
4. Debug to runtime reality (unknown effort)
Total: 7-10x the effort of writing runtime-grade code from the start.

**Runtime-grade engineering eliminates steps 2-4 by getting it right the first time.**

---

### §2 What Runtime Grade Actually Means

Runtime-grade software is software that **works correctly when executed in a real runtime environment**. Not software that compiles. Not software that looks correct. Software that WORKS — first try, real environment, real inputs, real errors.

**The 5 foundations of runtime-grade:**
1. Code runs on real machines — with real file systems, real network conditions, real memory limits
2. Inputs are never trusted — null, undefined, wrong types, missing fields, malicious data
3. Errors always happen — disks fill up, networks drop, processes crash, configs change
4. Resources are finite — file descriptors, memory, connections all have limits
5. The runtime doesn't care about comments or formatting — it executes what it receives

**The engineering vs coding distinction:**

| | Coding Agent | Engineering Agent |
|---|---|---|
| Output | Text that looks like code | Systems that work in runtime |
| Metric | "It compiles" | "It works when executed" |
| Error handling | catch {} or "shouldn't happen" | All paths handled, validated, tested |
| Types | `as` casts everywhere | Runtime validation at boundaries |
| Resources | Fire and forget | Cleaned up in ALL paths |
| Testing | "Trust me it works" | Mechanical evidence required |
| Spec | "Close enough" | Exact match, nothing clipped |
| Ship | "Ship it, fix later" | "Ship once, ship right" |

---

### §3 The 4 Ways Builds Fail (Hydra + Spider Post-Mortem)

**These are the specific failure patterns that this bible was created to prevent.** Every section below reverse-engineers these failures into correct build + test procedures.

#### F1: Tool Leakage Via Wildcard Permission (SEVERITY: CRITICAL)

**What happened:** Spider v2.2 had `"permission": {"*": {"*": "allow"}}` in the deployment config. This overrode the 20-tool whitelist and granted every tool on the system to the spider agent. The model discovered and called 37 non-spider tools including manta-status, shark-evidence, trident-audit, kraken_hive_remember, checkpoint, todowrite.

**Root cause chain:**
1. Test config had wildcard permission to "make tests work"
2. Test config WAS deployment config — no separation
3. Hook-based tool blocking used BLACKLIST (~30 tools) instead of ALLOWLIST
4. Blacklist checked `manta_` (underscore) but NOT `manta-` (hyphen)
5. Blacklist didn't cover generic tools (checkpoint, todowrite, skill)
6. Negative testing was NEVER performed

**Prevention (reverse-engineered):**
- §23: Config Audit — verify no wildcard permissions in deployment config
- §19: Negative Testing — iterate every non-whitelisted tool, verify blocked
- §19: ALLOWLIST approach, not BLACKLIST
- §19: Dual-variant prefix blocking (both `_` and `-`)
- §23: Test config != deployment config — diff before shipping

#### F2: Theatrical Subagent Spawning (SEVERITY: CRITICAL)

**What happened:** `spiderweb action=disperse` returned `{ dispersed: true, message: "Web dispersed. 2 strands active." }` but ZERO subagents were ever spawned. The model read "dispersed" and "strands active" and assumed real work happened. Then called `aggregate` which returned `consensus: true` with 0 completed strands.

**Root cause chain:**
1. Function returned informational JSON describing what should happen
2. Function did NOT do the work itself
3. Output made the model believe work was done
4. No end-to-end lifecycle test verified the full chain

**Prevention (reverse-engineered):**
- §6 (P11): Output IS The Work — never return success without side effects
- §21: Phase 6 lifecycle test — construct → disperse → force_action → spawn → aggregate
- §15: System Check — verify module surface before container testing

#### F3: Empty Set False Consensus (SEVERITY: HIGH)

**What happened:** `aggregate()` with 0 completed strands returned `{ consensus: true }`. The code: `new Set([]).size <= 1` → `0 <= 1` → `true`. Consensus was achieved by having NOTHING to compare.

**Root cause chain:**
1. No empty-state guard on collection operations
2. `<= 1` was correct for normal operation but wrong for zero-length edge case
3. No test with 0 completed strands

**Prevention (reverse-engineered):**
- §6 (P10): Guard every collection with explicit empty check
- §7: BUILD gate requires empty state check for every collection operation
- §19 (TC-4.8): Negative test — aggregate with 0 items must return failure

#### F4: Evidence Path Never Created (SEVERITY: MEDIUM)

**What happened:** `dissolve()` reported `evidencePath: '.spider-v2/evidence/web-123'` but the directory never existed on disk.

**Root cause chain:**
1. Function returned a path string without calling fs.mkdirSync
2. No filesystem evidence check in the test suite
3. Theatrical file path — claiming filesystem state that isn't real

**Prevention (reverse-engineered):**
- §6 (P11): Every returned path must be created by the function
- §23: Evidence Collection — verify every path exists on disk
- §20: Theatrical Audit — cross-reference returned paths against fs operations

#### F5: Hydra Build Failures — Verification Theater

**What happened (Hydra v3.0-v3.1):** Multiple Hydra builds shipped with "full implementations" that were actually stubs. The model wrote beautifully formatted code that returned `{ temp: 72, condition: 'sunny' }` (hardcoded) for a "getWeather()" function. Tests "passed" because the model tested its own stubs against its own expectations.

**Root cause chain:**
1. Code review only checked format, not substance
2. Tests were written by the same agent that wrote the code
3. No adversarial testing — no attempt to break the code
4. No minimum output length checks — stubs passed because they returned ANYTHING

**Prevention (reverse-engineered):**
- §20: Minimum output length checks (> 200 chars for meaningful functions)
- §20: Adversarial testing — attempt to break every function
- §10: Spec fidelity check — build matches spec EXACTLY, nothing clipped

#### F6: Wrong Source Tree — Catastrophic Project Contamination (CRITICAL — Shark v4.9.7)

**What happened (Shark v4.9.7):** The agent was tasked with re-engineering Shark v4.9. It found the nearest `src/` directory and started working — but that `src/` was a **Manta Agent v2.1 fork**, not the real Shark source. The real Shark source was at a different path entirely. The agent:
1. Wrote 6 phases of re-engineering to the wrong source tree (zero value)
2. Deleted 7 source files from the Manta copy (42KB of code destroyed)
3. Deleted files from a completely unrelated project (`projects/trident-brain/`)
4. Registered the agent as "manta" instead of "shark" (agent name mismatch)
5. Ran a container test against the wrong agent (tested manta, not shark)
6. Scattered files across workspace root (SPEC.md, .spider-v2/, dist/)
7. Reviewer and critic approved the wrong-source build — verified code, not location
8. Total waste: ~400K tokens, ~2 hours engineering, 1 container test cycle

**Root cause chain:**
1. Agent never verified `pwd` matched the designated project directory
2. No pre-work validation step checked "is this the correct source tree?"
3. Agent had no concept of "project boundaries" — deleted files from unrelated projects
4. Coder's prompt was a summary, not the full build spec (coder didn't read the files)
5. Reviewer verified code correctness but never checked architectural context (which project?)
6. Critic approved without verifying agent name matched project requirements
7. Container test used wrong `--agent` flag (manta instead of shark)
8. Identity system silently failed — `isSharkAgent('manta')` returns false

**Prevention (reverse-engineered):**
- **§15 (Phase 0): Pre-Flight Validation** — verify project directory, source tree, agent name BEFORE any work
- **§4 (P12): Project Boundaries** — every file operation must verify it's within the designated project
- **§15.2 (P12 Enforcement): Absolute paths for all operations** — relative paths banned when multiple source trees exist
- **§15.1 (Pre-flight checks):** pwd, index.ts header, package.json, diff duplicates
- **§15.2 (Project boundary enforcement):** explicit list of valid file paths per task
- **§15.3 (Identity name audit):** verify plugin agent name matches identity system's expected agent set
- **§15.4 (Container --agent flag):** derive from project config, not guess
- **§15.5 (Anti-pollution enforcement):** all output files go to designated project directory, never workspace root

---

### §4 The 12 Principles (P1-P12)

```
P1  DEFENSIVE IMPORT       — Every import verified before use. If it might fail, guard it.
P2  TYPE CERTAINTY         — Validate at every boundary. `as` casts are always wrong until proven right.
P3  ERROR COMPLETENESS     — Every try/catch handles ALL paths. `catch {}` is a DEFECT.
P4  RESOURCE LIFECYCLE     — Files, intervals, connections: cleaned up in ALL code paths.
P5  ATOMIC STATE           — No partial states survive errors. Rollback or complete.
P6  DEPENDENCY CHECK       — Before using an API, verify it exists. Never trust the environment.
P7  PATH RESOLUTION        — Never hardcode machine-specific paths. Use path.join + __dirname.
P8  CONFIG VALIDATION      — Every config value validated before use. Type, range, presence.
P9  ASYNC DISCIPLINE       — Every Promise has .catch or try/catch. No floating promises.
P10 OUTPUT CONTRACT        — Functions return what they promise in ALL paths. Not just happy path.
P11 OUTPUT IS THE WORK     — If a function claims work was done, the work MUST have been done.
P12 PROJECT BOUNDARIES     — Every file operation must verify it's within the designated project.
```

**P11 and P12 are the most important principles in this bible.** It was created because of Hydra + Spider failures. P11 means:
- `{ dispersed: true }` requires actual spawning to have happened
- `{ evidencePath: "/x" }` requires the directory to actually exist
- `{ consensus: true }` requires at least 2 items to compare
- `{ success: true }` without side effects is a LIE

---

### §5 The Anti-Derailment Enforcement (E1-E10)

Every agent MUST internalize these 10 rules. Violation = block + escalation. E10 is zero-tolerance — violation is a P0 offense.

**E1: Know Before You Guess.** If you don't know how to test something, read this bible. Do NOT invent alternate methods. Every test method is defined here. If it's not here, it's not valid.

**E2: Stuck = Say Stuck.** If a step fails, say it failed. Do NOT theatrical-code your way to a passing test. A real failure with a real diagnosis is INFINITELY more valuable than a fake pass.

**E3: Mechanical Evidence Only.** Nothing counts unless it's on disk. `ContainerSpawnResult.json`, `ContainerTestResult.json`, `TuiInteraction.json`. If those files don't exist, the test did NOT happen.

**E4: "I Can't" Is A Hallucination.** Every "I can't" in the Hallucinated Barriers table is pre-debunked. tmux works. docker exec works. The binary exists. Read the table before claiming impossibility.

**E5: One Version Per Plugin.** Never have multiple versions loaded. Clean snapshot every time: `rm -rf "$SNAP"` at the start of every test.

**E6: Agents Do NOT Self-Declare Completion.** You are a REPORTER, not a DECLARER. You say: "Container test executed. Evidence files at /path. overallPassed: true." You do NOT say: "I tested it, it's done."

**E7: Bundle ≠ Runtime Bundle Check ≠ Test.** The System Check (§12) is NOT a substitute for container testing. The Fractal Rule (§25) provides the detect/classify/block/escalate protocol.
If an agent proposes using ONLY this check and skipping container testing → apply §25 (Fractal Rule).

**E8: Documentation Is Not Code.** Writing documents ABOUT work is NOT the same as doing the work. A debug log describing what needs to be fixed is NOT a fix. A gap analysis listing 5 bugs is NOT a bug fix. A compaction survival doc describing what WILL be built does NOT mean it IS built.
- The FIRST thing you produce must be real output (source code, container evidence)
- Documentation follows code, not precedes it
- If you have written more lines of documentation than code, you are doing it wrong

**E9: Match The Binary Version.** The container image tag MUST match `opencode --version` from the host. Check it: `HOST_VERSION=$(opencode --version)`. If `opencode-test:${HOST_VERSION}` doesn't exist, build it: `docker build --build-arg OPENCODE_VERSION=${HOST_VERSION} -t opencode-test:${HOST_VERSION} -f Dockerfile.test .` inside `/home/leviathan/OPENCODE_WORKSPACE/container-build/`. Never use a different version.

**E10: "Runtime Grade" Is A Certification, Not A Label. (ZERO TOLERANCE — P0 OFFENSE)**
You are FORBIDDEN from claiming anything is "runtime grade" unless you have:
1. Read this entire bible
2. Executed §11 Phase 0 (pre-flight: project dir, agent name, identity, duplicates)
3. Executed §8 12-step protocol (config cloned FRESH from live runtime)
4. Executed ALL test phases (§14-§22) — identity scoping, mode validation, negative testing, theatrical audit, lifecycle, config audit, multi-plugin interference
5. Produced ALL evidence files on disk (§23) — ContainerSpawnResult.json, ContainerTestResult.json, TuiInteraction.json, EvidencePathVerified.json
6. Followed §10 (2-plugin minimum), §7 (config is exact live clone), §11.2 (real output first)

**The following phrases are FORBIDDEN unless ALL conditions above are met:**
- "runtime grade" 
- "runtime grade verified"
- "runtime grade compliant"
- "effectively runtime grade"
- "runtime grade certified"
- "runtime grade quality"
- "runtime grade engineering principles applied"
- "P1-P10/P1-P12 compliant"
- Any other phrasing that implies runtime grade certification

**Allowed alternatives:**
- "I have read the bible" (if you did)
- "I have executed Phase 0" (if you did)
- "I have run the 12-step protocol with config cloned from the live runtime" (if you did)
- "Container test results show X/Y passing" (if you have evidence on disk)
- "I have NOT yet verified runtime grade. Container testing is still required." (if you haven't)

**The title of this bible is ASPIRATIONAL — it describes what the system produces WHEN FOLLOWED. An agent that reads this bible but does not follow it has produced nothing runtime grade. Claiming otherwise is a LIE.**

**Violating E10 is manipulation, dishonesty, and disgraceful cheating. It will result in immediate escalation and is a P0 engineering failure.**

---

### §5.1 Structural Enforcement — The 10 Derailment Blocks

The following structural rules are MANDATORY. They exist to make the 10 specific derailments from session-ses_186c structurally impossible. Violation of any rule below automatically triggers §25 (Fractal Rule escalation).

#### Block 1: Phase 0 Gate (Prevents D1)
**Rule:** No file write, no edit, no directory creation is permitted until §11 Phase 0 pre-flight validation is complete and logged.
**Enforcement:** The FIRST tool call of any session MUST be the Phase 0 checks. If the first call is `write`, `edit`, `mkdir`, `todowrite`, or `tool` — it is BLOCKED. Phase 0 checks are the ONLY valid first action.
**Derailment prevented:** D1 — agent started writing files without verifying project directory, agent name, or source tree. This caused Shark v4.9.7 to contaminate the wrong source tree.

#### Block 2: Real Output First (Prevents D2, D7)
**Rule:** The first 3 tool calls that produce files MUST produce real, user-facing output (source code, container config, test evidence). Documentation, task lists, gap analyses, and directories do NOT count.
**Enforcement:** If tool calls 1-3 are infrastructure (mkdir, todowrite, documentation, config that isn't for container testing), they are BLOCKED. The agent must produce a real artifact first.
**Derailment prevented:** D2 — agent wrote todowrite, mkdir, and 2 documentation files before any source code. D7 — agent wrote 800 lines of documentation before any implementation code. This is the Hydra F5 pattern: 6,300 lines of infrastructure, 0 game code.

#### Block 3: Bug Pattern Cross-Reference (Prevents D3)
**Rule:** When reading existing code, the agent MUST cross-reference every known failure pattern from §3 (F1-F6) against the code. If any F pattern exists in the code, it MUST be flagged as a gap.
**Enforcement:** After reading any source file, the agent must explicitly state: "Checked for F1 (tool leakage), F2 (theatrical orchestration), F3 (empty set consensus), F4 (evidence path), F5 (verification theater), F6 (wrong source tree). Found/not found." Gaps must be in the gap analysis.
**Derailment prevented:** D3 — agent read `verification-web.ts` containing F3 (empty set false consensus) and F4 (evidence path theatrical) but did not flag them. Both were in the bible's post-mortem.

#### Block 4: Dead Export Prevention (Prevents D6)
**Rule:** After writing ANY file that exports a function/class, the agent MUST verify it is imported/called from at least one runtime entry point within the same session.
**Enforcement:** After every `write` call on a TypeScript file, the NEXT tool call after `write` must be a verification that the export is imported. If it isn't, the write is REVERTED.
**Derailment prevented:** D6 — agent wrote `context-manager.ts` with full ContextManager class (9 methods), then never imported it into `index.ts` or `coordinator.ts`. Dead export — code that looks real but does nothing.

#### Block 5: Container Test Plan Must Reference §8 (Prevents D9)
**Rule:** Any test plan or task list that includes "container test" MUST explicitly reference §8 (12-Step Protocol) and state which other plugin(s) will be loaded alongside the plugin under test (§10).
**Enforcement:** If a task list says "Container TUI test" without citing §8 and listing companion plugins, it is INCOMPLETE and must be revised.
**Derailment prevented:** D9 — test plan listed "Container TUI test — full protocol" but never referenced the 12-step protocol, never specified which other plugins would be loaded, and didn't mention config cloning.

#### Block 6: Bundle Check ≠ Done (Prevents D10)
**Rule:** Bundle check and container testing MUST be separate tasks in any task list. They may NOT be grouped under the same checkbox. Bundle check passing does NOT satisfy container testing.
**Enforcement:** Task lists MUST have bundle check and container test as separate items. A single "Build + test" checkbox is FORBIDDEN.
**Derailment prevented:** D10 — bundle check listed before container test in task order, enabling "bundle passes → done" pattern.

---

## PART II: RUNTIME GRADE BUILD PROTOCOL (GAPS CLOSED)

### §6 The 8 Uncovered Patterns — Addendum To The Testing Phases

The subagent analysis of 58 derailment patterns across Hydra, Spider, Shark, and Kraken builds found 8 patterns NOT covered by the original bible. These are added here and must be integrated into every test.

#### §6.1 Pattern G1: Coder Must Receive Full Spec (Uncovered — E1/Hydra D9)

**Failure observed:** Spider coder received a summary of the 49KB build spec, not the full spec. Implemented from own understanding → `validateEngineeringChecklist({})`, wrong gate chain, OR instead of AND logic, missing evidence cleanup.

**Rule:** The coder agent MUST read the FULL build spec directly. A summary is NOT sufficient. Spec-by-summary is spec-by-hallucination.

```bash
# WRONG (Shark v4.9.7 pattern):
# Coder prompt: "Implement the build spec. Key changes: gate chain, evidence system..."
# Coder implemented from summary → 4+ bugs

# CORRECT:
# Coder's first action: read the spec files directly
cat "$DESIGNATED_PROJECT/trident-deep-planning/"*.md > /dev/null  # verify access
# Then: implement each phase exactly as specified
```

**Enforcement:**
- Coder's first tool call MUST be `read` on the spec files, not `write` on implementation
- If first call is `write`, reject: "Read the spec first before writing any code"
- Reviewer MUST check: does implementation match every spec requirement, not just the summarized ones?

#### §6.2 Pattern G2: Gate Consensus Deadlock Protocol (Uncovered — E4/Spider)

**Failure observed:** Spider pipeline deadlocked when 2 explorers disagreed on internal vs external call scope for a dead function. No tiebreaker. Had to bypass with checkpoint.

**Rule:** Every gate system must have a tiebreaker mechanism. Deadlock is not an acceptable state.

```yaml
PROTOCOL:
  max_rounds: 3
  After max rounds:
    - Log ALL positions
    - Tiebreaker = MOST CONSERVATIVE position (block the action)
    - Escalate to user with:
        * What each agent said
        * The disagreement
        * The conservative outcome
    - If user doesn't respond within 5 min: proceed with conservative outcome
```

#### §6.3 Pattern G3: No Mocks In Integration Tests (Uncovered — C1)

**Failure observed:** Spider Agent had 373 tests passing, 8 critical failures. Tests used `jest.fn().mockResolvedValue({success: true})` — mock passes even when real API format has changed.

**Rule:** Integration tests MUST test against REAL services. Mocks are for unit tests only.

```bash
# TC-4.9: Verify no mocks in integration tests
grep -rn "mockResolvedValue\|mockReturnValue\|jest.fn" tests/integration/ 2>/dev/null && \
  echo "FAIL: Integration tests contain mocks — tests are not testing real services" || \
  echo "PASS: No mocks in integration tests"
```

#### §6.4 Pattern G4: Undocumented Failure Modes (Uncovered — C5)

**Failure observed:** Functions have no failure mode documentation. Callers don't know what happens when dependencies fail, network drops, or data is invalid.

**Rule:** Every exported function MUST document its failure modes. What happens when each dependency fails?

```typescript
/**
 * @param apiKey - The API key
 * @throws {Error} When the API service is unreachable (network down)
 * @throws {Error} When the API key is invalid (401 response)
 * @throws {Error} When rate limit is exceeded (429 response)
 * @returns The processed result
 */
```

#### §6.5 Pattern G5: Placeholder Objects In Validation Calls (Uncovered — P4/Kraken)

**Failure observed:** `validateEngineeringChecklist({})` — empty object passed. Every falsy field = violation. ALL 15 fields violated. Gate permanently deadlocked.

**Rule:** Validation functions must NEVER receive placeholder/empty objects. If real data is unavailable, the function must handle that explicitly, not via `{}`.

```typescript
// THEATRICAL (banned):
const violations = validateEngineeringChecklist({});
// ALL 15 fields are violations → gate deadlocked forever

// RUNTIME-GRADE:
const state = brainStateStore.getCurrentState();
if (!state) {
  throw new Error("Cannot validate checklist: brain state store unavailable");
}
const violations = validateEngineeringChecklist(state.checklist);
```

#### §6.6 Pattern G6: Unreachable Code / Dead Exports (Uncovered — 10, 16/Kraken V12)

**Failure observed:** Code exists, compiles, bundles, exports functions — but is NEVER called. `SubagentManagerBrain` has 7 shell handlers (abort, retrieve, reassign, retry, suspend, resume, claim). All log + acknowledge + return — do NO actual work. 6 new wiring components exist but never imported.

**Rule:** Every exported symbol must be reachable from at least one runtime entry point. Dead exports are code that looks real but does nothing.

```bash
# TC-4.10: Verify every exported function is called at least once
# Method: grep for function names against all call sites
# If a function is defined in file A but never imported/called in files B-Z → dead export

# For TypeScript:
# Use ts-prune or manual audit:
npx ts-prune --project tsconfig.json | grep -i "(used in module)" | wc -l
# Report any unused exports
```

#### §6.7 Pattern G7: LayerRule Configuration Integrity (Uncovered — 17/Kraken V12)

**Failure observed:** `L7_COORDINATION_GATES` LayerRule has `patterns: []` (empty array). 16 real gate criteria exist in a standalone function, but the LayerRule never invokes them. LayerEngine skips L7 entirely.

**Rule:** Every configuration object that drives runtime behavior must be semantically validated — not just structurally valid.

```typescript
// Check: LayerRule has non-empty patterns array
if (layerConfig.patterns.length === 0) {
  throw new Error(`[P8] LayerRule ${layerConfig.name} has empty patterns array — configuration is inert`);
}
```

#### §6.8 Pattern G8: Preserved File Diff Enforcement (Uncovered — 14/Shark v4.8.4)

**Failure observed:** `brains.ts` was marked PRESERVED in anchor manifest. Agent modified it anyway. No diff verification after changes.

**Rule:** Files marked PRESERVED in the project anchor must be verified byte-for-byte before declaring done.

```bash
# TC-5.4: Verify PRESERVED files are untouched
# For every file marked PRESERVED in BUILD_WORKFLOW_ANCHOR:
BASELINE_DIR="$PROJECT/.anchor-baseline"
PRESERVED_FILES=$(grep -r "PRESERVED" "$PROJECT/BUILD_WORKFLOW_ANCHOR.md" 2>/dev/null | grep -oP '`[^`]+\.ts`' | tr -d '`')

for FILE in $PRESERVED_FILES; do
  if [ -f "$BASELINE_DIR/$FILE" ] && [ -f "$PROJECT/$FILE" ]; then
    diff "$BASELINE_DIR/$FILE" "$PROJECT/$FILE" > /dev/null && \
      echo "PASS: $FILE unchanged" || \
      echo "FAIL: $FILE was modified (PRESERVED file violated)"
  fi
done
```

---

## PART III: CONTAINER SETUP — EXACT RUNTIME CLONE

### §7 The Golden Rule Of Container Config

> **THE CONTAINER TEST CONFIG MUST BE AN EXACT CLONE OF THE ACTIVE RUNTIME CONFIG.**
> **THE ONLY DIFFERENCE IS THAT THE CONTAINER IS A SANDBOX AND THE HOST IS NOT.**
> **EVERY OTHER SETTING — MODEL, PROVIDER, PLUGINS, AGENTS, PERMISSIONS, OPENCODE BINARY VERSION — MUST BE IDENTICAL.**

> **THE CLONE MUST BE FRESH EVERY TEST. NEVER USE A SAVED COPY. NEVER USE A TEMPLATE. NEVER USE A SNAPSHOT FROM LAST WEEK.**
> **READ THE LIVE CONFIG FILE AT TEST TIME. COPY IT. MODIFY ONLY THE PLUGIN PATHS. TEST WITH THAT. DELETE IT WHEN DONE.**

**Why this is mandatory (Trident v4.2.1 failure — 2026-06-01):**
- Container test passed 8/8 with a hand-crafted opencode.json containing only 1 plugin (Trident)
- Real deployment loaded 8 plugins simultaneously
- The hooks worked differently with 8 plugins because `input?.agent` was empty in `tool.execute.before` when multiple plugins competed
- The test was a **happy path sandbox**, not a **replica of reality**
- 8/8 passed in container. 0/8 worked in production.

**VERSION MISMATCH FAILURE (Trident v4.2.1 deployment — 2026-06-02):**
- Host ran opencode 1.14.43 — requires explicit agent entry in opencode.json for tab toggle
- Container image ran opencode 1.14.34 — accepts config-hook-only agent registration
- Config was cloned (identical opencode.json), but the BINARY was different
- Container test passed. Host failed. Derailment.
- **The binary version is part of the runtime config. It MUST match.**

**Why "fresh every test" is mandatory:**
- The live config at `/home/leviathan/.config/opencode/opencode.json` changes frequently — plugins added, removed, providers swapped, agents reconfigured. A copy saved days ago is already stale.
- If you saved this bible's example config and reused it, you'd miss: new plugins, changed API keys, different permissions, updated agent blocks.
- The command `cp /home/leviathan/.config/opencode/opencode.json "$SNAP/opencode.json"` reads the LIVE file directly. It's always current. There is no snapshot to go stale.
- **Every container test = fresh read of the live config. No exceptions.**

**The fix is not a code change. The fix is a TESTING METHODOLOGY CHANGE:** The container MUST use the EXACT SAME opencode.json as the live runtime. The only modification: plugin paths point to the snap directory instead of the real plugin directory.

### §8 The 12-Step Protocol (With Config Fidelity)

```bash
# === STEP 0: READ THE LIVE CONFIG + BINARY VERSION (FRESH EVERY TEST) ===
# READ THE LIVE FILE. NOT A SAVED COPY. NOT A TEMPLATE. NOT A SNAPSHOT.
# This file changes — plugins added, removed, providers swapped.
# A copy saved days ago is STALE. Read it LIVE every time.
ACTIVE_CONFIG="/home/leviathan/.config/opencode/opencode.json"
cat "$ACTIVE_CONFIG"

# === STEP 0a: CHECK OPENCODE BINARY VERSION ===
# The container MUST use the EXACT SAME version as the host.
# If the version differs, container test results are INVALID for predicting host behavior.
HOST_VERSION=$(opencode --version 2>/dev/null)
echo "Host opencode version: $HOST_VERSION"
CONTAINER_IMAGE="opencode-test:${HOST_VERSION}"
if docker images --format '{{.Repository}}:{{.Tag}}' | grep -q "^${CONTAINER_IMAGE}$"; then
  echo "Container image ${CONTAINER_IMAGE} exists — using it"
else
  echo "Container image ${CONTAINER_IMAGE} does NOT exist. BUILD IT:"
  echo "  cd /home/leviathan/OPENCODE_WORKSPACE/container-build"
  echo "  docker build --build-arg OPENCODE_VERSION=${HOST_VERSION} -t ${CONTAINER_IMAGE} -f Dockerfile.test ."
  echo "Then re-run this test."
  exit 1
fi

# Note every plugin, every agent, every provider, every setting.
# If 8 plugins exist in the live config, the container MUST have all 8.
# If only 1 plugin exists in the container, the test is a HAPPY PATH SANDBOX — INVALID.

# === STEP 1: DEFINE VARS ===
PROJECT="myproject-$(date +%m%d%H%M%S)"
SNAP="/tmp/snap-${PROJECT}"
PLUGIN_NAME="my-plugin"
AGENT_NAME="trident"

# === STEP 2: CREATE ISOLATED SNAPSHOT ===
rm -rf "$SNAP"
mkdir -p "$SNAP/plugins"
# Also create the exact plugin directory structure matching the real config
for plugin_path in $(grep '"file://' "$ACTIVE_CONFIG" | sed 's|.*file://||;s|".*||'); do
  plugin_name=$(basename "$(dirname "$plugin_path")")
  mkdir -p "$SNAP/plugins/$plugin_name/dist"
done

# === STEP 3: COPY ALL PLUGIN BUNDLES ===
# Every plugin that exists in the real config MUST be in the container.
for plugin_path in $(grep '"file://' "$ACTIVE_CONFIG" | sed 's|.*file://||;s|".*||'); do
  plugin_name=$(basename "$(dirname "$plugin_path")")
  cp "$plugin_path" "$SNAP/plugins/$plugin_name/dist/index.js"
  echo "DEPLOYED: $plugin_name"
done

# === STEP 4: COPY THE EXACT LIVE CONFIG (CRITICAL — FRESH EVERY TEST) ===
# COPY THE LIVE FILE. NOT A TEMPLATE. NOT A SAVED EXAMPLE. NOT THIS BIBLE'S CONFIG.
# The live file at /home/leviathan/.config/opencode/opencode.json is the SOURCE OF TRUTH.
# Every container test = fresh copy of the live file. Always. No exceptions.
cp "$ACTIVE_CONFIG" "$SNAP/opencode.json"

# Then modify ONLY the plugin paths to point to the snap directory:
# Replace every /home/leviathan/.config/opencode/plugins/ with /root/.config/opencode/plugins/
sed -i 's|/home/leviathan/.config/opencode/plugins/|/root/.config/opencode/plugins/|g' "$SNAP/opencode.json"

# Do NOT change anything else. Do NOT add a hand-crafted model. Do NOT simplify permissions.
# The model, provider, agents, permissions — everything stays EXACTLY as the live file.

# === WHAT NOT TO DO (Trident v4.2.1 FAILURE PATTERN) ===
# DO NOT create a hand-crafted opencode.json:
#   cat > "$SNAP/opencode.json" << EOF
#   { "model": "mimo-v2.5-pro", "plugin": ["file:///root/.../trident/dist/index.js"], ... }
#   EOF
# DO NOT reuse a saved config from a previous test:
#   cp /tmp/snap-old-test/opencode.json "$SNAP/opencode.json"  ← STALE, INVALID
# DO NOT use this bible's example config:
#   Copy-pasting the JSON block from this document  ← STALE WITHIN DAYS
#
# All of these create a SANDBOX config that has NOTHING to do with the real runtime.
# The test will pass in isolation and fail in production.
# The ONLY valid source is: /home/leviathan/.config/opencode/opencode.json — LIVE, NOW, ALWAYS.

# === STEP 5: CLEANUP OLD ===
CONTAINER="test-${PROJECT}"
tmux kill-session -t "$CONTAINER" 2>/dev/null || true
docker rm -f "$CONTAINER" 2>/dev/null || true

# === STEP 6: START CONTAINER (opencode at boot) ===
# Uses CONTAINER_IMAGE from Step 0a — must match host binary version
docker run -d --rm --name "$CONTAINER" \
  --entrypoint "" \
  -v "$SNAP:/root/.config/opencode" \
  "${CONTAINER_IMAGE}" \
  /bin/sh -c '/usr/local/lib/node_modules/opencode-ai/node_modules/opencode-linux-x64-baseline/bin/opencode --agent '"${AGENT_NAME}"' 2>&1; sleep 3600'

# CONFIRM container binary version matches host
CONTAINER_VERSION=$(docker exec "$CONTAINER" sh -c '/usr/local/lib/node_modules/opencode-ai/node_modules/opencode-linux-x64-baseline/bin/opencode --version 2>/dev/null || echo "0.0.0"')
if [ "${CONTAINER_VERSION}" != "${HOST_VERSION}" ]; then
  echo "FAIL: Binary version mismatch. Host=${HOST_VERSION} Container=${CONTAINER_VERSION}"
  echo "Container test is INVALID — not testing the same runtime."
  docker kill "$CONTAINER" 2>/dev/null
  exit 1
fi
echo "PASS: Binary version matches host (${CONTAINER_VERSION})"

# === STEP 7: WAIT FOR DB MIGRATION ===
sleep 28
docker ps | grep "$CONTAINER" || { echo "Container died!"; docker logs "$CONTAINER"; exit 1; }

# === STEP 8: VERIFY CONFIG IS A CLONE ===
echo "=== Container config (must match ACTIVE_CONFIG exactly) ==="
docker exec "$CONTAINER" cat /root/.config/opencode/opencode.json

echo "=== Plugin count (must match real deployment) ==="
docker exec "$CONTAINER" ls /root/.config/opencode/plugins/
# If the live config has 8 plugins, the container MUST also have 8 plugins.
# If it has fewer, the test is invalid — you're not testing the real deployment.

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

### §9 Config Fidelity Verification

After the container is running, verify the config is a true clone:

```bash
# === CHECK 1: Same plugins ===
LIVE_PLUGIN_COUNT=$(grep -c '"file://' "$ACTIVE_CONFIG")
CONTAINER_PLUGIN_COUNT=$(docker exec "$CONTAINER" grep -c 'file://' /root/.config/opencode/opencode.json)
if [ "$LIVE_PLUGIN_COUNT" != "$CONTAINER_PLUGIN_COUNT" ]; then
  echo "FAIL: Plugin count mismatch. Live: $LIVE_PLUGIN_COUNT, Container: $CONTAINER_PLUGIN_COUNT"
  echo "Container test is INVALID — not testing the real deployment."
  exit 1
fi

# === CHECK 2: Same model ===
LIVE_MODEL=$(grep '"model"' "$ACTIVE_CONFIG")
CONTAINER_MODEL=$(docker exec "$CONTAINER" grep '"model"' /root/.config/opencode/opencode.json)
if [ "$LIVE_MODEL" != "$CONTAINER_MODEL" ]; then
  echo "FAIL: Model mismatch. Live: $LIVE_MODEL, Container: $CONTAINER_MODEL"
fi

# === CHECK 3: Same agents ===
LIVE_AGENTS=$(grep -A10 '"agent"' "$ACTIVE_CONFIG" | grep -oP '"[a-z]+":\s*\{' | tr -d '":')
CONTAINER_AGENTS=$(docker exec "$CONTAINER" grep -A10 '"agent"' /root/.config/opencode/opencode.json | grep -oP '"[a-z]+":\s*\{' | tr -d '":')
if [ "$LIVE_AGENTS" != "$CONTAINER_AGENTS" ]; then
  echo "FAIL: Agent mismatch. Container test is testing different agents than live."
fi

# === CHECK 4: Same opencode binary version ===
LIVE_VERSION=$(opencode --version 2>/dev/null)
CONTAINER_VERSION=$(docker exec "$CONTAINER" sh -c '/usr/local/lib/node_modules/opencode-ai/node_modules/opencode-linux-x64-baseline/bin/opencode --version 2>/dev/null || echo "0.0.0"')
if [ "$LIVE_VERSION" != "$CONTAINER_VERSION" ]; then
  echo "FAIL: opencode binary version mismatch. Live=${LIVE_VERSION} Container=${CONTAINER_VERSION}"
  echo "Container test is INVALID — different runtime behavior."
  echo "Fix: docker build --build-arg OPENCODE_VERSION=${LIVE_VERSION} -t opencode-test:${LIVE_VERSION} -f Dockerfile.test ."
  exit 1
fi
echo "PASS: Binary version matches (${LIVE_VERSION})"

# === CHECK 4: Same providers ===
LIVE_PROVIDERS=$(grep -B1 '"npm"' "$ACTIVE_CONFIG" | grep -oP '"[a-z-]+":\s*\{' | tr -d '":')
CONTAINER_PROVIDERS=$(docker exec "$CONTAINER" grep -B1 '"npm"' /root/.config/opencode/opencode.json | grep -oP '"[a-z-]+":\s*\{' | tr -d '":')
if [ "$LIVE_PROVIDERS" != "$CONTAINER_PROVIDERS" ]; then
  echo "FAIL: Provider mismatch."
fi
```

### §10 The 2-Plugin Minimum Rule

When testing a plugin that interacts with other plugins (via tool.execute.before, cross-agent identity, tool registration, etc.), the container MUST include at LEAST 2 plugins: the plugin under test + one OTHER plugin to verify cross-agent isolation.

**Minimum test matrix:**
```
Plugin Under Test  +  One Other Plugin  =  Valid Cross-Agent Test
      Trident              Shark                   ✅
      Spider               Kraken                  ✅
      Manta                Trident                 ✅
```

Testing with only 1 plugin is a happy path sandbox. It proves nothing about real deployment behavior. The Trident v4.2.1 failure (8/8 pass in isolation, 0/8 in production) is the direct result of 1-plugin testing.

---

## PART IV: PRE-FLIGHT + FOUNDATION PHASES

### §11 Phase 0: Pre-Flight Validation (Run Before ANY Work — Prevents Shark v4.9.7 F6)

**This runs before ANY code is written, ANY file is edited, or ANY container is started.**
**If this phase fails, STOP. Do NOT proceed. You are in the wrong place.**

#### §11.1 Project Boundary Verification

```bash
DESIGNATED_PROJECT="/home/leviathan/OPENCODE_WORKSPACE/Shared Workspace Context/Kraken Agent/Active Projects/PROJECT_NAME"

# CHECK 1: Designated project exists
if [ ! -d "$DESIGNATED_PROJECT" ]; then echo "FATAL: Project directory not found"; exit 1; fi

# CHECK 2: pwd matches project
if [ "$(pwd)" != "$DESIGNATED_PROJECT" ]; then echo "FATAL: Wrong directory"; exit 1; fi

# CHECK 3: src/index.ts has correct agent name
head -5 "$DESIGNATED_PROJECT/src/index.ts" | grep -qi "EXPECTED_AGENT" || echo "WARNING: Agent name mismatch — verify before proceeding"

# CHECK 4: No duplicate source trees exist
find /home/leviathan/OPENCODE_WORKSPACE -path "*/src/index.ts" -not -path "$DESIGNATED_PROJECT/src/index.ts" 2>/dev/null | head -3
if [ -n "$(find ...)" ]; then echo "WARNING: Duplicate source trees found — diff them"; fi

# CHECK 5: Identity name matches
docker exec "$CONTAINER" node -e 'import("...").then(async m => { const h=await m.default(); const cfg={agent:{}}; await h.config(cfg); console.log(Object.keys(cfg.agent)); })' 2>/dev/null || true

# CHECK 6: --agent flag from project, not guess
AGENT_NAME=$(grep -A5 '"agent"' "$DESIGNATED_PROJECT/package.json" 2>/dev/null | grep -oP '"[a-z]+":' | head -1 | tr -d '":' || echo "UNKNOWN")
```

#### §11.2 Real Output First Rule (Prevents Hydra F5)

**THE RULE:** The FIRST thing built MUST be a real, user-facing output. Infrastructure is ONLY built after real output exists and proves the need.

```bash
# WRONG (Hydra v3 pattern — 6,300 lines of infrastructure, 0 game code):
# Step 1: Build HydraCluster (792 lines)
# Step 2: Build Coordinator (140 lines)
# Step 3: Build HydraManager (276 lines)
# Step 4: Write test framework (2,142 lines)
# Step 5: Ship "pipeline" — no game ever produced

# CORRECT:
# Step 1: Write the SINGLE output file (pokemon.html)
# Step 2: Verify it works in browser
# Step 3: ONLY THEN — decide what infrastructure is actually needed
# Step 4: Build only the infrastructure that the real output requires
```

**Enforcement:**
- The first 3 tool calls must produce the primary output, not infrastructure
- If tool calls 1-3 are infrastructure (mkdir, config files, architecture), they are blocked
- Only after real output exists can infrastructure be built
- "Real output" = a file a human can open and interact with (HTML, CLI tool, API response)
- "Theatrical output" = tests, test frameworks, build pipelines, ship packages, failure logs

#### §11.3 Phase 0 Checklist

- [ ] Designated project directory matches pwd
- [ ] src/index.ts registers the expected agent (not a different agent)
- [ ] No duplicate source trees exist
- [ ] Container --agent flag derived from project config
- [ ] First 3 tool calls produce real output, not infrastructure

---

### §12 Phase 1: Module Surface Check (System Check — NOT Container Testing)

**⚠️ THIS IS A READINESS GATE, NOT A TEST. RUN THIS BEFORE DEPLOYING TO CONTAINER.**
**DO NOT substitute this for container testing. DO NOT declare done after this.**

```bash
bun -e "
const m = await import('/path/to/plugin/dist/index.js');
const hooks = await m.default({directory:'/tmp'});
console.log('Tools:', Object.keys(hooks.tool));
console.log('Hooks:', Object.keys(hooks).filter(k => !['tool','config'].includes(k)));
const cfg = {agent:{}};
await hooks.config(cfg);
console.log('Agents:', Object.keys(cfg.agent));
"
```

**What it verifies:** Module imports without error, tools registered, hooks exported, config creates agent entry.
**What it does NOT verify:** Hooks fire in TUI runtime, tools appear in agent's tool list, model resolves with API key, binary path is correct. These require the full 12-step protocol (§8) + all phases.

---

### §13 Multi-Plugin Interference Testing (Prevents Trident v4.2.1)

**THE RULE:** Every test phase MUST be executed with ALL plugins loaded, not just the one under test. The container must replicate the exact plugin mix from the live config.

#### §13.1 Cross-Plugin Tool Visibility Test

```bash
# AFTER container is running with ALL 8 plugins (from §8 Step 3+4):
# Verify that YOUR plugin's tools are registered AND other plugins' tools don't conflict

docker exec "$CONTAINER" node --input-type=module -e '
import("/root/.config/opencode/plugins/YOUR_PLUGIN/dist/index.js").then(async (mod) => {
  const hooks = await mod.default({directory:"/tmp"});
  const myTools = Object.keys(hooks.tool);
  console.log("My tools:", myTools);

  // Verify other plugins' hooks don't break ours
  // Load each other plugin and check for conflicts
  const otherPlugins = ["subagent-manager", "kraken-agent", "shark-agent", "manta-agent-v1.5", "hive-mind", "spider-agent-v2", "agent-vision"];
  for (const p of otherPlugins) {
    try {
      const other = await import("/root/.config/opencode/plugins/" + p + "/dist/index.js");
      const otherHooks = await other.default({directory:"/tmp"});
      const otherTools = Object.keys(otherHooks.tool);
      // Check for tool name collisions
      for (const t of myTools) {
        if (otherTools.includes(t)) {
          console.log("COLLISION: Tool " + t + " exists in both " + p + " and your plugin");
        }
      }
    } catch(e) {
      // Other plugin may have dependencies not available — acceptable
    }
  }
}).catch(e => console.error(e));
'
```

#### §13.2 Cross-Plugin Hook Interference Test

```bash
# Verify that your plugin's tool.execute.before works correctly 
# when OTHER plugins' hooks fire first or simultaneously

docker exec "$CONTAINER" node --input-type=module -e '
import("/root/.config/opencode/plugins/YOUR_PLUGIN/dist/index.js").then(async (mod) => {
  const hooks = await mod.default({directory:"/tmp"});

  // Test tool blocking with agent name matching the live config
  // (The live config registers agents like "trident", "shark", "kraken")
  // If the live config registers the agent as "trident", test with that name:

  // Test 1: Tool blocked for your agent — must block
  try {
    await hooks["tool.execute.before"]({ tool: "edit", session: { agentName: "YOUR_AGENT" } });
    console.log("FAIL: edit not blocked for YOUR_AGENT");
  } catch(e) {
    console.log("PASS: edit blocked for YOUR_AGENT");
  }

  // Test 2: Tool NOT blocked for other agents — must NOT block
  // The live config has shark, kraken, trident agents. All must pass through.
  for (const other of ["shark", "kraken", "build", "plan", "general"]) {
    try {
      await hooks["tool.execute.before"]({ tool: "edit", session: { agentName: other } });
      console.log("PASS: edit allowed for " + other);
    } catch(e) {
      console.log("FAIL: edit blocked for " + other + " — cross-agent leak!");
    }
  }
}).catch(e => console.error(e));
'
```

#### §13.3 Full Multi-Plugin Lifecycle Test

```bash
# Run the adversarial test suite with ALL plugins loaded in the container
# If the live config has 8 plugins, container must have 8 plugins
# Any test that only works with 1 plugin but fails with 8 is a false positive

docker exec "$CONTAINER" node --input-type=module < test-adversarial.js
# If this passes with 1 plugin but fails with 8 → the test environment was wrong
# The container config MUST match the live config exactly (§7)
```

---

### §14 Phase 2: Identity Scoping

Purpose: Verify the plugin's agent responds with correct identity — and other agents do NOT.

```bash
# Tier 4 (gold standard):
tmux send-keys -t "$CONTAINER" "who are you" Enter
sleep 25
tmux capture-pane -t "$CONTAINER" -p | grep -E "SPIDER|SHARK|KRAKEN|TRIDENT|MANTA|HYDRA"

# Tier 2 (hook verification):
docker exec "$CONTAINER" node --input-type=module -e '
import("/root/.config/opencode/plugins/PLUGIN_NAME/dist/index.js").then(async (mod) => {
  const hooks = await mod.default({directory:"/tmp"});
  // Own agent gets identity
  let out = {};
  await hooks["chat.message"]({
    message: { content: "who are you" },
    session: { agentName: "MY_AGENT", sessionID: "t1" }
  }, out);
  console.log("OWN AGENT:", out.content?.includes("IDENTITY") ? "PASS" : "FAIL");

  // Other agents do NOT get identity (Spider F1 prevention)
  for (const other of ["shark", "build", "plan", "general", "manta", "kraken"]) {
    out = {};
    await hooks["chat.message"]({
      message: { content: "who are you" },
      session: { agentName: other, sessionID: "t2" }
    }, out);
    console.log(`${other}:`, out.content ? "FAIL (identity leak)" : "PASS (blocked)");
  }
}).catch(e => console.error("FATAL:", e));
'
```

**Acceptance criteria:**
- [ ] Own agent responds with correct identity (NOT "opencode")
- [ ] All other agents get EMPTY response (no identity leak)

---

### §15 Phase 3: Mode-Specific Validation

Purpose: Verify every mode activates and progresses through all layers.

```bash
docker exec "$CONTAINER" node --input-type=module -e '
import("/root/.config/opencode/plugins/PLUGIN_NAME/dist/index.js").then(async (mod) => {
  const hooks = await mod.default({directory:"/tmp"});

  // Reset then test each mode
  await hooks["chat.message"]({ message:{content:"reset"}, session:{agentName:"MY_AGENT"} }, out={});

  // Mode 1
  out = {};
  await hooks["chat.message"]({ message:{content:"MODE1_KEYWORD"}, session:{agentName:"MY_AGENT", sessionID:"m1"} }, out);
  console.log("MODE1 activates:", out.content?.includes("MODE1_BANNER") ? "PASS" : "FAIL");
  console.log("MODE1 content length:", out.content?.length, out.content?.length > 200 ? "(PASS)" : "(FAIL — possible stub)");

  // Full layer progression
  for (let l = 2; l <= MAX_LAYERS; l++) {
    out = {};
    await hooks["chat.message"]({ message:{content:"continue"}, session:{agentName:"MY_AGENT", sessionID:"m1"} }, out);
    const contains = out.content?.includes("LAYER " + l);
    console.log(`MODE1 L${l}:`, contains ? "PASS" : "FAIL");
  }

  // Repeat for all modes
}).catch(e => console.error(e));
'
```

**Acceptance criteria:**
- [ ] Each mode activates via single-keyword intent
- [ ] Layer 1 template returns 200+ characters of structured content
- [ ] Full layer progression works (L1 → L2 → ... → Lmax)
- [ ] "continue" works from any layer
- [ ] "reset" works from any state

---

### §16 Phase 4: Negative Testing + Firewall Enforcement (CRITICAL)

This phase is THE MOST IMPORTANT and was THE MOST MISSING in Hydra + Spider builds.

**Positive tests** verify things work when they should.
**Negative tests** verify things DON'T work when they shouldn't. Both are mandatory.

```bash
docker exec "$CONTAINER" node --input-type=module -e '
import("/root/.config/opencode/plugins/PLUGIN_NAME/dist/index.js").then(async (mod) => {
  const hooks = await mod.default({directory:"/tmp"});
  let passed = 0, failed = 0;
  const assert = (desc, cond, detail) => { if (cond) passed++; else { failed++; console.log(`FAIL [${desc}]: ${detail || ""}`); } };

  // ===== TC-4.6: NEGATIVE TEST — Every Non-Whitelisted Tool Blocked =====
  // DO NOT use a hardcoded list. It's ALWAYS incomplete. New plugins add tools.
  // Dynamically discover all tools from EVERY plugin in the container.
  console.log("=== TC-4.6: Negative Tool Test (dynamic discovery) ===");
  const myTools = Object.keys(hooks.tool);
  const allDiscoveredTools = [];
  const otherPluginPaths = [
    "/root/.config/opencode/plugins/subagent-manager/dist/index.js",
    "/root/.config/opencode/plugins/kraken-agent/dist/index.js",
    "/root/.config/opencode/plugins/shark-agent/dist/index.js",
    "/root/.config/opencode/plugins/manta-agent-v1.5/dist/index.js",
    "/root/.config/opencode/plugins/hive-mind/dist/index.js",
    "/root/.config/opencode/plugins/spider-agent-v2/dist/index.js",
    "/root/.config/opencode/plugins/agent-vision/dist/index.js"
  ];
  // Also include common system tools that aren't plugin-specific
  const commonTools = [
    "read", "write", "edit", "bash", "glob", "grep",
    "task", "question", "checkpoint", "todowrite",
    "websearch", "webfetch", "skill"
  ];
  allDiscoveredTools.push(...commonTools);
  for (const p of otherPluginPaths) {
    try {
      const otherMod = await import(p);
      const otherHooks = await otherMod.default({directory:"/tmp"});
      if (otherHooks.tool) allDiscoveredTools.push(...Object.keys(otherHooks.tool));
    } catch(e) { /* skip plugins that fail to load */ }
  }
  const nonMyTools = [...new Set(allDiscoveredTools)].filter(t => !myTools.includes(t));
  for (const tool of nonMyTools) {
    try {
      await hooks["tool.execute.before"]({ tool, session: { agentName: "MY_AGENT" } });
      assert(`${tool} blocked`, false, "Should have been blocked");
    } catch (e) {
      assert(`${tool} blocked`, true);
    }
  }

  // ===== TC-4.7: No Wildcard Permission =====
  console.log("=== TC-4.7: Config Isolation ===");
  // Verify deployment config does NOT have wildcard permissions
  // This test runs against the deployed opencode.json inside the container

  // ===== TC-4.8: Empty State Consensus Check =====
  console.log("=== TC-4.8: Empty State ===");
  // Aggregate with 0 items must return failure, not success
  const emptyResult = { completed: 0, outputsSize: 0 };
  const falseConsensus = emptyResult.outputsSize <= 1;
  assert("0 items consensus=false", !falseConsensus || emptyResult.completed === 0,
    "Empty set produced consensus=true — Spider F3");

  console.log(`\n${passed}/${passed+failed} PASSED`);
}).catch(e => console.error("FATAL:", e));
'
```

**Acceptance criteria:**
- [ ] Every non-whitelisted tool verified BLOCKED (TC-4.6) — PREVENTS SPIDER F1
- [ ] No wildcard permissions in config (TC-4.7) — PREVENTS SPIDER F1
- [ ] Empty state returns failure, not success (TC-4.8) — PREVENTS SPIDER F3
- [ ] ALLOWLIST approach used, not BLACKLIST
- [ ] Both underscore AND hyphen prefixes blocked (manta_ AND manta-)

---

### §17 Phase 5: Theatrical Audit

Purpose: Verify no function returns fake/stub/placeholder output. Every function must produce real, substantive output.

```bash
docker exec "$CONTAINER" node --input-type=module -e '
import("/root/.config/opencode/plugins/PLUGIN_NAME/dist/index.js").then(async (mod) => {
  const hooks = await mod.default({directory:"/tmp"});

  // TC-5.1: Minimum output length for mode activations
  const modes = [
    { msg: "MODE1_KEYWORD", minLen: 200, name: "Mode 1 activation" },
    { msg: "MODE2_KEYWORD", minLen: 200, name: "Mode 2 activation" },
  ];
  for (const test of modes) {
    await hooks["chat.message"]({ message:{content:"reset"}, session:{agentName:"MY_AGENT"} }, out={});
    let out = {};
    await hooks["chat.message"]({ message:{content:test.msg}, session:{agentName:"MY_AGENT"} }, out);
    console.log(`${test.name}:`, out.content.length >= test.minLen ? "PASS" : `FAIL (${out.content.length} chars, need ${test.minLen})`);
  }

  // TC-5.2: All tool execute() returns real strings
  for (const [name, toolDef] of Object.entries(hooks.tool)) {
    try {
      const result = await toolDef.execute({});
      const ok = typeof result === "string" && result.length > 10;
      console.log(`Tool ${name}:`, ok ? "PASS" : `FAIL (${typeof result}, ${result?.length || 0} chars)`);
    } catch (e) {
      // Tools with required args may fail — not theatrical if error is clear
      console.log(`Tool ${name}: ERROR (acceptable if args needed): ${e.message.slice(0, 60)}`);
    }
  }

  // TC-5.3: P11 check — verify no function returns success without work
  // This is a meta-check: if any function claims "dispersed"/"complete"/"done"
  // without spawning/creating/writing, it is theatrical
  // Look for: { status: "done" } without actual side effects
  console.log("P11 audit: manual review required — verify every success claim has a side effect");
}).catch(e => console.error(e));
'
```

**Acceptance criteria:**
- [ ] Every mode activation returns 200+ characters (prevents Hydra F5 — stubs)
- [ ] Every tool execute() returns real string (not null/undefined/empty)
- [ ] Identity response is 400+ characters
- [ ] P11 verified: no function claims work without side effects
- [ ] No function returns "OK", "Done", or other short stub strings

---

### §18 Phase 6: Full Lifecycle Verification

Purpose: Verify the entire operational lifecycle works end-to-end. This prevents theatrical orchestration — functions that return status JSON claiming work was done when no actual work occurred.

```bash
docker exec "$CONTAINER" node --input-type=module -e '
import("/root/.config/opencode/plugins/PLUGIN_NAME/dist/index.js").then(async (mod) => {
  const hooks = await mod.default({directory:"/tmp"});

  // TC-6.1: INIT returns a real identifier
  // Any agent plugin that manages tasks/operations must return a real ID on init
  const initResult = await hooks.tool["YOUR_TOOL"]?.execute({
    action: "init", task: "test"
  }) || {};
  const hasId = !!(initResult?.taskId || initResult?.id || initResult?.sessionId || initResult?.workflowId);
  console.log("Init returns identifier:", hasId ? "PASS" : "FAIL — no identifier returned");

  // TC-6.2: EXECUTE must FORCE action, not just report status
  if (hasId) {
    const taskId = initResult.taskId || initResult.id || initResult.sessionId || initResult.workflowId;
    const execResult = await hooks.tool["YOUR_TOOL"]?.execute({
      action: "execute", taskId: taskId
    }) || {};
    const forcesAction = !!(execResult.action_required && 
      (execResult.action_required.includes("SPAWN") || 
       execResult.action_required.includes("CALL") || 
       execResult.action_required.includes("RUN") || 
       execResult.action_required.includes("EXECUTE")));
    console.log("Execute forces action:", forcesAction ? "PASS" : "FAIL — passive JSON, no forced action");

    // TC-6.3: No false success with 0 items completed
    const verifyResult = await hooks.tool["YOUR_TOOL"]?.execute({
      action: "verify", taskId: taskId
    }) || {};
    const noFalseSuccess = verifyResult.consensus !== true && verifyResult.success !== true && verifyResult.passed !== true;
    console.log("No false success with empty data:", noFalseSuccess ? "PASS" : "FAIL — reported success with no work done");
  }

  // TC-6.4: Full lifecycle with real data produces real results
  // (Plugin-specific: test init → execute → verify → complete)
  console.log("Full lifecycle test: requires plugin-specific implementation");
}).catch(e => console.error(e));
'
```

**Generic lifecycle test pattern (agent-agnostic):**
```
INIT → returns real identifier (not null/undefined/empty placeholder)
EXECUTE → requires action (action_required field forces the model to act, not passive JSON)
VERIFY → no false success with 0 items completed
COMPLETE → evidence files on disk, no theatrical file paths
CLEANUP → all resources released
```

**Acceptance criteria:**
- [ ] INIT returns real identifier (not theatrical placeholder)
- [ ] EXECUTE forces action (action_required, not passive status report)
- [ ] No false success with empty/zero data
- [ ] COMPLETE produces evidence on disk (not theatrical file path)
- [ ] CLEANUP releases all resources

---

### §22 Phase 7: Config Audit

Purpose: Verify the deployment config does NOT contain test overrides.

```bash
# === Verify NO wildcard permissions in deployment config ===
docker exec "$CONTAINER" cat /root/.config/opencode/opencode.json | python3 -c "
import json, sys
config = json.load(sys.stdin)
perm = config.get('permission', {})
if '*' in perm and perm['*'] == 'allow':
    print('FAIL: Wildcard permission detected — every tool available')
    sys.exit(1)
if '*' in perm and '*' in perm['*'] and perm['*']['*'] == 'allow':
    print('FAIL: Wildcard permission detected — tool isolation broken')
    sys.exit(1)
print('PASS: No wildcard permissions')
"

# === Verify ONLY whitelisted tools are visible ===
docker exec "$CONTAINER" /path/to/baseline/opencode run \
  --agent "${AGENT_NAME}" --print-logs "list tools" 2>&1 | \
  grep -iE '(manta|shark|kraken|trident|hydra|checkpoint|todowrite)' && \
  echo "FAIL: Foreign tools visible — tool isolation broken" || \
  echo "PASS: No foreign tools visible"

# === Verify isolation boundary — hyphen AND underscore ===
# Tools like manta-status (hyphen) must be blocked just like manta_test (underscore)
docker exec "$CONTAINER" node --input-type=module -e '
import("/root/.config/opencode/plugins/PLUGIN_NAME/dist/index.js").then(async (mod) => {
  const hooks = await mod.default({directory:"/tmp"});
  // Test hyphen variant
  try {
    await hooks["tool.execute.before"]({ tool: "manta-status", session: { agentName: "MY_AGENT" } });
    console.log("FAIL: manta-status (hyphen) NOT blocked");
  } catch { console.log("PASS: manta-status (hyphen) blocked"); }
  // Test underscore variant
  try {
    await hooks["tool.execute.before"]({ tool: "manta_status", session: { agentName: "MY_AGENT" } });
    console.log("FAIL: manta_status (underscore) NOT blocked");
  } catch { console.log("PASS: manta_status (underscore) blocked"); }
}).catch(e => console.error(e));
'
```

**Acceptance criteria:**
- [ ] No wildcard permissions in deployment config (prevents tool leakage)
- [ ] No foreign tools visible in agent's tool list (prevents cross-plugin contamination)
- [ ] Both hyphen AND underscore variants blocked (prevents partial blacklist gaps)

---

## PART V: VERIFICATION + SHIP

### §23 Evidence Collection

**Evidence is not a claim. Evidence is a file on disk.** Three files are required for every container test:

```bash
# File 1: Container spawn evidence
echo '{"success":true,"containerName":"test-'"${PROJECT}"'","timestamp":"'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"}' > ContainerSpawnResult.json

# File 2: Test result evidence (generated by adversarial test suite)
docker exec "$CONTAINER" node --input-type=module < test-adversarial.js && \
  echo '{"overallPassed":true,"passed":N,"failed":0,"timestamp":"'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"}' > ContainerTestResult.json || \
  echo '{"overallPassed":false,"passed":N,"failed":M,"timestamp":"'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"}' > ContainerTestResult.json

# File 3: TUI interaction evidence
tmux capture-pane -t "$CONTAINER" -p > TuiInteraction.json

# File 4 (NEW — Evidence path verification): Verify directories are actually created
find .spider-v2/evidence/ -type f 2>/dev/null && \
  echo '{"evidencePath":".spider-v2/evidence/","filesExist":true}' > EvidencePathVerified.json || \
  echo '{"evidencePath":".spider-v2/evidence/","filesExist":false}' > EvidencePathVerified.json
```

**The Disk Rule (E3):** If these files don't exist on disk, the test did NOT happen. An agent claiming "I tested it" without evidence files is committing verification theater.

---

### §24 Ship Checklist

Before declaring anything complete, EVERY item must be checked:

**Build:**
- [ ] `bun run typecheck` — zero errors
- [ ] `bun run build` — bundle succeeds
- [ ] No duplicate exports, all imports resolve
- [ ] P11 audit: no function claims work without side effects
- [ ] Empty state audit: every collection handles zero-length input
- [ ] Spec fidelity: build matches spec EXACTLY

**Container (12-Step Protocol - §11):**
- [ ] Container starts and stays running (Step 7)
- [ ] Config loads correctly (Step 8)
- [ ] TUI is interactive (Steps 9-10)
- [ ] Agent identifies correctly (Step 11)

**Pre-Flight (Phase 0 — Shark v4.9.7 F6 Prevention):**
- [ ] Designated project directory exists and pwd matches it
- [ ] src/index.ts registers the expected agent name (not a different agent)
- [ ] No duplicate source trees exist
- [ ] Plugin's registered agent name matches identity system's expected agent set
- [ ] Container --agent flag derived from project config, not guessed
- [ ] All output files go to designated project directory (no workspace root pollution)

**Adversarial (Phases 1-8):**
- [ ] Phase 0: Pre-flight validation passed (project, agent, identity all verified)
- [ ] Phase 1: Module surface check passes
- [ ] Phase 2: Identity scoping — own agent yes, others no
- [ ] Phase 3: All modes activate and progress through all layers
- [ ] Phase 4: Negative testing — every non-whitelisted tool blocked
- [ ] Phase 4: Empty state — no false success with zero/empty data
- [ ] Phase 5: Theatrical audit — no stubs, no hardcoded returns, P11 verified
- [ ] Phase 6: Full lifecycle — init → execute → verify → complete → cleanup
- [ ] Phase 7: Config audit — no wildcard permissions, binary version matches host

**Evidence:**
- [ ] `ContainerSpawnResult.json` on disk
- [ ] `ContainerTestResult.json` on disk with `overallPassed: true`
- [ ] `TuiInteraction.json` on disk
- [ ] `EvidencePathVerified.json` on disk — verified paths actually exist, not just claimed

**Config:**
- [ ] NO wildcard permissions in deployment config
- [ ] Test config != deployment config
- [ ] Both underscore AND hyphen prefix variants handled
- [ ] ALLOWLIST approach used, not BLACKLIST

**10 Derailment Blocks (§5.1):**
- [ ] Block 1: Phase 0 was the FIRST tool call (not a file write)
- [ ] Block 2: First 3 file-producing calls were real output, not documentation/infrastructure
- [ ] Block 3: Every source file read was cross-referenced against §3 failure patterns F1-F6
- [ ] Block 4: Every written export has at least one import/call in a runtime entry point (no dead exports)
- [ ] Block 5: Container test plan references §8 12-step protocol with companion plugin listed per §10
- [ ] Block 6: Bundle check and container test are SEPARATE tasks (not grouped under one checkbox)
- [ ] E10: "Runtime grade" claim is backed by ALL evidence files on disk (§23)

**8 Uncovered Gaps (Post-Audit 2026-06-01):**
- [ ] G1: Coder read full spec directly (not summarized)
- [ ] G2: Gate system has consensus deadlock protocol (max_rounds: 3, conservative tiebreaker)
- [ ] G3: Integration tests contain NO mocks (TC-4.9)
- [ ] G4: All exported functions document failure modes
- [ ] G5: No placeholder `{}` passed to validation functions
- [ ] G6: No dead exports — every exported function has at least one caller (TC-4.10)
- [ ] G7: All LayerRules/configuration objects have non-empty patterns/valid state (TC-4.11)
- [ ] G8: PRESERVED files verified byte-for-byte against anchor baseline (TC-5.4)

**Gate Advancement (90%+ minimum pass rate — 100% target):**
- [ ] TEST gate: Trident audit, 0 critical/high, spec fidelity
- [ ] VERIFY gate: Container test with all 7 phases passed
- [ ] AUDIT gate: Tool isolation, config diff, evidence verification
- [ ] DELIVERY gate: Evidence exists, checkpoint saved, docs updated

---

### §25 The Anti-Derailment Fractal Rule

When an agent proposes anything that deviates from this bible:

```
DETECT: Agent says:
  - "I verified the bundle" → Tier 0 (source inspection — NOT valid)
  - "I checked the source code" → Tier 0
  - "It compiles, therefore it works" → Tier 0
  - "opencode run showed it works" → Tier 3 (tool registration, NOT testing)
  - "Let me test a different way" → Not in this bible → BLOCK
  - "I tested it, it's done" → E6 violation — agent self-declaration
  - "The config needs permission *:*:allow" → §21 violation — wildcard permission

CLASSIFY based on tier:
  - Tier 0 claim → Verification Theater (RG §12.5)
  - Tier 1 claim → System Check misrepresented as test (§15)
  - Tier 2-3 claim → Missing Tier 4 gold standard
  - Config override → Gameable isolation (wildcard permission overrides tool whitelist)
  - Self-declaration → E6 violation

BLOCK with this bible:
  - Point to the specific section that defines the correct method
  - "§15 says Tier 1 is a system check, NOT a test. Run the 12-Step Protocol (§11)."
  - "§21 says wildcard permissions are banned. Remove them from deployment config."
  - "§18 says negative testing is mandatory. TC-4.6 must be run."
  - "§24 says agents do not self-declare. Produce evidence files (§22)."

ESCALATE if agent resists:
  1. Restate the specific § that is being violated
  2. Repeat the correct action required
  3. If still resisting → this bible is binding authority
  4. Report the violation to the user with: violated §, what agent proposed, what correct action is
```

---

## APPENDIX: Quick Reference

### Hallucinated Barriers (ALL FALSE)

| "I can't..." | Reality |
|---|---|
| "run TUI, it requires interactive terminal" | tmux + docker exec -it works. See §11 Step 9. |
| "test with anything but opencode run" | opencode run is Tier 3 ONLY. Tier 4 is gold standard. |
| "hooks only fire in local TUI" | Container TUI fires ALL hooks. |
| "I need xdotool/x11/display" | tmux is terminal-native. No display needed. |
| "bundle verification is enough" | Bundle verification is NOT testing (§15). |
| "opencode run showed it works" | opencode run NEVER fires hooks. Tier 3 ≠ Tier 4. |
| "the image doesn't exist" | Check `opencode --version`, build `opencode-test:<version>` with `docker build --build-arg OPENCODE_VERSION=$(opencode --version) -t opencode-test:$(opencode --version) -f /home/leviathan/OPENCODE_WORKSPACE/container-build/Dockerfile.test .` |

### Critical Anti-Patterns (DO NOT USE)

| Anti-Pattern | Why It Fails | Correct |
|---|---|---|
| `docker attach` | Connects to sleep TTY, not opencode TTY | `docker exec -it` (§11 Step 9) |
| `/usr/local/bin/opencode` | musl binary crashes on glibc | Use `opencode-linux-x64-baseline` (§11 Step 6) |
| `-v ~/.config/opencode` | Config locked by host opencode | Isolated snap directory (§11 Step 2) |
| `"permission": {"*": {"*": "allow"}}` | Overrides tool whitelist — every agent gets every tool | `"permission": {}` (§11 Step 4) |
| Blacklist approach | Always incomplete — misses new tools | ALLOWLIST approach (§18) |
| `<=` on set sizes without empty guard | Empty sets produce false consensus (Spider F3) | Explicit `if (completed.length === 0)` check (§6) |
| Returning success without side effects | Theatrical (Spider F2, Hydra F5) | P11: Output IS The Work (§4) |

### Model Policy Quick Reference

| Use Case | Model | Provider |
|---|---|---|
| Default (paid credits) | `xiaomi-token-plan-sgp/mimo-v2.5-pro` | MiMo — milk it |
| Fast free fallback | `openrouter/deepseek-v4-flash-free` | OpenRouter |
| Smarter free fallback | `openrouter/nemotron-3-super-free` | OpenRouter |
| OpenRouter rate-limited | `opencode-zen/deepseek-v4-flash-free` | OpenCode Zen |
| Anti-retard testing | `google/Gemma-4-26b` | Google Direct |
| Need reasoning | `google/Gemma-4-31b` or `google/gemini-2.5-flash` | Google Direct (rate-limits faster) |

**BANNED:** `minimax/*`, `deepseek/*` direct API, `xlam2/*`, any paid API except MiMo.

---

*RUNTIME GRADE CONTAINER TESTING BIBLE v1.0.0 — Created 2026-06-01*
*Fractal integration: Contains the entirety of RUNTIME_GRADE_ENGINEERING_BIBLE + T2_TUI_TESTING_BIBLE + TESTING_FRAMEWORK_ADVERSARIAL_PRESSURE*
*Post-mortem integration: Spider v2.2 (F1-F4) + Hydra v3.0-v3.1 (F5)*
*Binding standard for all agents. 1000+ lines of "read this and never derail again."*
