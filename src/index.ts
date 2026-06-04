/**
 * index.ts — Spider v2.3 Plugin Entry Point
 *
 * Wires together all spider modules:
 *   - State management (state.ts)
 *   - Stage coordinator (coordinator.ts)
 *   - Verification web (verification-web.ts)
 *   - SpiderWeb engine (spiderweb-engine.ts)
 *   - Compaction survival (compaction/compaction-survival.ts)
 *   - Context manager (context-manager.ts)
 *   - Agent definitions (agents/definitions.ts)
 *   - Tool definitions (tools/spider-tools.ts, tools/hive-context.ts, tools/spider-vision.ts)
 *   - Hook definitions (hooks/spider-hooks.ts)
 */

import type { PluginInput, Hooks } from '@opencode-ai/plugin';
import { createSpiderState } from './spider/state.js';
import { SpiderCoordinator } from './spider/coordinator.js';
import { VerificationWeb } from './spider/verification-web.js';
import { SpiderWebEngine } from './spider/spiderweb-engine.js';
import { SPIDER_AGENTS } from './agents/definitions.js';
import { createSpiderTools } from './tools/spider-tools.js';
import { createSpiderHooks } from './hooks/spider-hooks.js';
import { createHiveContextTool } from './tools/hive-context.js';
import { createSpiderVisionTool } from './tools/spider-vision.js';

export default async function SpiderPlugin(input: PluginInput): Promise<Hooks> {
  const state = createSpiderState();
  const coordinator = new SpiderCoordinator(state);
  const verificationWeb = new VerificationWeb();
  const webEngine = new SpiderWebEngine(state);

  const tools = createSpiderTools(state, coordinator, verificationWeb, webEngine);
  const hooks = createSpiderHooks(state, verificationWeb, webEngine);

  return {
    ...hooks,

    tool: {
      ...tools,
      'hive_context': createHiveContextTool(),
      'spider-vision': createSpiderVisionTool(),
    },

    config: async (opencodeConfig: Record<string, any>) => {
      if (!opencodeConfig.agent) {
        opencodeConfig.agent = {};
      }

      const sdkConfigs: Record<string, any> = {};
      for (const agent of SPIDER_AGENTS) {
        sdkConfigs[agent.id] = {
          name: agent.id,
          description: agent.description,
          instructions: agent.instructions,
          mode: agent.mode,
           permission: { task: 'allow', write: 'allow', read: 'allow', edit: 'allow', glob: 'allow', grep: 'allow', bash: 'allow', question: 'allow', webfetch: 'allow', todowrite: 'allow', websearch: 'allow', codesearch: 'allow', skill: 'allow', apply_patch: 'allow', lsp: 'allow', batch: 'allow', 'spider-vision': 'allow', 'vlm_vision': 'allow', 'vlm_status': 'allow', 'vlm_on': 'allow', 'vlm_off': 'allow', 'hive_context': 'allow', 'trident-code-audit': 'allow', 'spider-status': 'allow', 'spider-gate': 'allow', 'spider-evidence': 'allow', 'spider-verify': 'allow', 'spider-checkpoint': 'allow', 'spiderweb': 'allow' },
           tools: {
             'spider-status': true,
             'spider-gate': true,
             'spider-evidence': true,
             'spider-verify': true,
             'spider-checkpoint': true,
             'spiderweb': true,
             'spider-vision': true,
             'hive_context': true,
             'trident-code-audit': true,
             'todowrite': true,
             'websearch': true,
             'codesearch': true,
             'skill': true,
             'apply_patch': true,
             'lsp': true,
             'batch': true,
            'task': true,
            'write': true,
            'read': true,
            'edit': true,
            'glob': true,
            'grep': true,
            'bash': true,
            'question': true,
            'webfetch': true,
            'vlm_vision': true,
            'vlm_status': true,
            'vlm_on': true,
            'vlm_off': true,
          },
        };

        if (agent.mode === 'primary') {
          sdkConfigs[agent.id].color = '#DC2626';
        }
      }

      Object.assign(opencodeConfig.agent, sdkConfigs);
    },
  };
}
