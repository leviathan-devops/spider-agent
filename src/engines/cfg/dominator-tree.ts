import type { CFGBlock, CFGResult } from './cfg-builder.js';

// ── Public types ──────────────────────────────────────────────────────────────

export interface DominatorTree {
  idom: Map<number, number>;                // immediate dominators
  postDom: Map<number, number>;             // immediate post-dominators
  dominanceFrontier: Map<number, number[]>; // dominance frontiers
}

// ── Cooper-Harvey-Kennedy dominator computation ───────────────────────────────

/** Compute reverse postorder of the CFG starting from `startId`. */
function reversePostorder(cfg: CFGResult, startId: number): number[] {
  const visited = new Set<number>();
  const postOrder: number[] = [];
  const blockMap = new Map(cfg.blocks.map(b => [b.id, b]));

  function dfs(id: number): void {
    if (visited.has(id)) return;
    visited.add(id);
    const block = blockMap.get(id);
    if (!block) return;
    for (const succ of block.successors) {
      dfs(succ);
    }
    postOrder.push(id);
  }

  dfs(startId);

  // Reverse the postorder to get reverse postorder
  postOrder.reverse();
  return postOrder;
}

/** Compute reverse postorder on the reversed CFG (successors ↔ predecessors). */
function reversePostorderReverse(cfg: CFGResult, startId: number): number[] {
  const visited = new Set<number>();
  const postOrder: number[] = [];
  const blockMap = new Map(cfg.blocks.map(b => [b.id, b]));

  function dfs(id: number): void {
    if (visited.has(id)) return;
    visited.add(id);
    const block = blockMap.get(id);
    if (!block) return;
    // On reversed CFG, follow predecessors instead of successors
    for (const pred of block.predecessors) {
      dfs(pred);
    }
    postOrder.push(id);
  }

  dfs(startId);
  postOrder.reverse();
  return postOrder;
}

/** Intersect two dominator sets represented as maps from block → immediate
 *  dominator. Walks up the tree to find the lowest common ancestor. */
function intersect(idom: Map<number, number>, b1: number, b2: number): number {
  let finger1 = b1;
  let finger2 = b2;
  while (finger1 !== finger2) {
    while (finger1 > finger2) {
      const parent = idom.get(finger1);
      if (parent === undefined) break;
      finger1 = parent;
    }
    while (finger2 > finger1) {
      const parent = idom.get(finger2);
      if (parent === undefined) break;
      finger2 = parent;
    }
  }
  return finger1;
}

/** Core iterative dominator algorithm (Cooper, Harvey, Kennedy).
 *  `rpo` is the reverse postorder, `blockIds` is the set of all block ids,
 *  `entryId` is the entry node, and `predsOf` / `succsOf` provide
 *  predecessor / successor lists. */
function computeIdom(
  rpo: number[],
  blockIds: Set<number>,
  entryId: number,
  predsOf: (id: number) => number[],
  succsOf: (id: number) => number[],
): Map<number, number> {
  const idom = new Map<number, number>();
  const rpoNumber = new Map<number, number>();

  // Assign RPO numbers
  for (let i = 0; i < rpo.length; i++) {
    rpoNumber.set(rpo[i], i);
  }

  // Initialize: entry dominates itself; everything else is uninitialized
  idom.set(entryId, entryId);

  let changed = true;
  let iterations = 0;
  const MAX_ITERATIONS = 200;

  while (changed && iterations < MAX_ITERATIONS) {
    changed = false;
    iterations++;

    for (const b of rpo) {
      if (b === entryId) continue;

      const preds = predsOf(b).filter(p => blockIds.has(p) && idom.has(p));
      if (preds.length === 0) continue;

      let newIdom = preds[0];
      for (let i = 1; i < preds.length; i++) {
        if (idom.has(preds[i]) && idom.has(newIdom)) {
          newIdom = intersect(idom, newIdom, preds[i]);
        }
      }

      if (idom.get(b) !== newIdom) {
        idom.set(b, newIdom);
        changed = true;
      }
    }
  }

  return idom;
}

/** Compute dominance frontiers from immediate dominators and the CFG. */
function computeDominanceFrontier(
  cfg: CFGResult,
  idom: Map<number, number>,
): Map<number, number[]> {
  const frontier = new Map<number, number[]>();
  const blockMap = new Map(cfg.blocks.map(b => [b.id, b]));

  // Initialize
  for (const block of cfg.blocks) {
    frontier.set(block.id, []);
  }

  for (const block of cfg.blocks) {
    const preds = block.predecessors;
    if (preds.length < 2) continue; // Only join nodes contribute to dominance frontiers

    for (const p of preds) {
      let runner = p;
      while (runner !== idom.get(block.id) && runner !== undefined) {
        const current = frontier.get(runner) ?? [];
        if (!current.includes(block.id)) {
          current.push(block.id);
          frontier.set(runner, current);
        }
        const next = idom.get(runner);
        if (next === runner) break; // reached root
        runner = next!;
        if (runner === undefined) break;
      }
    }
  }

  return frontier;
}

// ── Public API ────────────────────────────────────────────────────────────────

