import * as ts from 'typescript';
import type { SemanticFinding, RuleDefinition } from '../types.js';

function makeFinding(
  ruleId: string, severity: SemanticFinding['severity'], message: string,
  node: ts.Node, sourceFile: ts.SourceFile, fixSuggestion?: string,
): SemanticFinding {
  const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  return { ruleId, severity, message, file: sourceFile.fileName, line: line + 1, fixSuggestion };
}

interface TrackedResource {
  kind: 'setInterval' | 'setTimeout';
  id: ts.Identifier;
  callNode: ts.CallExpression;
  scopeNode: ts.Node;
}

function isTimerCall(node: ts.CallExpression): 'setInterval' | 'setTimeout' | null {
  const expr = node.expression;
  if (ts.isIdentifier(expr)) {
    if (expr.text === 'setInterval') return 'setInterval';
    if (expr.text === 'setTimeout') return 'setTimeout';
  }
  if (ts.isPropertyAccessExpression(expr)) {
    const prop = expr.name.text;
    if (prop === 'setInterval') return 'setInterval';
    if (prop === 'setTimeout') return 'setTimeout';
  }
  return null;
}

function isClearCall(node: ts.CallExpression): 'clearInterval' | 'clearTimeout' | null {
  const expr = node.expression;
  if (ts.isIdentifier(expr)) {
    if (expr.text === 'clearInterval') return 'clearInterval';
    if (expr.text === 'clearTimeout') return 'clearTimeout';
  }
  if (ts.isPropertyAccessExpression(expr)) {
    const prop = expr.name.text;
    if (prop === 'clearInterval') return 'clearInterval';
    if (prop === 'clearTimeout') return 'clearTimeout';
  }
  return null;
}

function getEnclosingScope(node: ts.Node): ts.Node {
  let current: ts.Node | undefined = node.parent;
  while (current) {
    if (ts.isFunctionDeclaration(current) || ts.isFunctionExpression(current) ||
        ts.isArrowFunction(current) || ts.isMethodDeclaration(current) ||
        ts.isConstructorDeclaration(current)) return current;
    current = current.parent;
  }
  return node.getSourceFile();
}

function findClearInScope(scope: ts.Node, targetId: ts.Identifier): ts.CallExpression | undefined {
  let found: ts.CallExpression | undefined;
  function walk(n: ts.Node): void {
    if (found) return;
    if (ts.isCallExpression(n) && isClearCall(n) && n.arguments.length > 0) {
      const arg = n.arguments[0];
      if (ts.isIdentifier(arg) && arg.text === targetId.text) { found = n; return; }
    }
    ts.forEachChild(n, walk);
  }
  ts.forEachChild(scope, walk);
  return found;
}

export const p4ResourceLifecycle: RuleDefinition = {
  id: 'P4',
  name: 'Resource Lifecycle',
  severity: 'HIGH',
  layer: 4,

  run(sourceFile: ts.SourceFile, checker: ts.TypeChecker): SemanticFinding[] {
    const findings: SemanticFinding[] = [];
    const tracked: TrackedResource[] = [];

    function collect(node: ts.Node): void {
      if (ts.isCallExpression(node)) {
        const kind = isTimerCall(node);
        if (kind) {
          const scope = getEnclosingScope(node);
          const parent = node.parent;
          if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
            tracked.push({ kind, id: parent.name, callNode: node, scopeNode: scope });
          } else if (ts.isBinaryExpression(parent) && parent.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isIdentifier(parent.left)) {
            tracked.push({ kind, id: parent.left, callNode: node, scopeNode: scope });
          } else {
            findings.push(makeFinding(
              'P4', 'CRITICAL',
              `${kind} called without storing the timer ID — cannot be cleared`,
              node, sourceFile,
              `Store the return value and call clear${kind.slice(3)}() when done`,
            ));
          }
        }
      }
      ts.forEachChild(node, collect);
    }

    ts.forEachChild(sourceFile, collect);

    for (const resource of tracked) {
      const clearFn = resource.kind === 'setInterval' ? 'clearInterval' : 'clearTimeout';
      const clearNode = findClearInScope(resource.scopeNode, resource.id);
      if (!clearNode) {
        findings.push(makeFinding(
          'P4', 'HIGH',
          `${resource.kind} timer "${resource.id.text}" is never cleared with ${clearFn}()`,
          resource.callNode, sourceFile,
          `Call ${clearFn}(${resource.id.text}) when the timer is no longer needed`,
        ));
      } else {
        const clearScope = getEnclosingScope(clearNode);
        if (clearScope !== resource.scopeNode) {
          findings.push(makeFinding(
            'P4', 'MEDIUM',
            `${resource.kind} and ${clearFn} are in different scopes — timer may leak`,
            resource.callNode, sourceFile,
            'Ensure the timer is cleared in the same scope or lifecycle method',
          ));
        }
      }
    }

    return findings;
  },
};
