import * as ts from 'typescript';
import type { CFGBlock, CFGResult } from './cfg-builder.js';
import { computeDominators, postDominates } from './dominator-tree.js';
import type { DominatorTree } from './dominator-tree.js';

// ── Public types ──────────────────────────────────────────────────────────────

export interface DFAState {
  hasIO: boolean;
  hasMutation: boolean;
  hasPromise: boolean;
  definedVars: Set<string>;
  liveVars: Set<string>;
  hasTimer: boolean;
  hasTimerCleanup: boolean;
  hasRollback: boolean;
  hasTypeGuard: boolean;
}

export type TransferFunction = (inState: DFAState, block: CFGBlock) => DFAState;
export type JoinFunction = (states: DFAState[]) => DFAState;

// ── DFA state utilities ───────────────────────────────────────────────────────

export function emptyDFAState(): DFAState {
  return {
    hasIO: false,
    hasMutation: false,
    hasPromise: false,
    definedVars: new Set(),
    liveVars: new Set(),
    hasTimer: false,
    hasTimerCleanup: false,
    hasRollback: false,
    hasTypeGuard: false,
  };
}

export function cloneDFAState(s: DFAState): DFAState {
  return {
    hasIO: s.hasIO,
    hasMutation: s.hasMutation,
    hasPromise: s.hasPromise,
    definedVars: new Set(s.definedVars),
    liveVars: new Set(s.liveVars),
    hasTimer: s.hasTimer,
    hasTimerCleanup: s.hasTimerCleanup,
    hasRollback: s.hasRollback,
    hasTypeGuard: s.hasTypeGuard,
  };
}

export function statesEqual(a: DFAState, b: DFAState): boolean {
  return (
    a.hasIO === b.hasIO &&
    a.hasMutation === b.hasMutation &&
    a.hasPromise === b.hasPromise &&
    a.hasTimer === b.hasTimer &&
    a.hasTimerCleanup === b.hasTimerCleanup &&
    a.hasRollback === b.hasRollback &&
    a.hasTypeGuard === b.hasTypeGuard &&
    setsEqual(a.definedVars, b.definedVars) &&
    setsEqual(a.liveVars, b.liveVars)
  );
}

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const v of Array.from(a)) {
    if (!b.has(v)) return false;
  }
  return true;
}

// ── Default join function (union semantics) ───────────────────────────────────

export function defaultJoin(states: DFAState[]): DFAState {
  if (states.length === 0) return emptyDFAState();
  if (states.length === 1) return cloneDFAState(states[0]);

  const result = emptyDFAState();
  result.hasIO = states.some(s => s.hasIO);
  result.hasMutation = states.some(s => s.hasMutation);
  result.hasPromise = states.some(s => s.hasPromise);
  result.hasTimer = states.some(s => s.hasTimer);
  result.hasTimerCleanup = states.some(s => s.hasTimerCleanup);
  result.hasRollback = states.some(s => s.hasRollback);
  result.hasTypeGuard = states.some(s => s.hasTypeGuard);

  for (const s of states) {
    for (const v of Array.from(s.definedVars)) result.definedVars.add(v);
  }

  // Liveness uses intersection semantics
  if (states.length > 0) {
    const first = Array.from(states[0].liveVars);
    for (const v of first) {
      if (states.every(s => s.liveVars.has(v))) {
        result.liveVars.add(v);
      }
    }
  }

  return result;
}

// ── Forward data-flow analysis ────────────────────────────────────────────────

