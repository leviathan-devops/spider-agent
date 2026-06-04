/**
 * hive-context.ts — Spider v2.3 Hive Mind Read-Only Access
 *
 * Provides read-only access to the Hive Mind shared storage
 * (~/.local/share/opencode/hive-mind/). Supports reading topics,
 * searching across all .md files, and listing available topics.
 */

import { tool } from '@opencode-ai/plugin';
import { z } from 'zod';
import * as fs from 'node:fs';
import * as path from 'node:path';

function resolveHiveMindRoot(): string {
  if (process.env.HIVE_MIND_PATH && fs.existsSync(process.env.HIVE_MIND_PATH)) {
    return process.env.HIVE_MIND_PATH;
  }
  const homePath = path.join(process.env.HOME || '/root', '.local', 'share', 'opencode', 'hive-mind');
  if (fs.existsSync(homePath)) return homePath;
  const staticPaths = [
    '/root/.local/share/opencode/hive-mind',
    '/home/leviathan/.local/share/opencode/hive-mind',
  ];
  for (const p of staticPaths) {
    if (fs.existsSync(p)) return p;
  }
  return homePath;
}

function listTopics(root: string): string[] {
  const topics: string[] = [];
  const seen = new Set<string>();
  function walk(dir: string, depth: number) {
    if (depth > 3) return;
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch (_err) { return; }
    for (const e of entries) {
      if (e.name.startsWith('.') || e.name.startsWith('_')) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (!seen.has(e.name)) { seen.add(e.name); topics.push(e.name + '/'); }
        walk(full, depth + 1);
      } else if (e.isFile() && e.name.endsWith('.md')) {
        if (!seen.has(e.name)) { seen.add(e.name); topics.push(e.name); }
      }
    }
  }
  walk(root, 0);
  return topics.slice(0, 100);
}

function readSafe(filePath: string): string | null {
  try { return fs.readFileSync(filePath, 'utf-8'); }
  catch (_err) { return null; }
}

const MAX_FILE_CHARS = 8000;
const MAX_TOPIC_CHARS = 30000;

function readTopic(root: string, name: string): { content: string; files: string[] } {
  const files: string[] = [];
  const parts: string[] = [];
  const lower = name.toLowerCase();
  let totalChars = 0;

  const directPath = path.join(root, `${name}.md`);
  if (fs.existsSync(directPath)) {
    const content = readSafe(directPath);
    if (content !== null) {
      files.push(directPath);
      const truncated = content.length > MAX_FILE_CHARS
        ? content.substring(0, MAX_FILE_CHARS) + `\n... [TRUNCATED: ${content.length} total chars]`
        : content;
      parts.unshift(`## ${name}.md\n\n${truncated}`);
      totalChars += truncated.length;
    }
  }

  const directDir = path.join(root, name);
  if (fs.existsSync(directDir) && fs.statSync(directDir).isDirectory()) {
    const subFiles = fs.readdirSync(directDir, { withFileTypes: true })
      .filter(e => e.isFile() && e.name.endsWith('.md'))
      .sort((a, b) => a.name.localeCompare(b.name));
    for (const e of subFiles) {
      if (totalChars >= MAX_TOPIC_CHARS) break;
      const full = path.join(directDir, e.name);
      const content = readSafe(full);
      if (content !== null) {
        files.push(full);
        const avail = MAX_TOPIC_CHARS - totalChars;
        const truncated = content.length > Math.min(MAX_FILE_CHARS, avail)
          ? content.substring(0, Math.min(MAX_FILE_CHARS, avail)) + `\n... [TRUNCATED: ${content.length} total chars]`
          : content;
        parts.push(`## ${full.replace(root, '')}\n\n${truncated}`);
        totalChars += truncated.length;
      }
    }
  }

  if (parts.length === 0) {
    function searchWalk(dir: string, depth: number) {
      if (depth > 4 || totalChars >= MAX_TOPIC_CHARS) return;
      let entries: fs.Dirent[];
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
      catch (_err) { return; }
      for (const e of entries) {
        if (totalChars >= MAX_TOPIC_CHARS) break;
        if (e.name.startsWith('.') || e.name.startsWith('_')) continue;
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
          searchWalk(full, depth + 1);
        } else if (e.isFile() && e.name.endsWith('.md') && e.name.toLowerCase().includes(lower)) {
          const content = readSafe(full);
          if (content !== null) {
            files.push(full);
            const avail = MAX_TOPIC_CHARS - totalChars;
            const truncated = content.length > Math.min(MAX_FILE_CHARS, avail)
              ? content.substring(0, Math.min(MAX_FILE_CHARS, avail)) + `\n... [TRUNCATED: ${content.length} total chars]`
              : content;
            parts.push(`## ${full.replace(root, '')}\n\n${truncated}`);
            totalChars += truncated.length;
          }
        }
      }
    }
    searchWalk(root, 0);
  }

  return { content: parts.join('\n\n---\n\n'), files };
}

