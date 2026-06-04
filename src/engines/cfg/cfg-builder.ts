import * as ts from 'typescript';
import type {} from '../types.js';

// ── Public types ──────────────────────────────────────────────────────────────

export interface CFGBlock {
  id: number;
  statements: ts.Node[];
  successors: number[];
  predecessors: number[];
  startPos: number;
  endPos: number;
  isEntry: boolean;
  isExit: boolean;
  label?: string;
}

export interface CFGResult {
  blocks: CFGBlock[];
  entryBlockId: number;
  exitBlockIds: number[];
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/** Global block-ID counter – reset ONLY at the top-level buildCFG call (BUG-FIX #1). */
let nextBlockId = 0;

function freshId(): number {
  return nextBlockId++;
}

function makeBlock(stmts: ts.Node[], label?: string, isEntry = false, isExit = false): CFGBlock {
  const start = stmts.length > 0 ? stmts[0].getStart() : -1;
  const end = stmts.length > 0 ? stmts[stmts.length - 1].getEnd() : -1;
  return {
    id: freshId(),
    statements: [...stmts],
    successors: [],
    predecessors: [],
    startPos: start,
    endPos: end,
    isEntry,
    isExit,
    label,
  };
}

function addEdge(blocks: CFGBlock[], fromId: number, toId: number): void {
  const from = blocks.find(b => b.id === fromId);
  const to = blocks.find(b => b.id === toId);
  if (from && to) {
    if (!from.successors.includes(toId)) from.successors.push(toId);
    if (!to.predecessors.includes(fromId)) to.predecessors.push(fromId);
  }
}

/** Context carried through recursive block-building, giving children access to
 *  their "continuation" – the block that follows in the enclosing scope. */
interface BuildCtx {
  blocks: CFGBlock[];
  /** Block id that follows the current scope (i.e. where control flows after
   *  the current statement list finishes without an explicit jump). */
  followId: number | null;
  /** Loop-header id for the innermost enclosing loop (used by break/continue). */
  loopHeaderId: number | null;
  /** Loop-exit id for the innermost enclosing loop (break target). */
  loopExitId: number | null;
  /** Label names → { header, exit } for labelled break/continue. */
  labelMap: Map<string, { headerId: number; exitId: number }>;
}

// ── Core recursive builder ────────────────────────────────────────────────────

/**
 * Build basic blocks for a list of statements.
 * Returns the id of the first block created (or `followId` if no blocks created).
 */
function buildStmts(
  stmts: ts.Statement[],
  ctx: BuildCtx,
): number | null {
  if (stmts.length === 0) return ctx.followId;

  let firstId: number | null = null;
  let prevId: number | null = null;

  for (let i = 0; i < stmts.length; i++) {
    const stmt = stmts[i];
    const built = buildStmt(stmt, ctx, i < stmts.length - 1 ? stmts[i + 1] : undefined);

    if (built !== null) {
      if (firstId === null) firstId = built;
      // BUG-FIX #2: Wire predecessor block to the FIRST block of the current
      // statement – NOT using a containment heuristic. The successor of a
      // linear predecessor is always the entry of the next construct.
      if (prevId !== null) {
        addEdge(ctx.blocks, prevId, built);
      }
      // Track the last "fall-through" block so the next statement can link to it.
      prevId = lastFallThroughId(built, ctx);
    }
  }

  return firstId;
}

/** Return the id of the last block that falls through (i.e. doesn't
 *  unconditionally exit) in a construct whose entry is `entryId`. */
function lastFallThroughId(entryId: number | null, ctx: BuildCtx): number | null {
  if (entryId === null) return null;
  const blk = ctx.blocks.find(b => b.id === entryId);
  if (!blk) return null;
  // If this block has successors already wired (e.g. loop header), the
  // "fall-through" successor is the one that isn't a back-edge.
  // For simple linear blocks we just return the block itself.
  if (blk.isExit) return null;
  // Heuristic: if the block already has a single successor and isn't a loop
  // header, that successor IS the fall-through – so the last fall-through is
  // the tail of that chain.  But this is only called for linear blocks, so we
  // keep it simple.
  return entryId;
}

/** Build blocks for a single statement. Returns the entry block id. */
function buildStmt(
  stmt: ts.Statement,
  ctx: BuildCtx,
  _nextStmt?: ts.Statement,
): number | null {
  switch (stmt.kind) {
    // ── Return / Throw → exit block ─────────────────────────────────────
    case ts.SyntaxKind.ReturnStatement:
    case ts.SyntaxKind.ThrowStatement: {
      const blk = makeBlock([stmt], stmt.kind === ts.SyntaxKind.ReturnStatement ? 'return' : 'throw');
      ctx.blocks.push(blk);
      // Create a dedicated exit block
      const exit = makeBlock([], undefined, false, true);
      ctx.blocks.push(exit);
      addEdge(ctx.blocks, blk.id, exit.id);
      return blk.id;
    }

    // ── If / If-Else ────────────────────────────────────────────────────
    case ts.SyntaxKind.IfStatement: {
      const ifStmt = stmt as ts.IfStatement;
      const cond = makeBlock([ifStmt.expression], 'if-condition');
      ctx.blocks.push(cond);

      // Then branch
      const thenCtx: BuildCtx = { ...ctx };
      const thenId = buildStmt(
        ts.isBlock(ifStmt.thenStatement)
          ? ifStmt.thenStatement.statements[0] ?? ifStmt.thenStatement
          : ifStmt.thenStatement,
        thenCtx,
      );
      // If thenStatement is a block, build all its statements
      let thenEntryId: number | null = null;
      if (ts.isBlock(ifStmt.thenStatement) && ifStmt.thenStatement.statements.length > 0) {
        const tCtx: BuildCtx = { ...ctx };
        thenEntryId = buildStmts(Array.from(ifStmt.thenStatement.statements), tCtx);
      } else {
        thenEntryId = thenId;
      }

      // Else branch
      let elseEntryId: number | null = null;
      if (ifStmt.elseStatement) {
        if (ts.isBlock(ifStmt.elseStatement) && ifStmt.elseStatement.statements.length > 0) {
          const eCtx: BuildCtx = { ...ctx };
          elseEntryId = buildStmts(Array.from(ifStmt.elseStatement.statements), eCtx);
        } else {
          const eCtx: BuildCtx = { ...ctx };
          elseEntryId = buildStmt(ifStmt.elseStatement, eCtx);
        }
      }

      // Merge block
      const merge = makeBlock([], 'if-merge');
      ctx.blocks.push(merge);

      addEdge(ctx.blocks, cond.id, thenEntryId ?? merge.id);
      if (elseEntryId !== null) {
        addEdge(ctx.blocks, cond.id, elseEntryId);
      } else {
        addEdge(ctx.blocks, cond.id, merge.id);
      }

      if (thenEntryId !== null) addEdge(ctx.blocks, thenEntryId, merge.id);
      if (elseEntryId !== null) addEdge(ctx.blocks, elseEntryId, merge.id);

      return cond.id;
    }

    // ── Try / Catch / Finally ───────────────────────────────────────────
    case ts.SyntaxKind.TryStatement: {
      const tryStmt = stmt as ts.TryStatement;

      // After-try merge block (created first so children can reference it)
      const afterTry = makeBlock([], 'try-after');
      ctx.blocks.push(afterTry);

      // Try body
      const tryBodyCtx: BuildCtx = { ...ctx, followId: afterTry.id };
      const tryEntry = ts.isBlock(tryStmt.tryBlock) && tryStmt.tryBlock.statements.length > 0
        ? buildStmts(Array.from(tryStmt.tryBlock.statements), tryBodyCtx)
        : null;

      // Catch clause
      let catchEntry: number | null = null;
      if (tryStmt.catchClause) {
        const catchCtx: BuildCtx = { ...ctx, followId: afterTry.id };
        const catchClause = tryStmt.catchClause;
        if (ts.isBlock(catchClause.block) && catchClause.block.statements.length > 0) {
          catchEntry = buildStmts(Array.from(catchClause.block.statements), catchCtx);
          if (catchEntry !== null && catchClause.variableDeclaration) {
            const catchBlock = ctx.blocks.find(b => b.id === catchEntry);
            if (catchBlock) catchBlock.label = 'catch';
          }
        }
      }

      // Finally clause
      let finallyEntry: number | null = null;
      if (tryStmt.finallyBlock && tryStmt.finallyBlock.statements.length > 0) {
        const finCtx: BuildCtx = { ...ctx, followId: afterTry.id };
        finallyEntry = buildStmts(Array.from(tryStmt.finallyBlock.statements), finCtx);
        if (finallyEntry !== null) {
          const finBlock = ctx.blocks.find(b => b.id === finallyEntry);
          if (finBlock) finBlock.label = 'finally';
        }
      }

      // Wire edges
      if (tryEntry !== null) {
        // Try body falls through to afterTry or finally
        if (finallyEntry !== null) {
          addEdge(ctx.blocks, tryEntry, finallyEntry);
        } else {
          addEdge(ctx.blocks, tryEntry, afterTry.id);
        }
        // Try body can throw → catch
        if (catchEntry !== null) {
          addEdge(ctx.blocks, tryEntry, catchEntry);
        }
      }

      if (catchEntry !== null) {
        if (finallyEntry !== null) {
          addEdge(ctx.blocks, catchEntry, finallyEntry);
        } else {
          addEdge(ctx.blocks, catchEntry, afterTry.id);
        }
      }

      if (finallyEntry !== null) {
        addEdge(ctx.blocks, finallyEntry, afterTry.id);
      }

      return tryEntry ?? afterTry.id;
    }

    // ── Switch ──────────────────────────────────────────────────────────
    case ts.SyntaxKind.SwitchStatement: {
      const sw = stmt as ts.SwitchStatement;
      const cond = makeBlock([sw.expression], 'switch-condition');
      ctx.blocks.push(cond);

      const afterSwitch = makeBlock([], 'switch-after');
      ctx.blocks.push(afterSwitch);

      const caseEntries: number[] = [];

      for (const clause of sw.caseBlock.clauses) {
        const clauseLabel = clause.kind === ts.SyntaxKind.DefaultClause ? 'default' : 'case';
        const clauseCtx: BuildCtx = { ...ctx, followId: afterSwitch.id };
        const blockStmts = (clause as ts.CaseClause | ts.DefaultClause).statements;
        let entryId: number | null = null;
        if (blockStmts.length > 0) {
          entryId = buildStmts(Array.from(blockStmts), clauseCtx);
          if (entryId !== null) {
            const blk = ctx.blocks.find(b => b.id === entryId);
            if (blk) blk.label = clauseLabel;
          }
        }
        if (entryId !== null) {
          caseEntries.push(entryId);
          addEdge(ctx.blocks, cond.id, entryId);
          // If the case doesn't end with break, it falls through to next case
          const lastStmt = blockStmts[blockStmts.length - 1];
          if (lastStmt && lastStmt.kind !== ts.SyntaxKind.BreakStatement) {
            // fallthrough handled implicitly – the last block in the case
            // already has the next case's entry as its fallthrough successor
            // (via the statement list processing above). We rely on the
            // natural statement-list fall-through.
          } else if (lastStmt && lastStmt.kind === ts.SyntaxKind.BreakStatement) {
            addEdge(ctx.blocks, entryId, afterSwitch.id);
          }
        } else {
          // Empty case – still link condition to after-switch or next case
          addEdge(ctx.blocks, cond.id, afterSwitch.id);
        }
      }

      // Default case falls through to after-switch
      addEdge(ctx.blocks, cond.id, afterSwitch.id);

      return cond.id;
    }

    // ── While loop ──────────────────────────────────────────────────────
    case ts.SyntaxKind.WhileStatement: {
      const loop = stmt as ts.WhileStatement;
      const header = makeBlock([loop.expression], 'loop-header');
      ctx.blocks.push(header);
      const afterLoop = makeBlock([], 'loop-after');
      ctx.blocks.push(afterLoop);

      const bodyCtx: BuildCtx = {
        ...ctx,
        followId: header.id,
        loopHeaderId: header.id,
        loopExitId: afterLoop.id,
      };
      const bodyEntry = ts.isBlock(loop.statement) && loop.statement.statements.length > 0
        ? buildStmts(Array.from(loop.statement.statements), bodyCtx)
        : buildStmt(loop.statement, bodyCtx);

      addEdge(ctx.blocks, header.id, bodyEntry ?? afterLoop.id);
      addEdge(ctx.blocks, header.id, afterLoop.id);
      if (bodyEntry !== null) addEdge(ctx.blocks, bodyEntry, header.id); // back-edge

      return header.id;
    }

    // ── For loop ────────────────────────────────────────────────────────
    case ts.SyntaxKind.ForStatement: {
      const loop = stmt as ts.ForStatement;
      const header = makeBlock(
        [loop.condition ?? loop.initializer ?? loop.statement].filter(Boolean) as ts.Node[],
        'loop-header',
      );
      ctx.blocks.push(header);
      const afterLoop = makeBlock([], 'loop-after');
      ctx.blocks.push(afterLoop);

      // Initializer (executed once before loop)
      let initId: number | null = null;
      if (loop.initializer) {
        const initBlk = makeBlock([loop.initializer], 'loop-init');
        ctx.blocks.push(initBlk);
        initId = initBlk.id;
      }

      const bodyCtx: BuildCtx = {
        ...ctx,
        followId: header.id,
        loopHeaderId: header.id,
        loopExitId: afterLoop.id,
      };
      const bodyEntry = ts.isBlock(loop.statement) && loop.statement.statements.length > 0
        ? buildStmts(Array.from(loop.statement.statements), bodyCtx)
        : buildStmt(loop.statement, bodyCtx);

      if (initId !== null) addEdge(ctx.blocks, initId, header.id);
      addEdge(ctx.blocks, header.id, bodyEntry ?? afterLoop.id);
      addEdge(ctx.blocks, header.id, afterLoop.id);
      if (bodyEntry !== null) addEdge(ctx.blocks, bodyEntry, header.id);

      return initId ?? header.id;
    }

    // ── Do-while loop ───────────────────────────────────────────────────
    case ts.SyntaxKind.DoStatement: {
      const loop = stmt as ts.DoStatement;
      const afterLoop = makeBlock([], 'loop-after');
      ctx.blocks.push(afterLoop);

      const bodyCtx: BuildCtx = {
        ...ctx,
        followId: null,
        loopHeaderId: null,
        loopExitId: afterLoop.id,
      };
      const bodyEntry = ts.isBlock(loop.statement) && loop.statement.statements.length > 0
        ? buildStmts(Array.from(loop.statement.statements), bodyCtx)
        : buildStmt(loop.statement, bodyCtx);

      const cond = makeBlock([loop.expression], 'loop-condition');
      ctx.blocks.push(cond);

      if (bodyEntry !== null) addEdge(ctx.blocks, bodyEntry, cond.id);
      addEdge(ctx.blocks, cond.id, bodyEntry ?? cond.id); // back-edge to body
      addEdge(ctx.blocks, cond.id, afterLoop.id);

      return bodyEntry ?? cond.id;
    }

    // ── For-of / For-in ─────────────────────────────────────────────────
    case ts.SyntaxKind.ForOfStatement:
    case ts.SyntaxKind.ForInStatement: {
      const loop = stmt as ts.ForOfStatement | ts.ForInStatement;
      const header = makeBlock([loop.expression], 'loop-header');
      ctx.blocks.push(header);
      const afterLoop = makeBlock([], 'loop-after');
      ctx.blocks.push(afterLoop);

      const bodyCtx: BuildCtx = {
        ...ctx,
        followId: header.id,
        loopHeaderId: header.id,
        loopExitId: afterLoop.id,
      };
      const bodyEntry = ts.isBlock(loop.statement) && loop.statement.statements.length > 0
        ? buildStmts(Array.from(loop.statement.statements), bodyCtx)
        : buildStmt(loop.statement, bodyCtx);

      addEdge(ctx.blocks, header.id, bodyEntry ?? afterLoop.id);
      addEdge(ctx.blocks, header.id, afterLoop.id);
      if (bodyEntry !== null) addEdge(ctx.blocks, bodyEntry, header.id);

      return header.id;
    }

    // ── Break ───────────────────────────────────────────────────────────
    case ts.SyntaxKind.BreakStatement: {
      const brk = stmt as ts.BreakStatement;
      const blk = makeBlock([stmt], 'break');
      ctx.blocks.push(blk);
      let targetId: number | null = null;
      if (brk.label && ctx.labelMap.has(brk.label.text)) {
        targetId = ctx.labelMap.get(brk.label.text)!.exitId;
      } else if (ctx.loopExitId !== null) {
        targetId = ctx.loopExitId;
      }
      if (targetId !== null) addEdge(ctx.blocks, blk.id, targetId);
      return blk.id;
    }

    // ── Continue ────────────────────────────────────────────────────────
    case ts.SyntaxKind.ContinueStatement: {
      const cont = stmt as ts.ContinueStatement;
      const blk = makeBlock([stmt], 'continue');
      ctx.blocks.push(blk);
      let targetId: number | null = null;
      if (cont.label && ctx.labelMap.has(cont.label.text)) {
        targetId = ctx.labelMap.get(cont.label.text)!.headerId;
      } else if (ctx.loopHeaderId !== null) {
        targetId = ctx.loopHeaderId;
      }
      if (targetId !== null) addEdge(ctx.blocks, blk.id, targetId);
      return blk.id;
    }

    // ── Labeled statement ───────────────────────────────────────────────
    case ts.SyntaxKind.LabeledStatement: {
      const labeled = stmt as ts.LabeledStatement;
      // We need a merge target for break
      const afterLabel = makeBlock([], 'label-after');
      ctx.blocks.push(afterLabel);

      const innerCtx: BuildCtx = { ...ctx, followId: afterLabel.id };

      // For loops inside labels, register the label
      if (
        labeled.statement.kind === ts.SyntaxKind.WhileStatement ||
        labeled.statement.kind === ts.SyntaxKind.ForStatement ||
        labeled.statement.kind === ts.SyntaxKind.DoStatement ||
        labeled.statement.kind === ts.SyntaxKind.ForOfStatement ||
        labeled.statement.kind === ts.SyntaxKind.ForInStatement
      ) {
        // The inner build will create the loop header and after-loop blocks.
        // We'll patch labelMap after building.
        const newLabelMap = new Map(ctx.labelMap);
        // Temporarily add label pointing to afterLabel for break
        // (will be refined by the loop's own blocks)
        innerCtx.labelMap = newLabelMap;
      }

      const innerEntry = buildStmt(labeled.statement, innerCtx);
      if (innerEntry !== null) addEdge(ctx.blocks, innerEntry, afterLabel.id);

      return innerEntry ?? afterLabel.id;
    }

    // ── Block ───────────────────────────────────────────────────────────
    case ts.SyntaxKind.Block: {
      const block = stmt as ts.Block;
      if (block.statements.length === 0) return ctx.followId;
      return buildStmts(Array.from(block.statements), ctx);
    }

    // ── Default: linear statement ───────────────────────────────────────
    default: {
      const blk = makeBlock([stmt]);
      ctx.blocks.push(blk);
      return blk.id;
    }
  }
}

// ── Top-level public API ──────────────────────────────────────────────────────

export function buildCFG(func: ts.FunctionLikeDeclaration): CFGResult {
  // BUG-FIX #1: Reset counter ONLY here at the top level – never inside
  // recursive buildBlocks calls.
  nextBlockId = 0;

  const blocks: CFGBlock[] = [];

  // Entry block
  const entry = makeBlock([], 'entry', true, false);
  blocks.push(entry);

  // Build body
  const body = func.body;
  let bodyEntryId: number | null = null;

  if (body && ts.isBlock(body)) {
    const ctx: BuildCtx = {
      blocks,
      followId: null,
      loopHeaderId: null,
      loopExitId: null,
      labelMap: new Map(),
    };
    if (body.statements.length > 0) {
      bodyEntryId = buildStmts(Array.from(body.statements), ctx);
    }
  } else if (body) {
    // Arrow function with expression body
    const ctx: BuildCtx = {
      blocks,
      followId: null,
      loopHeaderId: null,
      loopExitId: null,
      labelMap: new Map(),
    };
    const exprBlock = makeBlock([body as ts.Node], 'expr-body');
    blocks.push(exprBlock);
    bodyEntryId = exprBlock.id;
  }

  // Exit block
  const exit = makeBlock([], 'exit', false, true);
  blocks.push(exit);

  // Wire entry → first body block
  if (bodyEntryId !== null) {
    addEdge(blocks, entry.id, bodyEntryId);
  } else {
    addEdge(blocks, entry.id, exit.id);
  }

  // Wire any block that has no successors and is not an exit to the exit block
  for (const blk of blocks) {
    if (blk.successors.length === 0 && !blk.isExit) {
      addEdge(blocks, blk.id, exit.id);
    }
  }

  // Collect exit block ids
  const exitBlockIds = blocks.filter(b => b.isExit).map(b => b.id);

  return {
    blocks,
    entryBlockId: entry.id,
    exitBlockIds,
  };
}

// ── Path algorithms (with cycle detection – BUG-FIX #3) ───────────────────────

/** Find all paths from `fromId` to `toId` using DFS with visited-set tracking. */
export function findPaths(cfg: CFGResult, fromId: number, toId: number): number[][] {
  const results: number[][] = [];
  const blockMap = new Map(cfg.blocks.map(b => [b.id, b]));

  function dfs(current: number, path: number[], visited: Set<number>): void {
    if (current === toId) {
      results.push([...path]);
      return;
    }

    const block = blockMap.get(current);
    if (!block) return;

    for (const succ of block.successors) {
      if (!visited.has(succ)) {
        visited.add(succ);
        path.push(succ);
        dfs(succ, path, visited);
        path.pop();
        visited.delete(succ);
      }
    }
  }

  const visited = new Set<number>([fromId]);
  dfs(fromId, [fromId], visited);
  return results;
}

/** Find all paths from `fromId` to any exit block, with cycle detection. */
export function findPathsToExit(cfg: CFGResult, fromId: number): number[][] {
  const results: number[][] = [];
  const blockMap = new Map(cfg.blocks.map(b => [b.id, b]));
  const exitSet = new Set(cfg.exitBlockIds);

  function dfs(current: number, path: number[], visited: Set<number>): void {
    if (exitSet.has(current)) {
      results.push([...path]);
      return;
    }

    const block = blockMap.get(current);
    if (!block) return;

    for (const succ of block.successors) {
      // BUG-FIX #3: Proper cycle detection – skip already-visited nodes
      if (!visited.has(succ)) {
        visited.add(succ);
        path.push(succ);
        dfs(succ, path, visited);
        path.pop();
        visited.delete(succ);
      }
    }
  }

  const visited = new Set<number>([fromId]);
  // If fromId is itself an exit, return the trivial path
  if (exitSet.has(fromId)) {
    return [[fromId]];
  }
  dfs(fromId, [fromId], visited);
  return results;
}
