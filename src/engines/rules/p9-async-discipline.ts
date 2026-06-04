import * as ts from 'typescript';
import type { SemanticFinding, RuleDefinition } from '../types.js';

function makeFinding(
  ruleId: string, severity: SemanticFinding['severity'], message: string,
  node: ts.Node, sourceFile: ts.SourceFile, fixSuggestion?: string,
): SemanticFinding {
  const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  return { ruleId, severity, message, file: sourceFile.fileName, line: line + 1, fixSuggestion };
}

function isAwaited(node: ts.Node): boolean {
  let current: ts.Node | undefined = node.parent;
  while (current) {
    if (ts.isAwaitExpression(current)) return true;
    if (ts.isFunctionDeclaration(current) || ts.isArrowFunction(current) ||
        ts.isFunctionExpression(current) || ts.isMethodDeclaration(current)) break;
    current = current.parent;
  }
  return false;
}

function isInTryCatch(node: ts.Node): boolean {
  let current: ts.Node | undefined = node.parent;
  while (current) {
    if (ts.isTryStatement(current) && current.catchClause) return true;
    current = current.parent;
  }
  return false;
}

function hasCatchHandler(node: ts.Expression): boolean {
  const parent = node.parent;
  if (ts.isPropertyAccessExpression(parent) && parent.name.text === 'catch') return true;
  if (ts.isCallExpression(parent) && ts.isPropertyAccessExpression(parent.expression) && parent.expression.name.text === 'then' && parent.arguments.length >= 2) return true;
  return false;
}

function isAsyncFunctionWithoutHandling(node: ts.ArrowFunction | ts.FunctionExpression | ts.FunctionDeclaration): boolean {
  if (!node.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword)) return false;
  const body = node.body;
  if (!body) return false;
  let hasTryCatch = false;
  function walk(n: ts.Node): void {
    if (hasTryCatch) return;
    if (ts.isTryStatement(n)) { hasTryCatch = true; return; }
    ts.forEachChild(n, walk);
  }
  if (ts.isBlock(body)) ts.forEachChild(body, walk);
  return !hasTryCatch;
}

export const p9AsyncDiscipline: RuleDefinition = {
  id: 'P9',
  name: 'Async Discipline',
  severity: 'HIGH',
  layer: 4,

  run(sourceFile: ts.SourceFile, checker: ts.TypeChecker): SemanticFinding[] {
    const findings: SemanticFinding[] = [];

    function visit(node: ts.Node): void {
      // new Promise(...) floating
      if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'Promise') {
        if (!isAwaited(node) && !hasCatchHandler(node) && !isInTryCatch(node)) {
          findings.push(makeFinding(
            'P9', 'HIGH',
            'Floating Promise — created but not awaited, no .catch() handler, and not inside try/catch',
            node, sourceFile,
            'Await the promise, add .catch(), or wrap in try/catch',
          ));
        }
      }

      // Call expressions returning Promise
      if (ts.isCallExpression(node)) {
        const returnType = checker.getTypeAtLocation(node);
        if (returnType.symbol && returnType.symbol.name === 'Promise') {
          if (!isAwaited(node) && !hasCatchHandler(node) && !isInTryCatch(node)) {
            const parent = node.parent;
            if (!ts.isVariableDeclaration(parent) && !ts.isAwaitExpression(parent)) {
              findings.push(makeFinding(
                'P9', 'HIGH',
                'Floating Promise — call returns Promise but result is not awaited or caught',
                node, sourceFile,
                'Await the result or add .catch() handling',
              ));
            }
          }
        }
      }

      // Async functions without error handling
      if (ts.isFunctionDeclaration(node) || ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
        if (isAsyncFunctionWithoutHandling(node)) {
          findings.push(makeFinding(
            'P9', 'MEDIUM',
            'Async function has no error handling — rejections will be unhandled',
            node, sourceFile,
            'Add try/catch inside the async function or ensure callers handle errors',
          ));
        }
      }

      ts.forEachChild(node, visit);
    }

    ts.forEachChild(sourceFile, visit);
    return findings;
  },
};
