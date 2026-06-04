import * as ts from 'typescript';
import type { SemanticFinding, RuleDefinition } from '../types.js';

function makeFinding(
  ruleId: string, severity: SemanticFinding['severity'], message: string,
  node: ts.Node, sourceFile: ts.SourceFile, fixSuggestion?: string,
): SemanticFinding {
  const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  return { ruleId, severity, message, file: sourceFile.fileName, line: line + 1, fixSuggestion };
}

function hasExplicitReturnType(node: ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression | ts.MethodDeclaration): boolean {
  return node.type !== undefined;
}

function isExhaustiveReturn(node: ts.FunctionLikeDeclaration): boolean {
  const body = node.body;
  if (!body) return false;
  if (!ts.isBlock(body)) return true; // Arrow expression body always returns
  return blockAlwaysReturns(body);
}

function blockAlwaysReturns(block: ts.Block): boolean {
  const stmts = block.statements;
  if (stmts.length === 0) return false;
  for (const stmt of stmts) {
    if (ts.isReturnStatement(stmt)) return true;
    if (ts.isIfStatement(stmt) && stmt.elseStatement) {
      if (statementAlwaysReturns(stmt.thenStatement) && statementAlwaysReturns(stmt.elseStatement)) return true;
    }
    if (ts.isTryStatement(stmt) && stmt.tryBlock && blockAlwaysReturns(stmt.tryBlock)) return true;
    if (ts.isSwitchStatement(stmt) && switchIsExhaustive(stmt)) return true;
  }
  return false;
}

function statementAlwaysReturns(stmt: ts.Statement): boolean {
  if (ts.isReturnStatement(stmt)) return true;
  if (ts.isBlock(stmt)) return blockAlwaysReturns(stmt);
  return false;
}

function switchIsExhaustive(stmt: ts.SwitchStatement): boolean {
  let hasDefault = false;
  let allCasesReturn = true;
  for (const clause of stmt.caseBlock.clauses) {
    if (ts.isDefaultClause(clause)) hasDefault = true;
    if (!clause.statements.some(s => ts.isReturnStatement(s))) allCasesReturn = false;
  }
  return hasDefault && allCasesReturn;
}

function findReturnStatements(body: ts.ConciseBody): ts.ReturnStatement[] {
  const returns: ts.ReturnStatement[] = [];
  function walk(node: ts.Node): void {
    if (ts.isReturnStatement(node) && node.expression) returns.push(node);
    if (ts.isFunctionDeclaration(node) || ts.isArrowFunction(node) ||
        ts.isFunctionExpression(node) || ts.isMethodDeclaration(node)) return;
    ts.forEachChild(node, walk);
  }
  if (ts.isBlock(body)) ts.forEachChild(body, walk); else walk(body);
  return returns;
}

export const p10OutputContract: RuleDefinition = {
  id: 'P10',
  name: 'Output Contract',
  severity: 'HIGH',
  layer: 3,

  run(sourceFile: ts.SourceFile, checker: ts.TypeChecker): SemanticFinding[] {
    const findings: SemanticFinding[] = [];

    function visit(node: ts.Node): void {
      if (ts.isFunctionDeclaration(node) || ts.isArrowFunction(node) ||
          ts.isFunctionExpression(node) || ts.isMethodDeclaration(node)) {
        const body = node.body;
        if (!body) { ts.forEachChild(node, visit); return; }

        // Missing return type annotation
        if (!hasExplicitReturnType(node)) {
          const returnStmts = findReturnStatements(body);
          if (returnStmts.length > 0) {
            findings.push(makeFinding(
              'P10', 'MEDIUM',
              'Function has return statements but no declared return type',
              node, sourceFile,
              'Add an explicit return type annotation to enforce the output contract',
            ));
          }
        }

        // Type compatibility check
        const signature = checker.getSignatureFromDeclaration(node);
        if (signature) {
          const declaredReturn = checker.getReturnTypeOfSignature(signature);
          if (ts.isBlock(body)) {
            const returnStmts = findReturnStatements(body);
            for (const ret of returnStmts) {
              if (!ret.expression) continue;
              const actualType = checker.getTypeAtLocation(ret.expression);
              try {
                if (!checker.isTypeAssignableTo(actualType, declaredReturn)) {
                  findings.push(makeFinding(
                    'P10', 'HIGH',
                    `Return type "${checker.typeToString(actualType)}" is not assignable to declared return type "${checker.typeToString(declaredReturn)}"`,
                    ret, sourceFile,
                    'Fix the return value to match the declared type, or update the type annotation',
                  ));
                }
              } catch { /* skip */ }
            }
          }
        }

        // Exhaustiveness check
        if (node.type && node.type.kind !== ts.SyntaxKind.VoidKeyword && node.type.kind !== ts.SyntaxKind.UndefinedKeyword) {
          if (!isExhaustiveReturn(node)) {
            findings.push(makeFinding(
              'P10', 'HIGH',
              'Function with declared return type does not return on all code paths',
              node, sourceFile,
              'Add return statements to all code paths or handle the missing return case',
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
