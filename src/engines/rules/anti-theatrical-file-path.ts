import * as ts from 'typescript';
import * as path from 'path';
import * as fs from 'fs';
import type { SemanticFinding, RuleDefinition } from '../types.js';

function makeFinding(
  ruleId: string, severity: SemanticFinding['severity'], message: string,
  node: ts.Node, sourceFile: ts.SourceFile, fixSuggestion?: string,
): SemanticFinding {
  const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  return { ruleId, severity, message, file: sourceFile.fileName, line: line + 1, fixSuggestion };
}

function looksLikeFilePath(text: string): boolean {
  if (text.includes('/') || text.includes('\\')) return true;
  const dotIdx = text.lastIndexOf('.');
  if (dotIdx > 0 && dotIdx < text.length - 1) {
    const ext = text.substring(dotIdx + 1);
    const codeExts = ['ts', 'js', 'json', 'yaml', 'yml', 'xml', 'txt', 'md', 'csv', 'sql', 'sh', 'py', 'rb', 'go', 'rs'];
    for (const e of codeExts) { if (ext === e) return true; }
  }
  return false;
}

function hasPathTraversal(text: string): boolean {
  const parts = text.split(/[/\\]/);
  for (const part of parts) { if (part === '..') return true; }
  return false;
}

function isSystemPath(text: string): boolean {
  const systemPrefixes = [
    '/etc/', '/root/', '/home/', '/usr/', '/var/', '/proc/', '/sys/',
    'C:\\Windows\\', 'C:\\Program Files\\', 'C:\\System32\\',
  ];
  for (const prefix of systemPrefixes) { if (text.startsWith(prefix)) return true; }
  return false;
}

function resolveAndCheckPath(sourceFilePath: string, referencedPath: string): { resolved: string; exists: boolean } {
  try {
    const sourceDir = path.dirname(sourceFilePath);
    const resolved = path.resolve(sourceDir, referencedPath);
    const exists = fs.existsSync(resolved);
    return { resolved, exists };
  } catch {
    return { resolved: referencedPath, exists: false };
  }
}

function isPathPropertyName(name: string): boolean {
  const pathNames = ['path', 'filePath', 'file', 'filename', 'sourcePath', 'targetPath',
    'outputPath', 'inputPath', 'dir', 'directory', 'folder', 'location', 'src', 'dest'];
  for (const pn of pathNames) { if (name === pn) return true; }
  return false;
}

function isInReturnContext(node: ts.Node): boolean {
  let current: ts.Node | undefined = node.parent;
  while (current) {
    if (ts.isReturnStatement(current)) return true;
    current = current.parent;
  }
  return false;
}

export const antiTheatricalFilePath: RuleDefinition = {
  id: 'Anti-Theatrical-File-Path',
  name: 'Anti Theatrical File Path',
  severity: 'CRITICAL',
  layer: 5,

  run(sourceFile: ts.SourceFile, checker: ts.TypeChecker): SemanticFinding[] {
    const findings: SemanticFinding[] = [];

    function visit(node: ts.Node): void {
      // String literals that look like file paths
      if (ts.isStringLiteral(node) && looksLikeFilePath(node.text)) {
        const text = node.text;

        if (hasPathTraversal(text)) {
          findings.push(makeFinding(
            'Anti-Theatrical-File-Path', 'HIGH',
            `Path traversal pattern detected in "${text}"`,
            node, sourceFile,
            'Validate and sanitize paths to prevent directory traversal attacks',
          ));
        }

        if (isSystemPath(text)) {
          findings.push(makeFinding(
            'Anti-Theatrical-File-Path', 'CRITICAL',
            `System path "${text}" referenced — likely fabricated or dangerous`,
            node, sourceFile,
            'Remove hardcoded system paths; use path resolution relative to project root',
          ));
        }

        const { exists, resolved } = resolveAndCheckPath(sourceFile.fileName, text);
        if (!exists && !text.startsWith('/') && !text.includes('node_modules')) {
          if (isInReturnContext(node)) {
            findings.push(makeFinding(
              'Anti-Theatrical-File-Path', 'HIGH',
              `Referenced path "${text}" does not exist on disk (resolved to "${resolved}") — may be fabricated`,
              node, sourceFile,
              'Verify the path exists or use a dynamic path resolution method',
            ));
          }
        }
      }

      // Property assignments where name suggests a path
      if (ts.isPropertyAssignment(node) && ts.isIdentifier(node.name) && isPathPropertyName(node.name.text)) {
        const value = node.initializer;
        if (ts.isTemplateExpression(value)) {
          for (const span of value.templateSpans) {
            if (ts.isIdentifier(span.expression)) {
              const varName = span.expression.text;
              if (varName !== '__dirname' && varName !== '__filename' && varName !== 'rootDir') {
                findings.push(makeFinding(
                  'Anti-Theatrical-File-Path', 'MEDIUM',
                  `Path property "${node.name.text}" uses variable "${varName}" — verify this resolves to a real path`,
                  node, sourceFile,
                  'Ensure the variable resolves to a valid, existing path at runtime',
                ));
              }
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