function searchHive(root: string, query: string): { file: string; line: number; snippet: string }[] {
  const results: { file: string; line: number; snippet: string }[] = [];
  const lower = query.toLowerCase();
  function walk(dir: string, depth: number) {
    if (depth > 4 || results.length >= 30) return;
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch (_err) { return; }
    for (const e of entries) {
      if (e.name.startsWith('.') || e.name.startsWith('_')) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { walk(full, depth + 1); continue; }
      if (!e.isFile() || !e.name.endsWith('.md')) continue;
      const content = readSafe(full);
      if (!content) continue;
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase().includes(lower)) {
          const start = Math.max(0, i - 1);
          const end = Math.min(lines.length - 1, i + 2);
          results.push({
            file: full.replace(root, ''),
            line: i + 1,
            snippet: lines.slice(start, end + 1).join('\n'),
          });
          if (results.length >= 30) return;
        }
      }
    }
  }
  walk(root, 0);
  return results;
}

export function createHiveContextTool() {
  return tool({
    description: 'Read-only Hive context absorption — load established patterns, failure modes, architecture docs, build chains, TUI testing protocol, plugin engineering knowledge, and more from the Hive Mind shared storage (~/.local/share/opencode/hive-mind/). Supports reading topics, searching across all .md files, and listing available topics. READ ONLY — never writes to Hive.',
    args: {
      action: z.enum(['read', 'search', 'list']).default('read').describe('Action: read a specific topic, search all .md files, or list available topics'),
      topic: z.string().optional().describe('Topic name to read (case-insensitive substring match in filenames and content)'),
      query: z.string().optional().describe('Search query string (required for search action)'),
    },
    execute: async (args) => {
      const root = resolveHiveMindRoot();
      const exists = fs.existsSync(root);

      if (!exists) {
        const checked = [
          process.env.HIVE_MIND_PATH ? `env:HIVE_MIND_PATH=${process.env.HIVE_MIND_PATH}` : null,
          path.join(process.env.HOME || '/root', '.local', 'share', 'opencode', 'hive-mind'),
          '/root/.local/share/opencode/hive-mind',
          '/home/leviathan/.local/share/opencode/hive-mind',
        ].filter(Boolean);
        return JSON.stringify({
          source: 'Hive Mind',
          content: '',
          loaded: false,
          error: `HIVE MIND NOT FOUND. Checked paths: ${checked.join('; ')}. The Hive Mind shared storage does not exist in this environment. This tool CANNOT function without the hive-mind directory. If running in a container, mount the host hive-mind: -v /home/leviathan/.local/share/opencode/hive-mind:/root/.local/share/opencode/hive-mind:ro`,
        }, null, 2);
      }

      const action = args?.action || 'read';

      if (action === 'list') {
        const topics = listTopics(root);
        return JSON.stringify({
          source: `Hive Mind — ${root}`,
          content: topics.join('\n'),
          count: topics.length,
          loaded: true,
        }, null, 2);
      }

      if (action === 'search') {
        if (!args?.query) {
          return JSON.stringify({ error: 'query required for search action' });
        }
        const results = searchHive(root, args.query);
        return JSON.stringify({
          source: `Hive Mind — ${root}`,
          query: args.query,
          matches: results,
          count: results.length,
        }, null, 2);
      }

      if (!args?.topic) {
        return JSON.stringify({ error: 'topic required for read action' });
      }

      const { content, files } = readTopic(root, args.topic);
      return JSON.stringify({
        source: `Hive Mind — ${root}`,
        topic: args.topic,
        content,
        files,
        loaded: content.length > 0,
      }, null, 2);
    },
  });
}