export function forwardDFA(
  cfg: CFGResult,
  transfer: TransferFunction,
  join: JoinFunction,
  initialState: DFAState,
): Map<number, DFAState> {
  const inState = new Map<number, DFAState>();
  const outState = new Map<number, DFAState>();
  const blockMap = new Map(cfg.blocks.map(b => [b.id, b]));

  // Initialize all blocks
  for (const block of cfg.blocks) {
    inState.set(block.id, cloneDFAState(initialState));
    outState.set(block.id, cloneDFAState(initialState));
  }

  // Entry block gets the initial state as its IN
  inState.set(cfg.entryBlockId, cloneDFAState(initialState));
  outState.set(cfg.entryBlockId, transfer(cloneDFAState(initialState), blockMap.get(cfg.entryBlockId)!));

  let changed = true;
  let iterations = 0;
  const MAX_ITERATIONS = 100;

  while (changed && iterations < MAX_ITERATIONS) {
    changed = false;
    iterations++;

    for (const block of cfg.blocks) {
      // IN[n] = join(OUT[p] for all predecessors p)
      const predStates: DFAState[] = [];
      for (const predId of block.predecessors) {
        const predOut = outState.get(predId);
        if (predOut) predStates.push(predOut);
      }

      if (predStates.length > 0) {
        const newIn = join(predStates);
        const currentIn = inState.get(block.id)!;
        if (!statesEqual(newIn, currentIn)) {
          inState.set(block.id, newIn);
          changed = true;
        }
      } else if (block.id === cfg.entryBlockId) {
        inState.set(block.id, cloneDFAState(initialState));
      }

      // OUT[n] = transfer(IN[n], n)
      const newOut = transfer(cloneDFAState(inState.get(block.id)!), block);
      const currentOut = outState.get(block.id)!;
      if (!statesEqual(newOut, currentOut)) {
        outState.set(block.id, newOut);
        changed = true;
      }
    }
  }

  // Return OUT states (the result of forward analysis)
  return outState;
}

// ── Backward data-flow analysis ───────────────────────────────────────────────

export function backwardDFA(
  cfg: CFGResult,
  transfer: TransferFunction,
  join: JoinFunction,
  initialState: DFAState,
): Map<number, DFAState> {
  const inState = new Map<number, DFAState>();
  const outState = new Map<number, DFAState>();
  const blockMap = new Map(cfg.blocks.map(b => [b.id, b]));

  // Initialize all blocks
  for (const block of cfg.blocks) {
    inState.set(block.id, cloneDFAState(initialState));
    outState.set(block.id, cloneDFAState(initialState));
  }

  // Exit blocks get the initial state as their OUT
  for (const exitId of cfg.exitBlockIds) {
    outState.set(exitId, cloneDFAState(initialState));
  }

  let changed = true;
  let iterations = 0;
  const MAX_ITERATIONS = 100;

  while (changed && iterations < MAX_ITERATIONS) {
    changed = false;
    iterations++;

    // Process in reverse order for faster convergence
    const reversedBlocks = [...cfg.blocks].reverse();

    for (const block of reversedBlocks) {
      // OUT[n] = join(IN[s] for all successors s)
      const succStates: DFAState[] = [];
      for (const succId of block.successors) {
        const succIn = inState.get(succId);
        if (succIn) succStates.push(succIn);
      }

      if (succStates.length > 0) {
        const newOut = join(succStates);
        const currentOut = outState.get(block.id)!;
        if (!statesEqual(newOut, currentOut)) {
          outState.set(block.id, newOut);
          changed = true;
        }
      } else if (cfg.exitBlockIds.includes(block.id)) {
        outState.set(block.id, cloneDFAState(initialState));
      }

      // IN[n] = transfer(OUT[n], n)
      const newIn = transfer(cloneDFAState(outState.get(block.id)!), block);
      const currentIn = inState.get(block.id)!;
      if (!statesEqual(newIn, currentIn)) {
        inState.set(block.id, newIn);
        changed = true;
      }
    }
  }

  // Return IN states (the result of backward analysis)
  return inState;
}

// ── Statement-level analysis helpers ──────────────────────────────────────────

function walkNodes(root: ts.Node, visitor: (node: ts.Node) => void): void {
  const stack: ts.Node[] = [root];
  while (stack.length > 0) {
    const node = stack.pop()!;
    visitor(node);
    node.forEachChild(child => stack.push(child));
  }
}

