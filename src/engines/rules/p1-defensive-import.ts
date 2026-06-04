import * as ts from 'typescript';
import type { SemanticFinding, RuleDefinition } from '../types.js';

function makeFinding(
  ruleId: string,
  severity: SemanticFinding['severity'],
  message: string,
  node: ts.Node,
  sourceFile: ts.SourceFile,
  fixSuggestion?: string,
): SemanticFinding {
  const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  return { ruleId, severity, message, file: sourceFile.fileName, line: line + 1, fixSuggestion };
}

/** Walk up the parent chain looking for try/catch, typeof, or instanceof guard. */
function isInGuardedContext(node: ts.Node): boolean {
  let current: ts.Node | undefined = node.parent;
  while (current) {
    if (ts.isTryStatement(current)) return true;
    if (ts.isIfStatement(current) && current.expression) {
      if (containsTypeofGuard(current.expression) || containsInstanceofGuard(current.expression)) return true;
    }
    current = current.parent;
  }
  return false;
}

function containsTypeofGuard(expr: ts.Expression): boolean {
  if (ts.isTypeOfExpression(expr)) return true;
  if (ts.isBinaryExpression(expr)) return containsTypeofGuard(expr.left) || containsTypeofGuard(expr.right);
  if (ts.isParenthesizedExpression(expr)) return containsTypeofGuard(expr.expression);
  return false;
}

function containsInstanceofGuard(expr: ts.Expression): boolean {
  if (ts.isBinaryExpression(expr) && expr.operatorToken.kind === ts.SyntaxKind.InstanceOfKeyword) return true;
  if (ts.isBinaryExpression(expr)) return containsInstanceofGuard(expr.left) || containsInstanceofGuard(expr.right);
  if (ts.isParenthesizedExpression(expr)) return containsInstanceofGuard(expr.expression);
  return false;
}

/** Detect require() call expressions. */
function isRequireCall(node: ts.Node): node is ts.CallExpression {
  if (!ts.isCallExpression(node)) return false;
  const expr = node.expression;
  return ts.isIdentifier(expr) && expr.text === 'require';
}

export const p1DefensiveImport: RuleDefinition = {
  id: 'P1',
  name: 'Defensive Import',
  severity: 'HIGH',
  layer: 3,

  run(sourceFile: ts.SourceFile, checker: ts.TypeChecker): SemanticFinding[] {
    const findings: SemanticFinding[] = [];

    function visit(node: ts.Node): void {
      if (ts.isImportDeclaration(node)) {
        // Type-only imports are erased at compile time → safe
        if (node.importClause?.isTypeOnly) {
          ts.forEachChild(node, visit);
          return;
        }

        const specifier = node.moduleSpecifier;
        if (!ts.isStringLiteral(specifier)) {
          ts.forEachChild(node, visit);
          return;
        }

        const symbol = checker.getSymbolAtLocation(specifier);
        if (!symbol) {
          findings.push(makeFinding(
            'P1', 'CRITICAL',
            `Import "${specifier.text}" does not resolve to any module`,
            node, sourceFile,
            'Install the missing package or fix the import path',
          ));
          return;
        }

        // Check if the import is from an external module (node_modules)
        const decl = symbol.valueDeclaration ?? symbol.declarations?.[0];
        const isExternal = decl ? decl.getSourceFile().fileName.includes('node_modules') : false;
        if (!isExternal) {
          ts.forEachChild(node, visit);
          return;
        }

        // Find first usage of imported binding and check if guarded
        if (node.importClause) {
          const clause = node.importClause;
          const bindings: ts.Identifier[] = [];
          if (clause.name) bindings.push(clause.name);
          if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
            for (const elem of clause.namedBindings.elements) {
              bindings.push(elem.name);
            }
          }

          for (const binding of bindings) {
            const bindingSymbol = checker.getSymbolAtLocation(binding);
            if (!bindingSymbol) continue;

            let foundUsage: ts.Identifier | undefined;
            ts.forEachChild(sourceFile, function walk(n: ts.Node): void {
              if (foundUsage) return;
              if (ts.isIdentifier(n) && n !== binding) {
                const sym = checker.getSymbolAtLocation(n);
                if (sym === bindingSymbol) { foundUsage = n; return; }
              }
              ts.forEachChild(n, walk);
            });

            if (foundUsage && !isInGuardedContext(foundUsage)) {
              findings.push(makeFinding(
                'P1', 'HIGH',
                `Unguarded usage of external import "${specifier.text}"`,
                foundUsage, sourceFile,
                'Wrap the usage in try/catch or add a typeof/instanceof guard',
              ));
            }
          }
        }
      }

      // require() calls
      if (isRequireCall(node) && node.arguments.length > 0) {
        const arg = node.arguments[0];
        if (ts.isStringLiteral(arg)) {
          const symbol = checker.getSymbolAtLocation(arg);
          if (!symbol) {
            findings.push(makeFinding(
              'P1', 'CRITICAL',
              `require("${arg.text}") does not resolve to any module`,
              node, sourceFile,
            ));
            return;
          }
          if (!isInGuardedContext(node)) {
            findings.push(makeFinding(
              'P1', 'HIGH',
              `Unguarded require("${arg.text}")`,
              node, sourceFile,
              'Wrap require() in try/catch',
            ));
          }
        }
      }

      ts.forEachChild(node, visit);
    }

    ts.forEachChild(sourceFile, visit);
    return findings;
  },
};