export function computeDominators(cfg: CFGResult): DominatorTree {
  const blockIds = new Set(cfg.blocks.map(b => b.id));
  const blockMap = new Map(cfg.blocks.map(b => [b.id, b]));

  // ── Forward dominators ───────────────────────────────────────────────
  const rpo = reversePostorder(cfg, cfg.entryBlockId);
  const idom = computeIdom(
    rpo,
    blockIds,
    cfg.entryBlockId,
    (id) => blockMap.get(id)?.predecessors ?? [],
    (id) => blockMap.get(id)?.successors ?? [],
  );

  // ── Post-dominators (same algorithm on reversed CFG) ─────────────────
  // For post-dominators we treat exit blocks as the "entry" of the reverse
  // graph. If there are multiple exits we create a synthetic single exit.
  const syntheticExitId = -1;
  const augmentedBlocks = cfg.blocks.map(b => ({ ...b })) as CFGBlock[];
  // Add a synthetic exit that all exit blocks point to
  const syntheticExit: CFGBlock = {
    id: syntheticExitId,
    statements: [],
    successors: [],
    predecessors: cfg.exitBlockIds.slice(),
    startPos: -1,
    endPos: -1,
    isEntry: false,
    isExit: true,
    label: 'synthetic-exit',
  };
  for (const exitId of cfg.exitBlockIds) {
    const blk = augmentedBlocks.find(b => b.id === exitId);
    if (blk) blk.successors.push(syntheticExitId);
  }
  augmentedBlocks.push(syntheticExit);

  const revBlockIds = new Set(augmentedBlocks.map(b => b.id));
  const revBlockMap = new Map(augmentedBlocks.map(b => [b.id, b]));
  const revRpo = reversePostorderReverse(
    { blocks: augmentedBlocks, entryBlockId: cfg.entryBlockId, exitBlockIds: [syntheticExitId] },
    syntheticExitId,
  );

  // On the reversed graph, successors ↔ predecessors
  const postDom = computeIdom(
    revRpo,
    revBlockIds,
    syntheticExitId,
    (id) => revBlockMap.get(id)?.successors ?? [],   // in reverse graph, "predecessors" = original successors
    (id) => revBlockMap.get(id)?.predecessors ?? [],  // in reverse graph, "successors" = original predecessors
  );

  // Remove synthetic exit from postDom results (clean up for consumers)
  postDom.delete(syntheticExitId);

  // ── Dominance frontiers ──────────────────────────────────────────────
  const dominanceFrontier = computeDominanceFrontier(cfg, idom);

  return { idom, postDom, dominanceFrontier };
}

/** Does block `a` dominate block `b`? */
export function dominates(idom: Map<number, number>, a: number, b: number): boolean {
  if (a === b) return true;
  let current = b;
  const visited = new Set<number>();
  while (current !== undefined && idom.has(current)) {
    if (visited.has(current)) return false; // cycle safety
    visited.add(current);
    const parent = idom.get(current)!;
    if (parent === a) return true;
    if (parent === current) return false; // root
    current = parent;
  }
  return false;
}

/** Does block `a` post-dominate block `b`? */
export function postDominates(postDom: Map<number, number>, a: number, b: number): boolean {
  if (a === b) return true;
  let current = b;
  const visited = new Set<number>();
  while (current !== undefined && postDom.has(current)) {
    if (visited.has(current)) return false;
    visited.add(current);
    const parent = postDom.get(current)!;
    if (parent === a) return true;
    if (parent === current) return false;
    current = parent;
  }
  return false;
}

// ── Helper functions ──────────────────────────────────────────────────────────

/** Return the full dominator chain from block to root. */
export function getAllDominators(idom: Map<number, number>, blockId: number): number[] {
  const chain: number[] = [];
  let current = blockId;
  const visited = new Set<number>();
  while (current !== undefined && idom.has(current)) {
    if (visited.has(current)) break;
    visited.add(current);
    const parent = idom.get(current)!;
    chain.push(parent);
    if (parent === current) break; // root dominates itself
    current = parent;
  }
  return chain;
}

/** Return the full post-dominator chain from block to root. */
export function getAllPostDominators(postDom: Map<number, number>, blockId: number): number[] {
  const chain: number[] = [];
  let current = blockId;
  const visited = new Set<number>();
  while (current !== undefined && postDom.has(current)) {
    if (visited.has(current)) break;
    visited.add(current);
    const parent = postDom.get(current)!;
    chain.push(parent);
    if (parent === current) break;
    current = parent;
  }
  return chain;
}

/** Is `to` reachable from `from` in the CFG? BFS with visited set. */
export function isReachable(cfg: CFGResult, from: number, to: number): boolean {
  if (from === to) return true;
  const blockMap = new Map(cfg.blocks.map(b => [b.id, b]));
  const visited = new Set<number>();
  const queue: number[] = [from];
  visited.add(from);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const block = blockMap.get(current);
    if (!block) continue;
    for (const succ of block.successors) {
      if (succ === to) return true;
      if (!visited.has(succ)) {
        visited.add(succ);
        queue.push(succ);
      }
    }
  }

  return false;
}