function isPromiseCreation(node: ts.Node): boolean {
  if (ts.isNewExpression(node) && node.expression) {
    const text = node.expression.getText();
    return text === 'Promise';
  }
  if (ts.isCallExpression(node)) {
    const expr = node.expression;
    if (ts.isPropertyAccessExpression(expr)) {
      const objText = expr.expression.getText();
      const propName = expr.name.text;
      if (objText === 'Promise' && (propName === 'resolve' || propName === 'reject' || propName === 'all' || propName === 'race' || propName === 'allSettled' || propName === 'any')) {
        return true;
      }
    }
    if (ts.isIdentifier(expr) && expr.text === 'fetch') return true;
  }
  if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
    const propName = node.expression.name.text;
    if (propName === 'then' || propName === 'catch' || propName === 'finally') {
      // This is a .then/.catch/.finally call – the promise is being handled
      return false;
    }
  }
  return false;
}

function isPromiseHandled(node: ts.Node): boolean {
  if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
    const propName = node.expression.name.text;
    if (propName === 'then' || propName === 'catch' || propName === 'finally') return true;
  }
  if (ts.isAwaitExpression(node)) return true;
  // try/catch handles rejected promises
  return false;
}

function isTimerCall(node: ts.Node): 'setInterval' | 'setTimeout' | null {
  if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
    const name = node.expression.text;
    if (name === 'setInterval') return 'setInterval';
    if (name === 'setTimeout') return 'setTimeout';
  }
  return null;
}

function isTimerCleanup(node: ts.Node): 'clearInterval' | 'clearTimeout' | null {
  if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
    const name = node.expression.text;
    if (name === 'clearInterval') return 'clearInterval';
    if (name === 'clearTimeout') return 'clearTimeout';
  }
  return null;
}

function isDOMMutation(node: ts.Node): boolean {
  if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
    const prop = node.expression.name.text;
    if (['appendChild', 'insertBefore', 'removeChild', 'replaceChild', 'append', 'prepend', 'before', 'after', 'replaceWith', 'remove', 'setAttribute', 'classList'].includes(prop)) {
      return true;
    }
  }
  if (ts.isPropertyAccessExpression(node)) {
    const prop = node.name.text;
    if (['textContent', 'innerHTML', 'outerHTML', 'className', 'style', 'src', 'href'].includes(prop)) {
      // Check if it's an assignment target
      const parent = node.parent;
      if (parent && ts.isBinaryExpression(parent) && parent.operatorToken.kind === ts.SyntaxKind.EqualsToken && parent.left === node) {
        return true;
      }
    }
  }
  return false;
}

function isIOCall(node: ts.Node): boolean {
  if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
    const name = node.expression.text;
    if (['fetch', 'XMLHttpRequest', 'readFile', 'writeFile', 'log', 'warn', 'error', 'info'].includes(name)) {
      return true;
    }
  }
  if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
    const prop = node.expression.name.text;
    if (['log', 'warn', 'error', 'info', 'fetch', 'send', 'open', 'getItem', 'setItem', 'removeItem'].includes(prop)) {
      return true;
    }
  }
  return false;
}

function extractVariableName(node: ts.Node): string | null {
  if (ts.isIdentifier(node)) return node.text;
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) return node.name.text;
  if (ts.isPropertyAccessExpression(node)) return node.name.text;
  return null;
}

// ── Pre-built analysis: Floating Promises ─────────────────────────────────────

