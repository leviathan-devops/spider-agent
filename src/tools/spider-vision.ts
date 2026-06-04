/**
 * spider-vision.ts — Spider v2.3 Built-in Visual AI Analysis
 *
 * Wraps the local GLM-4.6V-Flash VLM server directly via HTTP.
 * Self-contained — no dependency on the agent-vision plugin or any other agent.
 *
 * Sends images to the VLM for visual analysis and returns
 * natural language descriptions of what the model sees.
 *
 * Forked from shark-vision (Shark v4.9.8) — proven working architecture.
 */

import { tool } from '@opencode-ai/plugin';
import { z } from 'zod';
import * as fs from 'node:fs';
import * as path from 'node:path';

const VLM_ENDPOINT = 'http://127.0.0.1:8082/v1/chat/completions';
const VLM_HEALTH_ENDPOINT = 'http://127.0.0.1:8082/health';
const VLM_TIMEOUT_MS = 540000;

async function checkVlmHealth(): Promise<{ ok: boolean; version?: string }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const resp = await fetch(VLM_HEALTH_ENDPOINT, { signal: controller.signal });
    clearTimeout(timeout);
    if (!resp.ok) return { ok: false };
    const raw = await resp.json();
    if (typeof raw !== 'object' || raw === null) return { ok: false };
    return { ok: true, version: typeof (raw as any).version === 'string' ? (raw as any).version : undefined };
  } catch {
    return { ok: false };
  }
}

function imageToBase64(imagePath: string): { data: string; mime: string } {
  if (!fs.existsSync(imagePath)) {
    throw new Error(`Image not found: ${imagePath}`);
  }
  const ext = path.extname(imagePath).toLowerCase();
  const mimeMap: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
  };
  const mime = mimeMap[ext] || 'image/png';
  const buf = fs.readFileSync(imagePath);
  return { data: Buffer.from(buf).toString('base64'), mime };
}

async function queryVlm(
  imageBase64: string,
  imageMime: string,
  prompt: string,
  maxTokens: number,
  temperature: number,
): Promise<{ content: string; reasoning: string; tokens: Record<string, unknown> }> {
  const payload = {
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: `data:${imageMime};base64,${imageBase64}` } },
        ],
      },
    ],
    max_tokens: maxTokens,
    temperature,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VLM_TIMEOUT_MS);
  try {
    const resp = await fetch(VLM_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!resp.ok) {
      const body = await resp.text().catch(() => '');
      throw new Error(`VLM request failed (${resp.status}): ${body.slice(0, 200)}`);
    }
    const result = (await resp.json()) as {
      choices?: Array<{ message: { content: string; reasoning_content?: string } }>;
      usage?: Record<string, unknown>;
    };
    const content = result.choices?.[0]?.message?.content || '';
    const reasoning = result.choices?.[0]?.message?.reasoning_content || '';
    const tokens = result.usage || {};
    return { content, reasoning, tokens };
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

export function createSpiderVisionTool() {
  return tool({
    description: 'SPIDER vision — built-in visual AI analysis via GLM-4.6V-Flash VLM. Send an image file path and get a natural language description. Supports png, jpg, gif, webp, bmp. Use for analyzing screenshots, UI renders, diagrams, error screenshots, and visual output. This is YOUR tool — NEVER use manta_vision or shark_vision or any other agent\'s vision tool.',
    args: {
      action: z.enum(['analyze', 'status']).describe('Action: analyze an image, or check VLM server status'),
      image: z.string().optional().describe('Absolute path to the image file (required for analyze action)'),
      prompt: z.string().optional().describe('Custom prompt for vision analysis'),
      max_tokens: z.number().optional().default(1024).describe('Max tokens for response'),
      temperature: z.number().optional().default(0.1).describe('Sampling temperature'),
    },
    execute: async (args) => {
      const { action, image, prompt, max_tokens, temperature } = args;

      if (action === 'status') {
        const health = await checkVlmHealth();
        let vramInfo = 'unavailable';
        try {
          const { execSync } = await import('child_process');
          const nvidiaOut = execSync(
            'nvidia-smi --query-gpu=memory.used,memory.total --format=csv,noheader 2>/dev/null',
            { encoding: 'utf-8', timeout: 5000 },
          ).trim();
          vramInfo = nvidiaOut;
        } catch {}
        return JSON.stringify({
          status: health.ok ? 'online' : 'offline',
          model: 'GLM-4.6V-Flash-Q4_K_M (BeeLlama turbo3_tcq)',
          endpoint: VLM_ENDPOINT,
          version: health.version || null,
          vram: vramInfo,
        }, null, 2);
      }

      if (action === 'analyze') {
        if (!image) {
          return JSON.stringify({ success: false, error: 'image path required for analyze action' });
        }

        const health = await checkVlmHealth();
        if (!health.ok) {
          return JSON.stringify({
            success: false,
            error: 'VLM server is not running. Start it with: systemctl --user start glm-vlm-server.service',
          });
        }

        try {
          const { data: b64, mime } = imageToBase64(image);
          const defaultPrompt = 'Describe this image in detail. What elements, text, colors, and layout do you see? Identify any visual defects, rendering errors, or missing elements.';
          const result = await queryVlm(
            b64,
            mime,
            prompt || defaultPrompt,
            max_tokens ?? 500,
            temperature ?? 0.1,
          );
          return JSON.stringify({
            success: true,
            content: result.content || result.reasoning || '(no response)',
            reasoning: result.reasoning || null,
            tokens: result.tokens,
            model: 'GLM-4.6V-Flash-Q4_K_M',
            imageFile: image,
          }, null, 2);
        } catch (err: any) {
          return JSON.stringify({ success: false, error: err.message, imageFile: image });
        }
      }

      return JSON.stringify({ success: false, error: `Unknown action: ${action}` });
    },
  });
}
