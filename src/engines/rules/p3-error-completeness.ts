import * as ts from 'typescript';
import type { SemanticFinding, RuleDefinition } from '../types.js';

function makeFinding(
  ruleId: string, severity: SemanticFinding['severity'], message: string,
  node: ts.Node, sourceFile: ts.SourceFile, fixSuggestion?: string,
): SemanticFinding {
  const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  return { ruleId, severity, message, file: sourceFile.fileName, line: line + 1, fixSuggestion };
}

/** Check if a catch clause variable name starts with underscore (intentionally unused). */
function isIntentionallyUnused(variableDecl: ts.VariableDeclaration | undefined): boolean {
  if (!variableDecl || !ts.isIdentifier(variableDecl.name)) return false;
  return variableDecl.name.text.startsWith('_');
}

/** Get real statements in a block (excluding EmptyStatement). */
function getRealStatements(block: ts.Block): ts.Statement[] {
  return block.statements.filter(stmt => stmt.kind !== ts.SyntaxKind.EmptyStatement);
}

/** Check if the error variable is referenced in the catch block. */
function isErrorVarUsed(catchClause: ts.CatchClause, errorVar: ts.Identifier): boolean {
  let found = false;
  function walk(n: ts.Node): void {
    if (found) return;
    if (ts.isIdentifier(n) && n !== errorVar && n.text === errorVar.text) { found = true; return; }
    ts.forEachChild(n, walk);
  }
  ts.forEachChild(catchClause, walk);
  return found;
}

export const p3ErrorCompleteness: RuleDefinition = {
  id: 'P3',
  name: 'Error Completeness',
  severity: 'HIGH',
  layer: 3,

  run(sourceFile: ts.SourceFile, checker: ts.TypeChecker): SemanticFinding[] {
    const findings: SemanticFinding[] = [];

    function visit(node: ts.Node): void {
      if (ts.isCatchClause(node)) {
        const block = node.block;
        const realStatements = getRealStatements(block);

        // Empty catch block → CRITICAL
        if (realStatements.length === 0) {
          findings.push(makeFinding(
            'P3', 'CRITICAL', 'Empty catch block silently swallows errors',
            node, sourceFile,
            'Add error logging, rethrow, or a comment explaining why the error is intentionally ignored',
          ));
          ts.forEachChild(node, visit);
          return;
        }

        // Check for rethrow
        const hasRethrow = realStatements.some(stmt => ts.isThrowStatement(stmt));

        // Error variable usage check
        const variableDecl = node.variableDeclaration;
        if (variableDecl && ts.isIdentifier(variableDecl.name)) {
          const errorVar = variableDecl.name;
          if (!isIntentionallyUnused(variableDecl) && !isErrorVarUsed(node, errorVar)) {
            findings.push(makeFinding(
              'P3', 'MEDIUM',
              `Caught error variable "${errorVar.text}" is never used`,
              variableDecl, sourceFile,
              'Use the error variable (log, rethrow) or prefix with _ if intentionally unused',
            ));
          }
        }

        // Catch with only console.log and no rethrow
        if (!hasRethrow && realStatements.length <= 2) {
          const onlyLogs = realStatements.every(stmt => {
            if (ts.isExpressionStatement(stmt) && ts.isCallExpression(stmt.expression)) {
              const callee = stmt.expression.expression;
              if (ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression) && callee.expression.text === 'console') {
                return true;
              }
            }
            return false;
          });
          if (onlyLogs && realStatements.length > 0) {
            findings.push(makeFinding(
              'P3', 'HIGH',
              'Catch block only logs the error without rethrowing or recovering',
              node, sourceFile,
              'Consider rethrowing the error or adding recovery logic',
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
