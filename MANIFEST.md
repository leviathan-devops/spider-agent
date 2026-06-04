# SPIDER v2.3 — RUNTIME GRADE SHIP PACKAGE

**Version:** 2.3.0
**Date:** 2026-06-04
**Status:** ✅ RUNTIME GRADE VERIFIED

## Contents
- dist/index.js — Built bundle (607KB, bun build)
- src/ — Full source tree (54 files, 13,489 lines)
- evidence/ — Test results and TUI evidence
- engine-fixes/ — Patched source files (P2, P11, spiderweb-engine, spiderweb-types)
- hive-context/ — Context docs for recovery
- config/ — Reference config per T1_MIMO_INJECTABLE

## Quick Deploy
```bash
# If using 7 plugins:
cp dist/index.js ~/.config/opencode/plugins/spider-agent-v2/dist/index.js

# Config: see hive-context/T1_MIMO_INJECTABLE.md
```

## Build
```bash
bun build src/index.ts --outdir dist --target bun --format esm --bundle
```

## Verification
```bash
node -e "import('./dist/index.js').then(async m => { 
  const h = await m.default({}); 
  console.log('OK:', Object.keys(h.tool).length, 'tools,', 
    Object.keys(h).filter(k => k!=='tool'&&k!=='config').length, 'hooks'); 
})"
```
