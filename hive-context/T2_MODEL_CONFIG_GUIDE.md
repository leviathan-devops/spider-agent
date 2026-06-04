# MODEL CONFIG GUIDE — Universal Container Setup

**Default:** `xiaomi-token-plan-sgp/mimo-v2.5-pro` (paid credits — milk it)
**Free fallbacks:** OpenRouter, OpenCode Zen, Google Direct
**BANNED:** minimax, deepseek direct API, xlam2, any paid API except MiMo

---

## Config Template (Works For All 4 Providers)

```json
{
  "model": "PROVIDER/MODEL_NAME",
  "provider": {
    "xiaomi-token-plan-sgp": {
      "npm": "@ai-sdk/openai-compatible",
      "options": {
        "baseURL": "https://token-plan-sgp.xiaomimimo.com/v1",
        "apiKey": "tp-ssy5nlzfc5vccack4ccierszbs0fojjp0lp3uj37hlp328ci"
      }
    },
    "openrouter": {
      "npm": "@ai-sdk/openai-compatible",
      "options": {
        "baseURL": "https://openrouter.ai/api/v1",
        "apiKey": "YOUR_OPENROUTER_KEY"
      }
    },
    "opencode-zen": {
      "npm": "@ai-sdk/openai-compatible",
      "options": {
        "baseURL": "https://zen.opencode.ai/v1",
        "apiKey": "YOUR_ZEN_KEY"
      }
    },
    "google": {
      "npm": "@ai-sdk/google",
      "options": {
        "apiKey": "YOUR_GOOGLE_API_KEY"
      }
    }
  },
  "plugin": ["file:///root/.config/opencode/plugins/PLUGIN_NAME/dist/index.js"],
  "agent": {
    "AGENT_NAME": {
      "name": "AGENT_NAME",
      "mode": "primary",
      "tools": {}
    }
  },
  "permission": {"*": {"*": "allow"}}
}
```

**Critical rules:**
- `model` at TOP LEVEL (not inside provider)
- Each provider has `"npm": "@ai-sdk/openai-compatible"` (except google which uses `@ai-sdk/google`)
- `baseURL` and `apiKey` go INSIDE `provider.options`
- `tools` as OBJECT `{}` not array `[]`
- `agent` block with `mode: "primary"` required for tab toggle
- `permission` block for full access

---

## MIMO (Default — Paid Credits)

```
Provider: xiaomi-token-plan-sgp
Model:    xiaomi-token-plan-sgp/mimo-v2.5-pro
API Key:  tp-ssy5nlzfc5vccack4ccierszbs0fojjp0lp3uj37hlp328ci
Base URL: https://token-plan-sgp.xiaomimimo.com/v1
Status:   PAID — milk while credits last
```

```json
{
  "model": "xiaomi-token-plan-sgp/mimo-v2.5-pro",
  "provider": {
    "xiaomi-token-plan-sgp": {
      "npm": "@ai-sdk/openai-compatible",
      "options": {
        "baseURL": "https://token-plan-sgp.xiaomimimo.com/v1",
        "apiKey": "tp-ssy5nlzfc5vccack4ccierszbs0fojjp0lp3uj37hlp328ci"
      }
    }
  }
}
```

**Best for:** All testing. Primary default. Use this first for everything.

---

## OpenRouter (Free Tier Only)

```
Provider: openrouter
Free models:
  - openrouter/deepseek-v4-flash-free   (fast, smart, good for most tasks)
  - openrouter/nemotron-3-super-free    (smarter, slower — default when deepseek is too dumb)
Base URL: https://openrouter.ai/api/v1
```

```json
{
  "model": "openrouter/deepseek-v4-flash-free",
  "provider": {
    "openrouter": {
      "npm": "@ai-sdk/openai-compatible",
      "options": {
        "baseURL": "https://openrouter.ai/api/v1",
        "apiKey": "YOUR_OPENROUTER_KEY"
      }
    }
  }
}
```

**Best for:** Fallback when MiMo credits are depleted. Default to deepseek-v4-flash-free, switch to nemotron-3-super-free when smarter reasoning is needed.

---

## OpenCode Zen (Free Tier Only)

```
Provider: opencode-zen
Free models:
  - opencode-zen/deepseek-v4-flash-free  (same model, different endpoint)
  - opencode-zen/nemotron-3-super-free
Base URL: https://zen.opencode.ai/v1
```

```json
{
  "model": "opencode-zen/deepseek-v4-flash-free",
  "provider": {
    "opencode-zen": {
      "npm": "@ai-sdk/openai-compatible",
      "options": {
        "baseURL": "https://zen.opencode.ai/v1",
        "apiKey": "YOUR_ZEN_KEY"
      }
    }
  }
}
```

**Best for:** Secondary fallback. Same models as OpenRouter. Use when OpenRouter rate-limits.

---

## Google Direct (Free Tier — Gemma 4)

```
Provider: google
Free models:
  - google/Gemma-4-26b          ★ MOST RELIABLE — rarely rate-limited, dumb enough for anti-retard testing
  - google/Gemma-4-31b          Smarter but gets rate-limited faster
  - google/gemini-2.5-flash     Smartest free option but rate-limited quickest
Base URL: uses @ai-sdk/google (different npm package!)
```

```json
{
  "model": "google/Gemma-4-26b",
  "provider": {
    "google": {
      "npm": "@ai-sdk/google",
      "options": {
        "apiKey": "YOUR_GOOGLE_API_KEY"
      }
    }
  }
}
```

**Best for:** Anti-retard system testing where you need a model that reliably follows instructions without being too smart. Gemma 4 26b is the sweet spot. Gemma 4 31b or Gemini when you need actual reasoning.

**Warning:** Google free tier rate-limits aggressively. Gemma 4 26b is the most resilient. Switch models when you hit limits.

---

## Model Selection Quick Reference

| Use Case | Model | Provider |
|---|---|---|
| Default — everything | `xiaomi-token-plan-sgp/mimo-v2.5-pro` | MiMo (paid) |
| Fast free fallback | `openrouter/deepseek-v4-flash-free` | OpenRouter |
| Smarter free fallback | `openrouter/nemotron-3-super-free` | OpenRouter |
| OpenRouter rate-limited | `opencode-zen/deepseek-v4-flash-free` | OpenCode Zen |
| Anti-retard testing | `google/Gemma-4-26b` | Google Direct |
| Need reasoning (may rate-limit) | `google/Gemma-4-31b` or `google/gemini-2.5-flash` | Google Direct |

## Banned Providers (Never Use)

| Provider | Reason |
|---|---|
| `minimax/*` | Deprecated, paid, removed from hive |
| `deepseek/*` (direct API) | Paid directly — use free tiers via OpenRouter/OpenCode Zen |
| `xlam2/*` | Deprecated, experimental, removed from hive |
| Any paid API | MiMo is the only permitted paid provider |
