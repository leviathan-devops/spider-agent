import * as ts from 'typescript';
import type { SemanticFinding, RuleDefinition } from '../types.js';

function makeFinding(
  ruleId: string, severity: SemanticFinding['severity'], message: string,
  node: ts.Node, sourceFile: ts.SourceFile, fixSuggestion?: string,
): SemanticFinding {
  const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  return { ruleId, severity, message, file: sourceFile.fileName, line: line + 1, fixSuggestion };
}

function isExternalModuleCall(node: ts.CallExpression, checker: ts.TypeChecker): boolean {
  const expr = node.expression;
  if (ts.isPropertyAccessExpression(expr)) {
    const objectSymbol = checker.getSymbolAtLocation(expr.expression);
    if (objectSymbol?.declarations?.length) {
      if (objectSymbol.declarations[0].getSourceFile().fileName.includes('node_modules')) return true;
    }
  }
  if (ts.isIdentifier(expr)) {
    const symbol = checker.getSymbolAtLocation(expr);
    if (symbol?.declarations?.length) {
      if (symbol.declarations[0].getSourceFile().fileName.includes('node_modules')) return true;
    }
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

function isInTypeGuard(node: ts.Node): boolean {
  let current: ts.Node | undefined = node.parent;
  while (current) {
    if (ts.isIfStatement(current) && containsTypeofOrInstanceof(current.expression)) return true;
    current = current.parent;
  }
  return false;
}

function containsTypeofOrInstanceof(expr: ts.Expression): boolean {
  if (ts.isTypeOfExpression(expr)) return true;
  if (ts.isBinaryExpression(expr)) {
    if (expr.operatorToken.kind === ts.SyntaxKind.InstanceOfKeyword) return true;
    return containsTypeofOrInstanceof(expr.left) || containsTypeofOrInstanceof(expr.right);
  }
  if (ts.isParenthesizedExpression(expr)) return containsTypeofOrInstanceof(expr.expression);
  return false;
}

function hasPromiseErrorHandling(node: ts.CallExpression): boolean {
  const parent = node.parent;
  if (ts.isPropertyAccessExpression(parent) && parent.name.text === 'catch') return true;
  if (ts.isCallExpression(parent) && ts.isPropertyAccessExpression(parent.expression) && parent.expression.name.text === 'then' && parent.arguments.length >= 2) return true;
  if (ts.isAwaitExpression(parent)) return isInTryCatch(parent);
  return false;
}

export const p6DependencyVerification: RuleDefinition = {
  id: 'P6',
  name: 'Dependency Verification',
  severity: 'HIGH',
  layer: 3,

  run(sourceFile: ts.SourceFile, checker: ts.TypeChecker): SemanticFinding[] {
    const findings: SemanticFinding[] = [];

    function visit(node: ts.Node): void {
      if (ts.isCallExpression(node) && isExternalModuleCall(node, checker)) {
        if (!isInTryCatch(node) && !isInTypeGuard(node) && !hasPromiseErrorHandling(node)) {
          const callName = ts.isPropertyAccessExpression(node.expression)
            ? node.expression.expression.getText(sourceFile) + '.' + node.expression.name.text
            : node.expression.getText(sourceFile);

          findings.push(makeFinding(
            'P6', 'HIGH',
            `Unguarded external dependency call "${callName}" — failure will be unhandled`,
            node, sourceFile,
            'Wrap in try/catch, add .catch() handler, or guard with typeof/instanceof check',
          ));
        }
      }
      ts.forEachChild(node, visit);
    }

    ts.forEachChild(sourceFile, visit);
    return findings;
  },
};
