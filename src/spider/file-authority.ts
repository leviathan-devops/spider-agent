/**
 * file-authority.ts — Spider v2.3 File Write Authority
 *
 * Controls which files each agent type is allowed to read, write,
 * and delete.  Every file operation must pass through these checks.
 *
 * BUG FIX vs v2.2.2:
 *   SPIDER-003: checkFileAuthority now implements FULL read/write/delete/
 *               block/denyDelete checking instead of only checking denyDelete.
 *               The v2.2.2 implementation (lines 63-74) only looked at
 *               denyDelete, allowing agents to write to blocked paths and
 *               read from restricted locations.
 */

import type { FileAuthority, SpiderAgentProfile } from './state.js';

const SPIDER_DIR = '.spider-v2';

export const AGENT_FILE_AUTHORITY: Record<string, FileAuthority> = {
  spider: {
    allowRead: ['.'],
    allowWrite: ['.'],
    blockWrite: [`${SPIDER_DIR}/plan.md`, `${SPIDER_DIR}/plan.json`],
    denyDelete: [],
  },
  spider_explorer: {
    allowRead: ['.'],
    allowWrite: [],
    blockWrite: ['.'],
    denyDelete: [SPIDER_DIR],
  },
  spider_architect: {
    allowRead: ['.'],
    allowWrite: [SPIDER_DIR],
    blockWrite: ['src/', 'tests/'],
    denyDelete: ['src/', 'tests/'],
  },
  spider_coder: {
    allowRead: ['.'],
    allowWrite: ['src/', 'tests/', 'docs/'],
    blockWrite: [SPIDER_DIR],
    denyDelete: [SPIDER_DIR],
  },
  spider_reviewer: {
    allowRead: ['.'],
    allowWrite: [`${SPIDER_DIR}/evidence/`],
    blockWrite: ['src/', 'tests/'],
    denyDelete: ['src/'],
  },
  spider_test_engineer: {
    allowRead: ['.'],
    allowWrite: ['tests/', `${SPIDER_DIR}/evidence/`],
    blockWrite: ['src/'],
    denyDelete: ['src/'],
  },
  spider_critic: {
    allowRead: ['.'],
    allowWrite: [`${SPIDER_DIR}/evidence/`],
    blockWrite: ['src/', 'tests/'],
    denyDelete: ['src/', 'tests/'],
  },
};

// ---------------------------------------------------------------------------
// Path matching
// ---------------------------------------------------------------------------

function pathMatchesRule(filePath: string, rule: string): boolean {
  const normalized = filePath.replace(/\/+$/, '');
  const normalizedRule = rule.replace(/\/+$/, '');

  // '.' matches everything
  if (normalizedRule === '.') return true;

  // Exact match
  if (normalized === normalizedRule) return true;

  // Prefix match: rule 'src/' matches 'src/foo.ts', 'src/bar/baz.ts'
  const segRule = normalizedRule.endsWith('/') ? normalizedRule : normalizedRule + '/';
  if (normalized.startsWith(segRule)) return true;

  return false;
}

// ---------------------------------------------------------------------------
// Authority checks — SPIDER-003 FIX: full read/write/delete checking
// ---------------------------------------------------------------------------

export type FileOperation = 'read' | 'write' | 'delete';

export interface AuthorityCheckResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Check whether an agent is allowed to perform a file operation.
 *
 * SPIDER-003 FIX: This now implements the FULL permission model:
 *
 *   READ:
 *     - Must match at least one allowRead rule
 *
 *   WRITE:
 *     - Must NOT match any blockWrite rule (hard block)
 *     - Must match at least one allowWrite rule
 *
 *   DELETE:
 *     - Must NOT match any denyDelete rule (hard deny)
 *     - Must NOT match any blockWrite rule (deletion is a write-like operation)
 *     - Must match at least one allowWrite rule (if you can't write, you can't delete)
 */
export function checkFileAuthority(
  agentName: string,
  filePath: string,
  operation: FileOperation = 'write',
): AuthorityCheckResult {
  const authority = AGENT_FILE_AUTHORITY[agentName];
  if (!authority) {
    return {
      allowed: false,
      reason: `no authority rules for agent '${agentName}' — access denied by default`,
    };
  }

  switch (operation) {
    // ── READ ────────────────────────────────────────────────────────────
    case 'read': {
      const allowed = authority.allowRead.some(rule => pathMatchesRule(filePath, rule));
      if (!allowed) {
        return {
          allowed: false,
          reason: `read access denied for ${filePath} — not in allowRead list for ${agentName}`,
        };
      }
      return { allowed: true };
    }

    // ── WRITE ───────────────────────────────────────────────────────────
    case 'write': {
      // Hard block first
      const blocked = authority.blockWrite.some(rule => pathMatchesRule(filePath, rule));
      if (blocked) {
        return {
          allowed: false,
          reason: `write access BLOCKED for ${filePath} — matches blockWrite rule for ${agentName}`,
        };
      }

      // Must be in allowWrite
      const allowed = authority.allowWrite.some(rule => pathMatchesRule(filePath, rule));
      if (!allowed) {
        return {
          allowed: false,
          reason: `write access denied for ${filePath} — not in allowWrite list for ${agentName}`,
        };
      }

      return { allowed: true };
    }

    // ── DELETE ──────────────────────────────────────────────────────────
    case 'delete': {
      // Hard deny on denyDelete
      const denied = authority.denyDelete.some(rule => pathMatchesRule(filePath, rule));
      if (denied) {
        return {
          allowed: false,
          reason: `delete access DENIED for ${filePath} — matches denyDelete rule for ${agentName}`,
        };
      }

      // blockWrite also blocks deletion (deletion is a destructive write)
      const blocked = authority.blockWrite.some(rule => pathMatchesRule(filePath, rule));
      if (blocked) {
        return {
          allowed: false,
          reason: `delete access BLOCKED for ${filePath} — matches blockWrite rule for ${agentName}`,
        };
      }

      // Must be in allowWrite (if you can't write, you can't delete)
      const allowed = authority.allowWrite.some(rule => pathMatchesRule(filePath, rule));
      if (!allowed) {
        return {
          allowed: false,
          reason: `delete access denied for ${filePath} — not in allowWrite list for ${agentName}`,
        };
      }

      return { allowed: true };
    }

    default:
      return {
        allowed: false,
        reason: `unknown file operation: ${operation}`,
      };
  }
}

/**
 * Convenience wrapper: check write authority for an agent.
 */
export function checkWriteAuthority(agentName: string, filePath: string): AuthorityCheckResult {
  return checkFileAuthority(agentName, filePath, 'write');
}

/**
 * Convenience wrapper: check delete authority for an agent.
 */
export function checkDeleteAuthority(agentName: string, filePath: string): AuthorityCheckResult {
  return checkFileAuthority(agentName, filePath, 'delete');
}

/**
 * Convenience wrapper: check read authority for an agent.
 */
export function checkReadAuthority(agentName: string, filePath: string): AuthorityCheckResult {
  return checkFileAuthority(agentName, filePath, 'read');
}
