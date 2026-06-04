import * as ts from 'typescript';
import type { SemanticFinding, RuleDefinition } from '../types.js';

function makeFinding(
  ruleId: string, severity: SemanticFinding['severity'], message: string,
  node: ts.Node, sourceFile: ts.SourceFile, fixSuggestion?: string,
): SemanticFinding {
  const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  return { ruleId, severity, message, file: sourceFile.fileName, line: line + 1, fixSuggestion };
}

const CONSENSUS_PROPERTIES = new Set([
  'overallPassed', 'passRate', 'consensus', 'success',
  'allPassed', 'isComplete', 'isSuccessful', 'result',
]);

function hasConsensusProperties(objLit: ts.ObjectLiteralExpression): string[] {
  const found: string[] = [];
  for (const prop of objLit.properties) {
    let name: string | undefined;
    if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name)) name = prop.name.text;
    else if (ts.isShorthandPropertyAssignment(prop)) name = prop.name.text;
    if (name && CONSENSUS_PROPERTIES.has(name)) found.push(name);
  }
  return found;
}

function getPropertyValue(objLit: ts.ObjectLiteralExpression, propName: string): ts.Expression | undefined {
  for (const prop of objLit.properties) {
    if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name) && prop.name.text === propName) {
      return prop.initializer;
    }
  }
  return undefined;
}

function isTruthyLiteral(expr: ts.Expression): boolean {
  if (expr.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (ts.isNumericLiteral(expr) && expr.text === '1') return true;
  return false;
}

function isLengthAccess(expr: ts.Expression): boolean {
  return ts.isPropertyAccessExpression(expr) && expr.name.text === 'length';
}

function isEmptyCheck(expr: ts.Expression): boolean {
  if (ts.isPrefixUnaryExpression(expr) && expr.operator === ts.SyntaxKind.ExclamationToken) {
    if (ts.isPropertyAccessExpression(expr.operand) && expr.operand.name.text === 'length') return true;
  }
  if (ts.isBinaryExpression(expr)) {
    const { left, operatorToken, right } = expr;
    if (isLengthAccess(left) || isLengthAccess(right)) {
      if (operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken || operatorToken.kind === ts.SyntaxKind.EqualsEqualsToken) {
        if (right.kind === ts.SyntaxKind.NumericLiteral && (right as ts.NumericLiteral).text === '0') return true;
        if (left.kind === ts.SyntaxKind.NumericLiteral && (left as ts.NumericLiteral).text === '0') return true;
      }
      if (operatorToken.kind === ts.SyntaxKind.LessThanToken && right.kind === ts.SyntaxKind.NumericLiteral && (right as ts.NumericLiteral).text === '1') return true;
    }
    if (operatorToken.kind === ts.SyntaxKind.ExclamationEqualsEqualsToken || operatorToken.kind === ts.SyntaxKind.ExclamationEqualsToken) {
      if (right.kind === ts.SyntaxKind.NullKeyword || right.kind === ts.SyntaxKind.UndefinedKeyword) return true;
    }
  }
  return false;
}

function hasEmptyInputGuard(fn: ts.FunctionLikeDeclaration): boolean {
  const body = fn.body;
  if (!body || !ts.isBlock(body)) return false;
  let found = false;
  function walk(node: ts.Node): void {
    if (found) return;
    if (ts.isIfStatement(node) && isEmptyCheck(node.expression)) {
      if (ts.isBlock(node.thenStatement)) {
        if (node.thenStatement.statements.some(s => ts.isReturnStatement(s))) { found = true; return; }
      } else if (ts.isReturnStatement(node.thenStatement)) { found = true; return; }
    }
    ts.forEachChild(node, walk);
  }
  ts.forEachChild(body, walk);
  return found;
}

export const antiEmptySetConsensus: RuleDefinition = {
  id: 'Anti-Empty-Set-Consensus',
  name: 'Anti Empty-Set Consensus',
  severity: 'CRITICAL',
  layer: 0,

  run(sourceFile: ts.SourceFile, checker: ts.TypeChecker): SemanticFinding[] {
    const findings: SemanticFinding[] = [];

    function visit(node: ts.Node): void {
      if (ts.isFunctionDeclaration(node) || ts.isArrowFunction(node) ||
          ts.isFunctionExpression(node) || ts.isMethodDeclaration(node)) {
        const body = node.body;
        if (!body) { ts.forEachChild(node, visit); return; }

        function findReturns(n: ts.Node): void {
          if (ts.isReturnStatement(n) && n.expression && ts.isObjectLiteralExpression(n.expression)) {
            const consensusProps = hasConsensusProperties(n.expression);
            if (consensusProps.length > 0) {
              for (const prop of consensusProps) {
                const value = getPropertyValue(n.expression, prop);
                if (value && isTruthyLiteral(value)) {
                  if (!hasEmptyInputGuard(node as ts.FunctionLikeDeclaration)) {
                    findings.push(makeFinding(
                      'Anti-Empty-Set-Consensus', 'CRITICAL',
                      `Function returns "${prop}: true" without guarding against empty input — may report consensus for zero items`,
                      n, sourceFile,
                      'Add an early-return guard: if (items.length === 0) return { overallPassed: false, ... }',
                    ));
                  }
                }
              }
            }
          }
          if (ts.isFunctionDeclaration(n) || ts.isArrowFunction(n) ||
              ts.isFunctionExpression(n) || ts.isMethodDeclaration(n)) {
            if (n !== node) return;
          }
          ts.forEachChild(n, findReturns);
        }

        ts.forEachChild(body, findReturns);
      }

      ts.forEachChild(node, visit);
    }

    ts.forEachChild(sourceFile, visit);
    return findings;
  },
};