export function detectFloatingPromises(cfg: CFGResult, _sourceFile: ts.SourceFile): DFAState[] {
  const transfer: TransferFunction = (inState: DFAState, block: CFGBlock): DFAState => {
    const out = cloneDFAState(inState);

    for (const stmt of block.statements) {
      walkNodes(stmt, (node) => {
        // Check if this node creates a promise
        if (isPromiseCreation(node)) {
          out.hasPromise = true;
        }
        // Check if this node handles a promise (await, .then, .catch)
        if (isPromiseHandled(node)) {
          out.hasPromise = false;
        }
      });

      // If the statement is a return statement, promises in this block
      // are not floating (they're being returned)
      if (stmt.kind === ts.SyntaxKind.ReturnStatement) {
        out.hasPromise = false;
      }
    }

    return out;
  };

  const states = forwardDFA(cfg, transfer, defaultJoin, emptyDFAState());

  // Collect blocks where hasPromise is true at exit → floating promise detected
  const results: DFAState[] = [];
  for (const block of cfg.blocks) {
    const state = states.get(block.id);
    if (state && state.hasPromise) {
      results.push(cloneDFAState(state));
    }
  }
  return results;
}

// ── Pre-built analysis: Unpaired Timers ───────────────────────────────────────

export function detectUnpairedTimers(cfg: CFGResult, _sourceFile: ts.SourceFile): DFAState[] {
  const domTree = computeDominators(cfg);

  const transfer: TransferFunction = (inState: DFAState, block: CFGBlock): DFAState => {
    const out = cloneDFAState(inState);

    for (const stmt of block.statements) {
      walkNodes(stmt, (node) => {
        if (isTimerCall(node) !== null) {
          out.hasTimer = true;
          out.hasTimerCleanup = false; // Reset: new timer needs its own cleanup
        }
        if (isTimerCleanup(node) !== null) {
          out.hasTimerCleanup = true;
        }
      });
    }

    return out;
  };

  const states = forwardDFA(cfg, transfer, defaultJoin, emptyDFAState());

  // A timer is "unpaired" if it's set but there's no cleanup on ALL paths to
  // exit. We use post-dominator analysis: if no exit block is post-dominated
  // by a cleanup, the timer is unpaired.
  const results: DFAState[] = [];

  for (const block of cfg.blocks) {
    const state = states.get(block.id);
    if (!state || !state.hasTimer) continue;

    // Check whether there exists a cleanup block that post-dominates this block
    let hasCleanupOnAllPaths = false;

    for (const otherBlock of cfg.blocks) {
      const otherState = states.get(otherBlock.id);
      if (otherState && otherState.hasTimerCleanup) {
        // If the cleanup block post-dominates the timer block, the timer
        // is cleaned up on all paths
        if (postDominates(domTree.postDom, otherBlock.id, block.id)) {
          hasCleanupOnAllPaths = true;
          break;
        }
      }
    }

    if (!hasCleanupOnAllPaths) {
      const result = cloneDFAState(state);
      result.hasTimerCleanup = false; // Mark as unpaired
      results.push(result);
    }
  }

  return results;
}

// ── Pre-built analysis: Missing Rollback ──────────────────────────────────────

