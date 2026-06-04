import * as ts from 'typescript';
import type { SemanticFinding, RuleDefinition } from '../types.js';

/** Extract line/column from a node for use in findings. */
function loc(sourceFile: ts.SourceFile, node: ts.Node): { line: number; column: number } {
  const pos = node.getStart(sourceFile);
  const lc = sourceFile.getLineAndCharacterOfPosition(pos);
  return { line: lc.line + 1, column: lc.character + 1 };
}

/** Hardcoded path prefixes that indicate non-portable paths. */
const HARDCODED_PREFIXES = [
  '/home/', '/root/', '/etc/', '/var/', '/usr/', '/opt/',
  'C:\\', 'D:\\', 'E:\\',
  '/Users/', '/tmp/', '/dev/',
  '/proc/', '/sys/', '/run/',
];

/** Check if a string literal looks like a file path. */
function looksLikePath(text: string): boolean {
  if (text.includes('/') || text.includes('\\')) return true;
  const dotIdx = text.lastIndexOf('.');
  if (dotIdx > 0 && dotIdx < text.length - 1) {
    const ext = text.substring(dotIdx + 1);
    const commonExts = ['ts', 'js', 'json', 'yaml', 'yml', 'xml', 'txt', 'md', 'csv', 'sql', 'sh'];
    for (const e of commonExts) {
      if (ext === e) return true;
    }
  }
  return false;
}

function isHardcodedPath(text: string): boolean {
  for (const prefix of HARDCODED_PREFIXES) {
    if (text.startsWith(prefix)) return true;
  }
  if (text.length >= 2 && text.charAt(1) === ':' && text.charAt(2) === '\\') return true;
  if (text.startsWith('/') && !text.startsWith('//')) return true;
  return false;
}

/** Check if the string literal is inside a path resolution context. */
function isInPathResolutionContext(node: ts.StringLiteral): boolean {
  let current: ts.Node | undefined = node.parent;
  while (current) {
    // path.join(...), path.resolve(...), path.dirname(...)
    if (ts.isCallExpression(current)) {
      const expr = current.expression;
      if (ts.isPropertyAccessExpression(expr)) {
        const obj = expr.expression;
        const method = expr.name.text;
        if (ts.isIdentifier(obj) && obj.text === 'path') {
          if (method === 'join' || method === 'resolve' || method === 'dirname' || method === 'normalize') {
            return true;
          }
        }
      }
    }

    // Inside process.cwd() concatenation (e.g., `${process.cwd()}/...`)
    if (ts.isTemplateExpression(current)) {
      for (const span of current.templateSpans) {
        const spanExpr = span.expression;
        if (ts.isCallExpression(spanExpr)) {
          const callee = spanExpr.expression;
          if (ts.isPropertyAccessExpression(callee)) {
            const obj = callee.expression;
            if (ts.isIdentifier(obj) && obj.text === 'process' && callee.name.text === 'cwd') {
              return true;
            }
          }
        }
      }
    }

    // Inside __dirname / __filename concatenation
    if (ts.isBinaryExpression(current) && current.operatorToken.kind === ts.SyntaxKind.PlusToken) {
      if (isDirnameOrFilename(current.left) || isDirnameOrFilename(current.right)) {
        return true;
      }
    }

    current = current.parent;
  }
  return false;
}

function isDirnameOrFilename(node: ts.Node): boolean {
  if (ts.isIdentifier(node)) {
    return node.text === '__dirname' || node.text === '__filename';
  }
  return false;
}

/** Check if the string is inside a fs operation. */
function isInFsOperation(node: ts.StringLiteral): boolean {
  let current: ts.Node | undefined = node.parent;
  while (current) {
    if (ts.isCallExpression(current)) {
      const expr = current.expression;
      if (ts.isPropertyAccessExpression(expr)) {
        const obj = expr.expression;
        if (ts.isIdentifier(obj)) {
          const fsNames = ['fs', 'fsp', 'fsPromises', 'promises'];
          for (const fn of fsNames) {
            if (obj.text === fn) return true;
          }
        }
      }
    }
    current = current.parent;
  }
  return false;
}

export const p7PathResolution: RuleDefinition = {
  id: 'P7',
  name: 'Path Resolution',
  severity: 'MEDIUM',
  layer: 1,

  run(sourceFile: ts.SourceFile, checker: ts.TypeChecker): SemanticFinding[] {
    const findings: SemanticFinding[] = [];

    function visit(node: ts.Node): void {
      if (ts.isStringLiteral(node)) {
        const text = node.text;

        if (!looksLikePath(text)) {
          ts.forEachChild(node, visit);
          return;
        }

        if (isInPathResolutionContext(node)) {
          ts.forEachChild(node, visit);
          return;
        }

        if (isHardcodedPath(text)) {
          const { line, column } = loc(sourceFile, node);
          findings.push({
            ruleId: 'P7',
            severity: 'HIGH',
            message: `Hardcoded absolute path "${text}" — not portable across environments`,
            file: sourceFile.fileName,
            line,
            column,
            fixSuggestion: 'Use path.join(__dirname, ...) or process.cwd() to construct paths dynamically',
          });
        } else if (isInFsOperation(node)) {
          const { line, column } = loc(sourceFile, node);
          findings.push({
            ruleId: 'P7',
            severity: 'MEDIUM',
            message: `Relative path "${text}" used in filesystem operation without path.resolve()`,
            file: sourceFile.fileName,
            line,
            column,
            fixSuggestion: 'Use path.resolve() or path.join() to ensure correct path resolution',
          });
        }
      }

      ts.forEachChild(node, visit);
    }

    ts.forEachChild(sourceFile, visit);
    return findings;
  },
};
