import * as ts from 'typescript';
import type { SemanticFinding, RuleDefinition } from '../types.js';

function makeFinding(
  ruleId: string, severity: SemanticFinding['severity'], message: string,
  node: ts.Node, sourceFile: ts.SourceFile, fixSuggestion?: string,
): SemanticFinding {
  const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  return { ruleId, severity, message, file: sourceFile.fileName, line: line + 1, fixSuggestion };
}

/** Check if an as-expression uses 'as const'. */
function isAsConst(node: ts.AsExpression): boolean {
  return node.type.kind === ts.SyntaxKind.TypeReference &&
    ts.isTypeReferenceNode(node.type) &&
    ts.isIdentifier(node.type.typeName) &&
    node.type.typeName.text === 'const';
}

/** Walk parent chain for type guards (typeof x === 'string', x instanceof Foo). */
function isGuardedByTypeCheck(node: ts.Node): boolean {
  let current: ts.Node | undefined = node.parent;
  while (current) {
    if (ts.isIfStatement(current) && isTypeGuardExpression(current.expression)) return true;
    current = current.parent;
  }
  return false;
}

function isTypeGuardExpression(expr: ts.Expression): boolean {
  if (ts.isBinaryExpression(expr)) {
    const { left, operatorToken, right } = expr;
    if (operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken ||
        operatorToken.kind === ts.SyntaxKind.ExclamationEqualsEqualsToken) {
      if (ts.isTypeOfExpression(left) || ts.isTypeOfExpression(right)) return true;
    }
    if (operatorToken.kind === ts.SyntaxKind.InstanceOfKeyword) return true;
    if (operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
        operatorToken.kind === ts.SyntaxKind.BarBarToken) {
      return isTypeGuardExpression(left) || isTypeGuardExpression(right);
    }
  }
  if (ts.isParenthesizedExpression(expr)) return isTypeGuardExpression(expr.expression);
  return false;
}

export const p2TypeCertainty: RuleDefinition = {
  id: 'P2',
  name: 'Type Certainty',
  severity: 'HIGH',
  layer: 1,

  run(sourceFile: ts.SourceFile, checker: ts.TypeChecker): SemanticFinding[] {
    const findings: SemanticFinding[] = [];

    function visit(node: ts.Node): void {
      if (ts.isAsExpression(node)) {
        if (isAsConst(node)) { ts.forEachChild(node, visit); return; }
        if (node.type.kind === ts.SyntaxKind.UnknownKeyword) { ts.forEachChild(node, visit); return; }
        if (node.type.kind === ts.SyntaxKind.NeverKeyword) { ts.forEachChild(node, visit); return; }

        if (node.type.kind === ts.SyntaxKind.AnyKeyword) {
          findings.push(makeFinding(
            'P2', 'MEDIUM',
            `'as any' cast suppresses type checking — consider a narrower type`,
            node, sourceFile,
            'Replace with a more specific type or add a type guard',
          ));
          ts.forEachChild(node, visit);
          return;
        }

        const widenedType = checker.getTypeAtLocation(node.expression);
        let targetType: ts.Type;
        try { targetType = checker.getTypeFromTypeNode(node.type); } catch { ts.forEachChild(node, visit); return; }

        // NEW: If the source type is 'any' (implicit or explicit), ANY cast is unsafe
        // because 'any' is assignable to everything in TypeScript's type system,
        // but NOT safe at runtime. This catches `function p(d) { return d as string; }`.
        if (widenedType.flags & ts.TypeFlags.Any) {
          findings.push(makeFinding(
            'P2', 'HIGH',
            `Cast from "any" to "${checker.typeToString(targetType)}" is unsafe — parameter has no type annotation`,
            node, sourceFile,
            'Add a type annotation to the parameter and a type guard before the cast',
          ));
          ts.forEachChild(node, visit);
          return;
        }

        try {
          if (checker.isTypeAssignableTo(widenedType, targetType)) { ts.forEachChild(node, visit); return; }
        } catch { /* isTypeAssignableTo can throw */ }

        if (isGuardedByTypeCheck(node)) { ts.forEachChild(node, visit); return; }

        findings.push(makeFinding(
          'P2', 'HIGH',
          `Unsafe cast from "${checker.typeToString(widenedType)}" to "${checker.typeToString(targetType)}" without type guard`,
          node, sourceFile,
          'Add a typeof/instanceof guard before the cast, or use a type predicate',
        ));
      }

      ts.forEachChild(node, visit);
    }

    ts.forEachChild(sourceFile, visit);
    return findings;
  },
};
