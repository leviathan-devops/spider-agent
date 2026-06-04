import * as ts from 'typescript';
import type { SemanticFinding, RuleDefinition } from '../types.js';

function makeFinding(
  ruleId: string, severity: SemanticFinding['severity'], message: string,
  node: ts.Node, sourceFile: ts.SourceFile, fixSuggestion?: string,
): SemanticFinding {
  const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  return { ruleId, severity, message, file: sourceFile.fileName, line: line + 1, fixSuggestion };
}

const WRITE_METHODS = new Set([
  'writeFileSync', 'writeFile', 'appendFileSync', 'appendFile',
  'mkdirSync', 'mkdir', 'rmdir', 'rmdirSync',
  'copyFileSync', 'copyFile', 'renameSync', 'rename',
  'createWriteStream', 'symlinkSync', 'symlink', 'linkSync', 'link',
  'truncateSync', 'truncate', 'chmodSync', 'chmod',
]);

const FS_IDENTIFIERS = new Set(['fs', 'fsp', 'fsPromises', 'promises']);

function isFsWriteCall(node: ts.CallExpression): { method: string; pathArg: ts.Expression } | null {
  const expr = node.expression;
  if (!ts.isPropertyAccessExpression(expr)) return null;
  if (!WRITE_METHODS.has(expr.name.text)) return null;
  const obj = expr.expression;
  if (ts.isIdentifier(obj) && FS_IDENTIFIERS.has(obj.text) && node.arguments.length > 0) {
    return { method: expr.name.text, pathArg: node.arguments[0] };
  }
  return null;
}

function isDirnameReference(node: ts.Node): boolean {
  if (ts.isIdentifier(node)) return node.text === '__dirname' || node.text === '__filename';
  if (ts.isCallExpression(node)) {
    const expr = node.expression;
    if (ts.isPropertyAccessExpression(expr) && ts.isIdentifier(expr.expression) &&
        expr.expression.text === 'process' && expr.name.text === 'cwd') return true;
  }
  return false;
}

function analyzePathArg(pathArg: ts.Expression): {
  type: 'literal' | 'resolved' | 'template' | 'dynamic';
  literalValue?: string;
  isWithinProject?: boolean;
} {
  if (ts.isStringLiteral(pathArg)) {
    return { type: 'literal', literalValue: pathArg.text, isWithinProject: false };
  }

  if (ts.isCallExpression(pathArg)) {
    const expr = pathArg.expression;
    if (ts.isPropertyAccessExpression(expr) && ts.isIdentifier(expr.expression) && expr.expression.text === 'path') {
      const method = expr.name.text;
      if (method === 'join' || method === 'resolve' || method === 'normalize') {
        return { type: 'resolved', isWithinProject: true };
      }
    }
  }

  if (ts.isTemplateExpression(pathArg)) {
    for (const span of pathArg.templateSpans) {
      const spanExpr = span.expression;
      if (ts.isIdentifier(spanExpr) && (spanExpr.text === '__dirname' || spanExpr.text === '__filename')) {
        return { type: 'template', isWithinProject: true };
      }
      if (ts.isCallExpression(spanExpr)) {
        const callObj = spanExpr.expression;
        if (ts.isPropertyAccessExpression(callObj) && ts.isIdentifier(callObj.expression) &&
            callObj.expression.text === 'process' && callObj.name.text === 'cwd') {
          return { type: 'template', isWithinProject: true };
        }
      }
    }
    return { type: 'template', isWithinProject: false };
  }

  if (ts.isBinaryExpression(pathArg) && pathArg.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    if (isDirnameReference(pathArg.left) || isDirnameReference(pathArg.right)) {
      return { type: 'resolved', isWithinProject: true };
    }
  }

  return { type: 'dynamic' };
}

const OUTSIDE_PREFIXES = [
  '/home/', '/root/', '/etc/', '/var/', '/usr/', '/opt/',
  '/tmp/', '/dev/', '/proc/', '/sys/', '/run/',
  'C:\\Windows\\', 'C:\\Program Files\\',
];

function isOutsideProjectPath(path: string): boolean {
  for (const prefix of OUTSIDE_PREFIXES) { if (path.startsWith(prefix)) return true; }
  if (path.length >= 3 && path.charAt(1) === ':' && path.charAt(2) === '\\') return true;
  if (path.startsWith('/') && !path.startsWith('./') && !path.startsWith('../')) return true;
  return false;
}

export const p12ProjectBoundaries: RuleDefinition = {
  id: 'P12',
  name: 'Project Boundaries',
  severity: 'CRITICAL',
  layer: 4,

  run(sourceFile: ts.SourceFile, checker: ts.TypeChecker): SemanticFinding[] {
    const findings: SemanticFinding[] = [];

    function visit(node: ts.Node): void {
      if (ts.isCallExpression(node)) {
        const writeOp = isFsWriteCall(node);
        if (writeOp) {
          const analysis = analyzePathArg(writeOp.pathArg);
          switch (analysis.type) {
            case 'literal': {
              const pathValue = analysis.literalValue!;
              if (isOutsideProjectPath(pathValue)) {
                findings.push(makeFinding(
                  'P12', 'CRITICAL',
                  `Filesystem write to absolute path "${pathValue}" — outside project boundary`,
                  node, sourceFile,
                  'Use path.join(__dirname, ...) or path.resolve(process.cwd(), ...) to stay within the project',
                ));
              }
              break;
            }
            case 'resolved': {
              if (!analysis.isWithinProject) {
                findings.push(makeFinding(
                  'P12', 'HIGH',
                  'Filesystem write path not resolved relative to project — may escape boundaries',
                  node, sourceFile,
                  'Use path.join(__dirname, ...) or path.resolve(process.cwd(), ...)',
                ));
              }
              break;
            }
            case 'template': {
              if (!analysis.isWithinProject) {
                findings.push(makeFinding(
                  'P12', 'HIGH',
                  'Filesystem write uses template literal path without project-root anchor — review required',
                  node, sourceFile,
                  'Use __dirname or process.cwd() in the template to anchor the path to the project',
                ));
              }
              break;
            }
            case 'dynamic': {
              findings.push(makeFinding(
                'P12', 'MEDIUM',
                'Filesystem write to dynamic path — cannot verify project boundary at analysis time',
                node, sourceFile,
                'Validate the path at runtime to ensure it stays within the project directory',
              ));
              break;
            }
          }
        }
      }

      ts.forEachChild(node, visit);
    }

    ts.forEachChild(sourceFile, visit);
    return findings;
  },
};
