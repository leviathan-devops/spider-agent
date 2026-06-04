/**
 * Spider v2.3 — Layer Enforcer
 *
 * Overhauled to check ALL relative imports (both ./ AND ../),
 * not just parent-directory imports.
 *
 * Algorithm:
 *   1. Define a configurable layer map (not hardcoded)
 *   2. Check ALL relative imports (./ AND ../)
 *   3. Resolve to real file path
 *   4. Determine source and target layers
 *   5. Report violations where a lower layer imports from a higher layer
 */

import * as ts from 'typescript';
import * as path from 'path';
import type { SemanticFinding } from '../types.js';

// ---------------------------------------------------------------------------
// Layer map configuration
// ---------------------------------------------------------------------------

/**
 * Defines the architectural layers and their allowed dependency directions.
 * Lower numbers are lower layers (closer to the metal).
 * A layer may only import from the same layer or lower layers.
 */
export interface LayerMap {
  /** Map from directory pattern (regex string) to layer number. */
  patterns: Array<{
    /** Regex pattern to match against the file path. */
    pattern: string;
    /** The layer number (0 = lowest). */
    layer: number;
    /** Human-readable name for this layer. */
    name: string;
  }>;
  /**
   * If true, imports from a higher layer to a lower layer are violations.
   * If false, any cross-layer import is a violation.
   */
  allowDownwardImports: boolean;
}

/**
 * Default layer map for a typical TypeScript project.
 * Customize per project by passing a custom LayerMap to enforceLayers().
 */
const DEFAULT_LAYER_MAP: LayerMap = {
  patterns: [
    { pattern: '/src/core/', layer: 0, name: 'Core' },
    { pattern: '/src/engines/', layer: 1, name: 'Engines' },
    { pattern: '/src/services/', layer: 2, name: 'Services' },
    { pattern: '/src/harness/', layer: 3, name: 'Harness' },
    { pattern: '/src/adapters/', layer: 3, name: 'Adapters' },
    { pattern: '/src/cli/', layer: 4, name: 'CLI' },
    { pattern: '/src/web/', layer: 4, name: 'Web' },
    { pattern: '/src/test/', layer: 5, name: 'Test' },
  ],
  allowDownwardImports: true,
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Enforce architectural layer boundaries in a source file.
 *
 * @param sourceFile - The source file to analyze.
 * @param checker - The TypeScript TypeChecker (reserved for future type-based checks).
 * @param layerMap - Optional custom layer map. Uses the default if not provided.
 * @returns SemanticFindings for each layer violation.
 */
export function enforceLayers(
  sourceFile: ts.SourceFile,
  checker: ts.TypeChecker,
  layerMap?: LayerMap,
): SemanticFinding[] {
  const findings: SemanticFinding[] = [];
  const map = layerMap ?? DEFAULT_LAYER_MAP;

  // Determine the layer of the current file
  const sourceLayer = resolveLayer(sourceFile.fileName, map);
  if (sourceLayer === null) {
    // File doesn't match any layer pattern — skip it
    return findings;
  }

  // Walk all import declarations
  const visit = (node: ts.Node): void => {
    // import ... from '...'
    if (ts.isImportDeclaration(node) && node.moduleSpecifier) {
      const specifier = (node.moduleSpecifier as ts.StringLiteral).text;
      checkImport(sourceFile, sourceLayer, specifier, node, map, findings);
    }

    // import() dynamic expressions
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword
    ) {
      const arg = node.arguments[0];
      if (ts.isStringLiteral(arg)) {
        checkImport(sourceFile, sourceLayer, arg.text, node, map, findings);
      }
    }

    // export ... from '...'
    if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
      const specifier = (node.moduleSpecifier as ts.StringLiteral).text;
      checkImport(sourceFile, sourceLayer, specifier, node, map, findings);
    }

    ts.forEachChild(node, visit);
  };

  ts.forEachChild(sourceFile, visit);

  return findings;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Resolve a file path to its layer number.
 * Returns null if no layer pattern matches.
 */
function resolveLayer(
  filePath: string,
  map: LayerMap,
): { number: number; name: string } | null {
  // Normalize the path for consistent matching
  const normalized = filePath.replace(/\\/g, '/');

  for (const entry of map.patterns) {
    const regex = new RegExp(entry.pattern);
    if (regex.test(normalized)) {
      return { number: entry.layer, name: entry.name };
    }
  }

  return null;
}

/**
 * Check a single import for layer violations.
 */
function checkImport(
  sourceFile: ts.SourceFile,
  sourceLayer: { number: number; name: string },
  importSpecifier: string,
  node: ts.Node,
  map: LayerMap,
  findings: SemanticFinding[],
): void {
  // Only check relative imports (./ and ../)
  if (!importSpecifier.startsWith('.')) {
    return;
  }

  // Resolve the import to an absolute path
  const sourceDir = path.dirname(sourceFile.fileName);
  const resolvedPath = path.resolve(sourceDir, importSpecifier);

  // Determine the target layer
  const targetLayer = resolveLayer(resolvedPath, map);

  if (targetLayer === null) {
    // Target doesn't match any layer pattern — skip
    return;
  }

  // Check for layer violation
  if (map.allowDownwardImports) {
    // Violation: importing from a higher layer (lower layers shouldn't depend on higher)
    if (targetLayer.number > sourceLayer.number) {
      const { line, character } = sourceFile.getLineAndCharacterOfPosition(
        node.getStart(sourceFile),
      );
      findings.push({
        ruleId: 'L3-LAYER-VIOLATION',
        severity: 'HIGH',
        message:
          `Layer violation: ${sourceLayer.name} (layer ${sourceLayer.number}) ` +
          `imports from ${targetLayer.name} (layer ${targetLayer.number}). ` +
          `Lower layers must not depend on higher layers.`,
        file: sourceFile.fileName,
        line: line + 1,
        column: character + 1,
        fixSuggestion:
          `Move the shared code to layer ${sourceLayer.number} or lower, ` +
          `or restructure the dependency to flow downward.`,
      });
    }
  } else {
    // Strict mode: any cross-layer import is a violation
    if (targetLayer.number !== sourceLayer.number) {
      const { line, character } = sourceFile.getLineAndCharacterOfPosition(
        node.getStart(sourceFile),
      );
      findings.push({
        ruleId: 'L3-LAYER-VIOLATION',
        severity: 'HIGH',
        message:
          `Cross-layer import: ${sourceLayer.name} (layer ${sourceLayer.number}) ` +
          `imports from ${targetLayer.name} (layer ${targetLayer.number}). ` +
          `Strict layer enforcement prohibits all cross-layer imports.`,
        file: sourceFile.fileName,
        line: line + 1,
        column: character + 1,
        fixSuggestion:
          `Restructure to avoid cross-layer imports, or relax to allowDownwardImports.`,
      });
    }
  }
}
