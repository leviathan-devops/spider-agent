import * as ts from 'typescript';
import type { SemanticFinding, RuleDefinition } from '../types.js';

function makeFinding(
  ruleId: string, severity: SemanticFinding['severity'], message: string,
  node: ts.Node, sourceFile: ts.SourceFile, fixSuggestion?: string,
): SemanticFinding {
  const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  return { ruleId, severity, message, file: sourceFile.fileName, line: line + 1, fixSuggestion };
}

const CONFIG_VAR_NAMES = new Set(['config', 'options', 'settings', 'args', 'argv', 'env', 'cfg', 'conf']);

function isConfigIdentifier(node: ts.Identifier): boolean {
  return CONFIG_VAR_NAMES.has(node.text);
}

function isOptionalProperty(symbol: ts.Symbol): boolean {
  const declarations = symbol.declarations;
  if (!declarations || declarations.length === 0) return false;
  for (const decl of declarations) {
    if (ts.isPropertySignature(decl)) {
      // Check for question token via modifier flags
      if (decl.questionToken) return true;
    }
    if (ts.isPropertyDeclaration(decl)) {
      if (decl.questionToken) return true;
    }
    if (ts.isParameter(decl)) {
      if (decl.questionToken) return true;
    }
  }
  return false;
}

function referencesProperty(expr: ts.Expression, propName: string): boolean {
  return ts.isPropertyAccessExpression(expr) && expr.name.text === propName;
}

function guardsProperty(expr: ts.Expression, propName: string): boolean {
  if (ts.isBinaryExpression(expr)) {
    const { left, operatorToken, right } = expr;
    if (ts.isTypeOfExpression(left) && ts.isStringLiteral(right) && referencesProperty(left.expression, propName)) return true;
    if (ts.isStringLiteral(left) && ts.isTypeOfExpression(right) && referencesProperty(right.expression, propName)) return true;
    if (operatorToken.kind === ts.SyntaxKind.ExclamationEqualsEqualsToken || operatorToken.kind === ts.SyntaxKind.ExclamationEqualsToken) {
      if (referencesProperty(left, propName) || referencesProperty(right, propName)) return true;
    }
    if (operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken || operatorToken.kind === ts.SyntaxKind.BarBarToken) {
      return guardsProperty(left, propName) || guardsProperty(right, propName);
    }
  }
  if (ts.isParenthesizedExpression(expr)) return guardsProperty(expr.expression, propName);
  return false;
}

function isGuardedBeforeAccess(accessNode: ts.Node, propertyName: string): boolean {
  let current: ts.Node | undefined = accessNode.parent;
  while (current) {
    if (ts.isIfStatement(current) && guardsProperty(current.expression, propertyName)) return true;
    if (ts.isConditionalExpression(current) && guardsProperty(current.condition, propertyName)) return true;
    current = current.parent;
  }
  return false;
}

function isOptionalChainAccess(node: ts.Node): boolean {
  return ts.isPropertyAccessExpression(node) && !!(node as any).questionDotToken;
}

function isNonNullAssertion(node: ts.Node): boolean {
  if (ts.isNonNullExpression(node)) return true;
  return !!node.parent && ts.isNonNullExpression(node.parent);
}

export const p8ConfigValidation: RuleDefinition = {
  id: 'P8',
  name: 'Config Validation',
  severity: 'HIGH',
  layer: 3,

  run(sourceFile: ts.SourceFile, checker: ts.TypeChecker): SemanticFinding[] {
    const findings: SemanticFinding[] = [];

    function visit(node: ts.Node): void {
      if (ts.isPropertyAccessExpression(node)) {
        const obj = node.expression;
        if (!ts.isIdentifier(obj) || !isConfigIdentifier(obj)) { ts.forEachChild(node, visit); return; }

        const propSymbol = checker.getSymbolAtLocation(node);
        if (!propSymbol) { ts.forEachChild(node, visit); return; }
        if (!isOptionalProperty(propSymbol)) { ts.forEachChild(node, visit); return; }

        const propName = node.name.text;
        if (isOptionalChainAccess(node)) { ts.forEachChild(node, visit); return; }
        if (isGuardedBeforeAccess(node, propName)) { ts.forEachChild(node, visit); return; }

        if (isNonNullAssertion(node)) {
          findings.push(makeFinding(
            'P8', 'HIGH',
            `Non-null assertion on optional config property "${propName}" without prior guard`,
            node, sourceFile,
            `Use optional chaining (config?.${propName}) or add a null guard before the assertion`,
          ));
        } else {
          findings.push(makeFinding(
            'P8', 'MEDIUM',
            `Optional config property "${propName}" accessed without null/undefined check`,
            node, sourceFile,
            `Use optional chaining (config?.${propName}) or add an if/typeof guard`,
          ));
        }
      }

      ts.forEachChild(node, visit);
    }

    ts.forEachChild(sourceFile, visit);
    return findings;
  },
};