export function detectMissingRollback(cfg: CFGResult, _sourceFile: ts.SourceFile): DFAState[] {
  const transfer: TransferFunction = (inState: DFAState, block: CFGBlock): DFAState => {
    const out = cloneDFAState(inState);

    for (const stmt of block.statements) {
      walkNodes(stmt, (node) => {
        if (isDOMMutation(node)) {
          out.hasMutation = true;
        }
      });

      // Look for rollback patterns: try/finally with restore, or .reverse()
      walkNodes(stmt, (node) => {
        if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
          const prop = node.expression.name.text;
          if (prop === 'reverse' || prop === 'restore' || prop === 'reset' || prop === 'rollback' || prop === 'undo') {
            out.hasRollback = true;
          }
        }
        // removeAttribute, removeEventListener are also rollbacks
        if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
          const name = node.expression.text;
          if (name === 'removeEventListener' || name === 'removeAttribute') {
            out.hasRollback = true;
          }
        }
        if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
          const prop = node.expression.name.text;
          if (prop === 'removeEventListener' || prop === 'removeAttribute') {
            out.hasRollback = true;
          }
        }
      });

      // If in a catch/finally block, check for rollback
      if (block.label === 'catch' || block.label === 'finally') {
        // Statements in catch/finally that undo mutations count as rollback
        for (const s of block.statements) {
          walkNodes(s, (node) => {
            if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
              const prop = node.expression.name.text;
              if (['removeChild', 'removeAttribute', 'removeEventListener', 'restore', 'reset', 'rollback'].includes(prop)) {
                out.hasRollback = true;
              }
            }
          });
        }
      }
    }

    return out;
  };

  const states = forwardDFA(cfg, transfer, defaultJoin, emptyDFAState());

  // Detect mutations that lack rollback on exception paths.
  // A mutation is missing rollback if:
  //   - hasMutation is true at some block
  //   - On at least one path from that block to an exit, hasRollback is false
  const results: DFAState[] = [];

  for (const block of cfg.blocks) {
    const state = states.get(block.id);
    if (!state || !state.hasMutation) continue;

    // Check if the block is inside a try block (exception paths exist)
    const hasCatchPath = block.label === 'try-body' ||
      block.predecessors.some(predId => {
        const predBlock = cfg.blocks.find(b => b.id === predId);
        return predBlock?.label === 'catch' || predBlock?.label === 'try-body';
      });

    // Check if any successor path reaches exit without rollback
    const hasRollbackOnAllPaths = state.hasRollback;

    if (hasCatchPath && !hasRollbackOnAllPaths) {
      const result = cloneDFAState(state);
      result.hasRollback = false;
      results.push(result);
    } else if (!hasRollbackOnAllPaths && block.successors.some(succId => {
      const succState = states.get(succId);
      return succState && !succState.hasRollback;
    })) {
      // Mutation flows to exit without rollback
      const result = cloneDFAState(state);
      result.hasRollback = false;
      results.push(result);
    }
  }

  return results;
}

// ── Pre-built analysis: Theatrical Returns ────────────────────────────────────
// "Theatrical" returns are return statements preceded by I/O operations that
// produce side effects (e.g., console.log before return), which are often
// debug/development artifacts left in production code.

export function detectTheatricalReturns(cfg: CFGResult, _sourceFile: ts.SourceFile): DFAState[] {
  const transfer: TransferFunction = (inState: DFAState, block: CFGBlock): DFAState => {
    const out = cloneDFAState(inState);

    for (const stmt of block.statements) {
      walkNodes(stmt, (node) => {
        if (isIOCall(node)) {
          out.hasIO = true;
        }
      });

      // If this is a return statement and we've seen IO, it's a theatrical return
      if (stmt.kind === ts.SyntaxKind.ReturnStatement && out.hasIO) {
        // Already flagged – the IO happened before the return
      }
    }

    return out;
  };

  const states = forwardDFA(cfg, transfer, defaultJoin, emptyDFAState());

  // Find blocks containing return statements where hasIO is true in the
  // incoming state (meaning IO happened on the path to this return)
  const results: DFAState[] = [];

  for (const block of cfg.blocks) {
    const hasReturn = block.statements.some(s => s.kind === ts.SyntaxKind.ReturnStatement);
    if (!hasReturn) continue;

    // Check IN state (before the block's transfer) by looking at predecessor OUT states
    const predStates: DFAState[] = [];
    for (const predId of block.predecessors) {
      const predState = states.get(predId);
      if (predState) predStates.push(predState);
    }

    // Also check the block's own OUT state (transfer already ran)
    const blockState = states.get(block.id);

    if (blockState && blockState.hasIO) {
      results.push(cloneDFAState(blockState));
    } else if (predStates.some(s => s.hasIO)) {
      const result = emptyDFAState();
      result.hasIO = true;
      results.push(result);
    }
  }

  return results;
}
