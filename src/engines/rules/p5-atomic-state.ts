import * as ts from 'typescript';
import type { SemanticFinding, RuleDefinition } from '../types.js';

function makeFinding(
  ruleId: string, severity: SemanticFinding['severity'], message: string,
  node: ts.Node, sourceFile: ts.SourceFile, fixSuggestion?: string,
): SemanticFinding {
  const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  return { ruleId, severity, message, file: sourceFile.fileName, line: line + 1, fixSuggestion };
}

const MUTATING_METHODS = new Set([
  'push', 'pop', 'splice', 'shift', 'unshift', 'sort', 'reverse',
  'set', 'add', 'delete', 'clear', 'write', 'put', 'patch',
]);

function isStateMutation(node: ts.Node): { target: ts.Expression; kind: 'assign' | 'call' } | null {
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
    const left = node.left;
    if (ts.isPropertyAccessExpression(left)) return { target: left.expression, kind: 'assign' };
    if (ts.isElementAccessExpression(left)) return { target: left.expression, kind: 'assign' };
  }
  if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
    if (MUTATING_METHODS.has(node.expression.name.text)) {
      return { target: node.expression.expression, kind: 'call' };
    }
  }
  return null;
}

function isSharedState(target: ts.Expression, checker: ts.TypeChecker): boolean {
  if (ts.isIdentifier(target) && target.text === 'this') return true;
  if (ts.isIdentifier(target)) {
    const sharedNames = ['state', 'session', 'ctx', 'context', 'store', 'global', 'shared', 'cache'];
    for (const sn of sharedNames) {
      if (target.text === sn) return true;
    }
  }
  try {
    const type = checker.getTypeAtLocation(target);
    if (type.symbol) {
      const typeName = type.symbol.name;
      if (typeName === 'State' || typeName === 'Session' || typeName === 'Store') return true;
    }
  } catch { /* skip */ }
  return false;
}

function hasCallWithName(block: ts.Node, name: string): boolean {
  let found = false;
  function walk(n: ts.Node): void {
    if (found) return;
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === name) { found = true; return; }
    ts.forEachChild(n, walk);
  }
  ts.forEachChild(block, walk);
  return found;
}

function isInTryCatchWithRollback(node: ts.Node): boolean {
  let current: ts.Node | undefined = node.parent;
  while (current) {
    if (ts.isTryStatement(current)) {
      const catchClause = current.catchClause;
      if (!catchClause) { current = current.parent; continue; }
      const block = catchClause.block;
      const hasRollback = block.statements.some(stmt => {
        if (ts.isExpressionStatement(stmt)) {
          const expr = stmt.expression;
          if (ts.isDeleteExpression(expr)) return true;
          if (ts.isBinaryExpression(expr) && expr.operatorToken.kind === ts.SyntaxKind.EqualsToken) return true;
          if (ts.isCallExpression(expr) && ts.isPropertyAccessExpression(expr.expression) && MUTATING_METHODS.has(expr.expression.name.text)) return true;
        }
        if (ts.isThrowStatement(stmt)) return true;
        return false;
      });
      if (hasRollback) return true;
    }
    if (ts.isBlock(current) || ts.isFunctionDeclaration(current)) {
      if (hasCallWithName(current, 'begin') && (hasCallWithName(current, 'commit') || hasCallWithName(current, 'rollback'))) return true;
    }
    current = current.parent;
  }
  return false;
}

export const p5AtomicState: RuleDefinition = {
  id: 'P5',
  name: 'Atomic State',
  severity: 'CRITICAL',
  layer: 4,

  run(sourceFile: ts.SourceFile, checker: ts.TypeChecker): SemanticFinding[] {
    const findings: SemanticFinding[] = [];

    function visit(node: ts.Node): void {
      const mutation = isStateMutation(node);
      if (mutation && isSharedState(mutation.target, checker)) {
        if (!isInTryCatchWithRollback(node)) {
          findings.push(makeFinding(
            'P5', 'CRITICAL',
            'Shared state mutation without error recovery — if this fails, state will be inconsistent',
            node, sourceFile,
            'Wrap the mutation in try/catch with rollback, or use a transaction pattern (begin/commit/rollback)',
          ));
        }
      }
      ts.forEachChild(node, visit);
    }

    ts.forEachChild(sourceFile, visit);
    return findings;
  },
};
