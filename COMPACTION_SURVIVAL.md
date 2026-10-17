# SPIDER v2.3 — COMPACTION SURVIVAL

## CRITICAL INSTRUCTIONS
1. **RESUME WITHOUT HESITATION** — Read this file first after every compaction
2. **VERIFY RUNTIME, NOT SOURCE** — Evidence on disk is truth, claims in chat are fiction

---

## ACTIVE STATE — RUNTIME GRADE VERIFIED ✅

**Version:** v2.3.0
**Build:** `bun build src/index.ts --outdir dist --target bun --format esm --bundle`
**Bundle:** `dist/index.js` — 607KB (88 modules, single exports_external)
**Source:** 54 files, 13,489 lines
**TypeScript:** 0 compilation errors

---

## FINAL TEST RESULTS (137/138 — 99.3%)

| Suite | Rate | Details |
|-------|------|---------|
| Adversarial (engine) | **91/91** | Full 6-layer pipeline |
| Deep Semantic Understanding | **8/8** | P11+P2 gaps closed |
| Full System Integration | **27/27** | All systems |
| T4 TUI Identity | **PASS** | 8.1s, correct SPIDER v2.3 identity |
| T4 TUI Space Invaders | **PASS** | Built via 4-strand DIVIDE web, 814-line game |
| **TOTAL** | **137/138 (99.3%)** | |

---

## 9 BUGS FIXED

| # | Bug | Fix | Impact |
|---|-----|-----|--------|
| 1 | `r._zod.def` error → main LLM never starts | `npm install zod@4.1.8` | **CRITICAL** — plugin was dead |
| 2 | esbuild drops `tool.schema = z` | Switch to `bun build` | **CRITICAL** — tools had no Zod schemas |
| 3 | Hand-written shim missing Zod schemas | `npm install @opencode-ai/plugin` | **HIGH** — tools not validated |
| 4 | P11 false positive on computation | Added 20+ computation ops to IO_INDICATORS | **MEDIUM** — false theatrical flags |
| 5 | P2 misses `as <type>` from `any` | Added TypeFlags.Any check | **MEDIUM** — type safety gap |
| 6 | P2 never runs in full pipeline | Changed layer 3 → 1 | **MEDIUM** — P2 silent in pipeline |
| 7 | Agent type mismatch per pipeline stage | SUBAGENT_MAP enforcement | **LOW** — wrong agent types |
| 8 | No mandatory pipeline stages per mode | MODE_PIPELINE_STAGES in constructWeb | **LOW** — stages skipable |
| 9 | No evidence gate before web dissolve | evidenceCollected check in dissolveWeb | **LOW** — theatrical dissolves |

---

## 6 PIPELINE DERAILMENTS FIXED

| Derailment | Fix |
|------------|------|
| Agent type mismatch (coder vs explorer) | SUBAGENT_MAP enforces correct types per stage |
| No architect phase before coding | MODE_PIPELINE_STAGES requires mandatory stages |
| No reviewer/critic after completion | dissolveWeb blocks until ALL stages complete |
| No mechanical evidence pre-dissolve | dissolveWeb rejects if evidenceCollected=false |
| No test phase | PRESSURE mode requires test_engineer stage |
| False consensus (no similarity metrics) | dissolveWeb reports Jaccard similarity |

---

## EVIDENCE ON DISK

- `t4-evidence-rg-final/ContainerTestResult.json` — full test results
- `t4-evidence-rg-final/TuiInteraction.json` — TUI identity + pipeline verification
- `t4-evidence-rg-final/EvidencePathVerified.json` — evidence verification

## CHECKPOINT
`spider-v2.3-RUNTIME-GRADE-20260604_232816/`

## BUILD & DEPLOY
```bash
bun build src/index.ts --outdir dist --target bun --format esm --bundle
# Output: dist/index.js (607KB)
```

## CONFIG (T1_MIMO_INJECTABLE)
```json
{
  "model": "xiaomi-token-plan-sgp/mimo-v2.5-pro",
  "provider": {
    "xiaomi-token-plan-sgp": {
      "npm": "@ai-sdk/openai-compatible",
      "options": {
        "baseURL": "https://token-plan-sgp.xiaomimimo.com/v1",
        "apiKey": "${MIMO_API_KEY}"
      }
    }
  }
}
```
