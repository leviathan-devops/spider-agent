import * as ts from 'typescript';
import type { SemanticFinding, RuleDefinition } from '../types.js';

function makeFinding(
  ruleId: string, severity: SemanticFinding['severity'], message: string,
  node: ts.Node, sourceFile: ts.SourceFile, fixSuggestion?: string,
): SemanticFinding {
  const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  return { ruleId, severity, message, file: sourceFile.fileName, line: line + 1, fixSuggestion };
}

/**
 * THEATRICAL_PROPERTIES — the regex with FIXED anchoring.
 * The parentheses grouping ensures the alternation is properly scoped
 * so ^ and $ anchor the entire expression, not just the last alternative.
 */
const THEATRICAL_PROPERTIES = /^(success|dispersed|consensus|evidencePath|passed|verified|complete|overallPassed|delivered|dispatched|spawned)$/i;

const IO_INDICATORS = new Set([
  // File/disk operations
  'writeFileSync', 'writeFile', 'mkdirSync', 'mkdir',
  'execSync', 'exec', 'spawn', 'spawnSync',
  'appendFileSync', 'appendFile', 'copyFileSync', 'renameSync',
  'readFileSync', 'readFile', 'readdirSync', 'readdir',
  'unlinkSync', 'unlink', 'rmSync', 'rm', 'statSync',
  // Network operations
  'fetch', 'request', 'send', 'emit', 'publish',
  'post', 'get', 'put', 'delete', 'httpRequest',
  // Computation operations — real work that produces results
  'reduce', 'reduceRight', 'map', 'filter', 'flatMap',
  'forEach', 'sort', 'every', 'some', 'find', 'findIndex',
  'findLast', 'findLastIndex', 'flat', 'slice', 'splice',
  'concat', 'reverse', 'join', 'split', 'replace',
  'toUpperCase', 'toLowerCase', 'trim', 'substring',
  'reduce', 'includes', 'indexOf', 'lastIndexOf',
]);

function isTheatricalProperty(name: string): boolean {
  return THEATRICAL_PROPERTIES.test(name);
}

function getTheatricalProperties(objLit: ts.ObjectLiteralExpression): string[] {
  const theatrical: string[] = [];
  for (const prop of objLit.properties) {
    let name: string | undefined;
    if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name)) name = prop.name.text;
    else if (ts.isShorthandPropertyAssignment(prop)) name = prop.name.text;
    else if (ts.isPropertyAssignment(prop) && ts.isStringLiteral(prop.name)) name = prop.name.text;
    if (name && isTheatricalProperty(name)) theatrical.push(name);
  }
  return theatrical;
}

function containsIOCall(stmt: ts.Statement): boolean {
  let found = false;
  function walk(n: ts.Node): void {
    if (found) return;
    if (ts.isCallExpression(n)) {
      const expr = n.expression;
      if (ts.isIdentifier(expr) && IO_INDICATORS.has(expr.text)) { found = true; return; }
      if (ts.isPropertyAccessExpression(expr) && IO_INDICATORS.has(expr.name.text)) { found = true; return; }
    }
    ts.forEachChild(n, walk);
  }
  ts.forEachChild(stmt, walk);
  return found;
}

function getEnclosingFunction(node: ts.Node): ts.FunctionLikeDeclaration | undefined {
  let current: ts.Node | undefined = node.parent;
  while (current) {
    if (ts.isFunctionDeclaration(current) || ts.isArrowFunction(current) ||
        ts.isFunctionExpression(current) || ts.isMethodDeclaration(current)) return current;
    current = current.parent;
  }
  return undefined;
}

function getStatementsBeforeReturn(retStmt: ts.ReturnStatement): ts.Statement[] {
  const parent = retStmt.parent;
  if (!ts.isBlock(parent)) return [];
  const idx = parent.statements.indexOf(retStmt);
  if (idx < 0) return [];
  return parent.statements.slice(0, idx);
}

export const p11SideEffectTruth: RuleDefinition = {
  id: 'P11',
  name: 'Side Effect Truth',
  severity: 'CRITICAL',
  layer: 4,

  run(sourceFile: ts.SourceFile, checker: ts.TypeChecker): SemanticFinding[] {
    const findings: SemanticFinding[] = [];

    function visit(node: ts.Node): void {
      if (ts.isReturnStatement(node) && node.expression && ts.isObjectLiteralExpression(node.expression)) {
        const theatrical = getTheatricalProperties(node.expression);
        if (theatrical.length === 0) { ts.forEachChild(node, visit); return; }

        const fn = getEnclosingFunction(node);
        if (!fn || !fn.body || !ts.isBlock(fn.body)) { ts.forEachChild(node, visit); return; }

        const stmtsBefore = getStatementsBeforeReturn(node);
        const hasIO = stmtsBefore.some(stmt => containsIOCall(stmt));

        if (!hasIO) {
          let anyIO = false;
          function walkForIO(n: ts.Node): void {
            if (anyIO) return;
            if (n !== fn && (ts.isFunctionDeclaration(n) || ts.isArrowFunction(n) ||
                ts.isFunctionExpression(n) || ts.isMethodDeclaration(n))) return;
            if (ts.isCallExpression(n)) {
              const expr = n.expression;
              if (ts.isIdentifier(expr) && IO_INDICATORS.has(expr.text)) { anyIO = true; return; }
              if (ts.isPropertyAccessExpression(expr) && IO_INDICATORS.has(expr.name.text)) { anyIO = true; return; }
            }
            ts.forEachChild(n, walkForIO);
          }
          ts.forEachChild(fn.body, walkForIO);

          if (!anyIO) {
            findings.push(makeFinding(
              'P11', 'CRITICAL',
              `Function returns theatrical properties [${theatrical.join(', ')}] without performing any I/O — these claims are unverifiable`,
              node, sourceFile,
              'Add actual I/O verification before returning success properties, or rename properties to reflect intent',
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
