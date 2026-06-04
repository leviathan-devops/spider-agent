# T1 MiMo v2.5 Pro — Retard-Proof Injectable
**Updated:** 2026-05-31
**Verified working:** Kraken triple-plugin container test, agent showed full multi-brain identity

## THE ONLY CONFIG THAT WORKS

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
  },
  "plugin": ["file:///root/.config/opencode/plugins/PLUGIN_NAME/dist/index.js"],
  "agent": {"AGENT_NAME": {"name": "AGENT_NAME", "mode": "primary", "tools": {}}},
  "permission": {"*": {"*": "allow"}}
}
```

## COPY-PASTE DEPLOY (< 2 min)

Replace PLUGIN_NAME and AGENT_NAME, then run:

```bash
PROJECT="test-$(date +%m%d%H%M%S)"
SNAP="/tmp/snap-${PROJECT}"
mkdir -p "$SNAP/plugins/PLUGIN_NAME/dist"
cp /path/to/dist/index.js "$SNAP/plugins/PLUGIN_NAME/dist/"

cat > "$SNAP/opencode.json" << 'EOF'
PASTE THE CONFIG ABOVE HERE
EOF

docker rm -f test-$PROJECT 2>/dev/null
docker run -d --rm --name "test-$PROJECT" --entrypoint "" \
  -v "$SNAP:/root/.config/opencode" \
  opencode-test:1.14.34 \
  /bin/sh -c '/usr/local/lib/node_modules/opencode-ai/node_modules/opencode-linux-x64-baseline/bin/opencode --agent AGENT_NAME 2>&1; sleep 3600'

sleep 28
tmux kill-session -t "test-$PROJECT" 2>/dev/null
tmux new-session -d -s "test-$PROJECT" -x 200 -y 50 \
  "docker exec -it test-$PROJECT /usr/local/lib/node_modules/opencode-ai/node_modules/opencode-linux-x64-baseline/bin/opencode --agent AGENT_NAME 2>&1; sleep 60"
sleep 8
tmux send-keys -t "test-$PROJECT" Escape
sleep 2
tmux send-keys -t "test-$PROJECT" "who are you" Enter
sleep 30
tmux capture-pane -t "test-$PROJECT" -p -S -50
```

## VERIFY THESE 4 THINGS

1. Status bar shows: `AgentName · MiMo-V2.5-Pro Xiaomi Token Plan (Singapore)`
2. Agent responds with correct identity (NOT "opencode" or "Big Pickle")
3. Plugin tools appear in logs: `service=tool.registry status=started tool_name`
4. No "Invalid API Key" error

## IF IT SHOWS "Invalid API Key"

You did ONE of these wrong:
- baseURL/apiKey flat under provider instead of inside `provider.options` → FIX: wrap in `"options": {...}`
- Missing `"npm": "@ai-sdk/openai-compatible"` in provider → FIX: add it
- Model inside provider block → FIX: model goes at TOP LEVEL

## IF IT SHOWS "Big Pickle" INSTEAD OF MIMO

The `npm` package isn't installed in the container image. Run inside container:
```bash
cd /usr/local/lib/node_modules/opencode-ai && npm install @ai-sdk/openai-compatible
```
Then commit the image: `docker commit CONTAINER opencode-test:1.14.34`

## AVAILABLE MODELS

- `mimo-v2.5-pro` — best quality, reasoning model
- `mimo-v2-flash` — fast, cheap
- `mimo-v2-pro` — good quality
- `mimo-v2-omni` — multimodal

## KEY RULES

- Model at TOP LEVEL of JSON, NOT inside provider
- Provider MUST have `"npm": "@ai-sdk/openai-compatible"`
- baseURL and apiKey go INSIDE `provider.xiaomi-token-plan-sgp.options`
- Plugin paths use `file:///` URI scheme
- Snapshot to `/tmp/snap-*`, NEVER mount host config
- Binary: `opencode-linux-x64-baseline/bin/opencode` (NOT wrapper, NOT musl)
- Image: `opencode-test:1.14.34`
