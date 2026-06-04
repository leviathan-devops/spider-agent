/**
 * Spider v2.3 — Compiler Host
 *
 * Wraps the TypeScript compiler API to provide both disk-backed and
 * in-memory semantic engine instances.  Every rule in the 6-layer
 * pipeline receives the `SemanticEngine` (program + checker) so that
 * it can perform TypeChecker-backed analysis instead of raw-text
 * searching.
 *
 * Key design decisions:
 *  1. The TypeChecker is always available — no rule should ever fall
 *     back to `sourceFile.getText().includes(…)` for semantic queries.
 *  2. In-memory engines support unit-testing rules without touching
 *     the filesystem.
 *  3. Source-file filtering excludes .d.ts files and lib files so
 *     that rules only see user code.
 */

import * as ts from 'typescript';
import * as path from 'path';
import * as fs from 'fs';

// ---------------------------------------------------------------------------
// SemanticEngine interface
// ---------------------------------------------------------------------------

/**
 * A handle to a fully-initialised TypeScript program and its
 * TypeChecker.  This is the primary entry point that every audit
 * layer receives.
 */
export interface SemanticEngine {
  /** The TypeScript program instance. */
  readonly program: ts.Program;
  /** The type checker — rules MUST use this instead of text matching. */
  readonly checker: ts.TypeChecker;
  /** Get all user source files (excludes declaration files and lib). */
  getSourceFiles(): ts.SourceFile[];
  /** Dispose of resources. Call when the engine is no longer needed. */
  dispose(): void;
}

// ---------------------------------------------------------------------------
// Default compiler options
// ---------------------------------------------------------------------------

const DEFAULT_COMPILER_OPTIONS: ts.CompilerOptions = {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.NodeNext,
  moduleResolution: ts.ModuleResolutionKind.NodeNext,
  strict: true,
  esModuleInterop: true,
  skipLibCheck: true,
  forceConsistentCasingInFileNames: true,
  resolveJsonModule: true,
  declaration: true,
  sourceMap: true,
  lib: ['lib.es2022.d.ts'],
};

// ---------------------------------------------------------------------------
// Disk-backed semantic engine
// ---------------------------------------------------------------------------

/**
 * Create a `SemanticEngine` that reads source files from disk.
 *
 * @param filePaths - Absolute or relative paths to the `.ts` files to
 *   analyse.  At least one file is required (enforced by the L0
 *   empty-set gate).
 * @param compilerOptions - Optional overrides for the compiler options.
 */
export function createSemanticEngine(
  filePaths: string[],
  compilerOptions?: ts.CompilerOptions,
): SemanticEngine {
  if (filePaths.length === 0) {
    throw new Error(
      '[Spider v2.3] createSemanticEngine: filePaths must not be empty. ' +
      'The L0 empty-set consensus gate requires at least one file.',
    );
  }

  const options: ts.CompilerOptions = {
    ...DEFAULT_COMPILER_OPTIONS,
    ...compilerOptions,
  };

  const host = ts.createCompilerHost(options);

  // Validate that every requested file actually exists on disk.
  for (const fp of filePaths) {
    if (!host.fileExists(fp)) {
      throw new Error(
        `[Spider v2.3] createSemanticEngine: file not found: ${fp}`,
      );
    }
  }

  const program = ts.createProgram(filePaths, options, host);
  const checker = program.getTypeChecker();

  let disposed = false;

  return {
    program,
    checker,
    getSourceFiles(): ts.SourceFile[] {
      if (disposed) {
        throw new Error('[Spider v2.3] SemanticEngine has been disposed.');
      }
      return program
        .getSourceFiles()
        .filter((sf) => !sf.isDeclarationFile);
    },
    dispose(): void {
      disposed = true;
      // The TypeScript program and checker hold no external resources
      // that need explicit cleanup, but we mark the engine as disposed
      // to prevent accidental reuse.
    },
  };
}

// ---------------------------------------------------------------------------
// In-memory semantic engine (for testing)
// ---------------------------------------------------------------------------

/**
 * Create a `SemanticEngine` that reads source files from an in-memory
 * map.  Falls through to disk for lib files and any file not present
 * in the map.
 *
 * This is the preferred way to unit-test audit rules: supply the
 * source text as a `Map<string, string>` and avoid filesystem I/O
 * entirely.
 *
 * @param files - Map from file name to source text.
 * @param compilerOptions - Optional overrides for the compiler options.
 */
export function createInMemoryEngine(
  files: Map<string, string>,
  compilerOptions?: ts.CompilerOptions,
): SemanticEngine {
  if (files.size === 0) {
    throw new Error(
      '[Spider v2.3] createInMemoryEngine: files map must not be empty. ' +
      'The L0 empty-set consensus gate requires at least one file.',
    );
  }

  const options: ts.CompilerOptions = {
    ...DEFAULT_COMPILER_OPTIONS,
    ...compilerOptions,
  };

  // Normalise all file paths to absolute for consistent look-up.
  const fileMap = new Map<string, string>();
  for (const [name, content] of files) {
    fileMap.set(path.resolve(name), content);
  }

  const resolvedNames = [...fileMap.keys()];

  // -----------------------------------------------------------------------
  // Custom CompilerHost
  // -----------------------------------------------------------------------

  const host: ts.CompilerHost = {
    getSourceFile(fileName: string): ts.SourceFile | undefined {
      const resolved = path.resolve(fileName);
      const content = fileMap.get(resolved);
      if (content !== undefined) {
        return ts.createSourceFile(
          fileName,
          content,
          options.target ?? ts.ScriptTarget.ES2022,
          /* setParentNodes */ true,
        );
      }

      // Fall back to disk (needed for lib.d.ts and other ambient files).
      try {
        const diskContent = fs.readFileSync(fileName, 'utf-8');
        return ts.createSourceFile(
          fileName,
          diskContent,
          options.target ?? ts.ScriptTarget.ES2022,
          /* setParentNodes */ true,
        );
      } catch {
        return undefined;
      }
    },

    getDefaultLibFileName(o: ts.CompilerOptions): string {
      return ts.getDefaultLibFilePath(o);
    },

    writeFile(): void {
      // No-op — we never write output for in-memory engines.
    },

    getCurrentDirectory(): string {
      return process.cwd();
    },

    getDirectories(dir: string): string[] {
      try {
        return fs
          .readdirSync(dir)
          .filter((f) => fs.statSync(path.join(dir, f)).isDirectory());
      } catch {
        return [];
      }
    },

    fileExists(fileName: string): boolean {
      const resolved = path.resolve(fileName);
      if (fileMap.has(resolved)) return true;
      try {
        fs.accessSync(fileName, fs.constants.R_OK);
        return true;
      } catch {
        return false;
      }
    },

    readFile(fileName: string): string | undefined {
      const resolved = path.resolve(fileName);
      const content = fileMap.get(resolved);
      if (content !== undefined) return content;
      try {
        return fs.readFileSync(fileName, 'utf-8');
      } catch {
        return undefined;
      }
    },

    getCanonicalFileName(name: string): string {
      return name;
    },

    useCaseSensitiveFileNames(): boolean {
      return true;
    },

    getNewLine(): string {
      return '\n';
    },
  };

  const program = ts.createProgram(resolvedNames, options, host);
  const checker = program.getTypeChecker();

  let disposed = false;

  return {
    program,
    checker,
    getSourceFiles(): ts.SourceFile[] {
      if (disposed) {
        throw new Error('[Spider v2.3] SemanticEngine has been disposed.');
      }
      return program.getSourceFiles().filter((sf) => {
        if (sf.isDeclarationFile) return false;
        // Only include files that were explicitly provided in the map.
        return resolvedNames.some(
          (p) => path.resolve(p) === path.resolve(sf.fileName),
        );
      });
    },
    dispose(): void {
      disposed = true;
    },
  };
}

// ---------------------------------------------------------------------------
// Utility: extract the syntactic diagnostics for all user files
// ---------------------------------------------------------------------------

/**
 * Collect syntactic diagnostics (parse errors) from the engine's
 * program.  Returns an array of objects suitable for converting to
 * `SemanticFinding`s.
 */
export function getSyntacticDiagnostics(
  engine: SemanticEngine,
): Array<{ file: string; line: number; column: number; message: string }> {
  const results: Array<{
    file: string;
    line: number;
    column: number;
    message: string;
  }> = [];

  for (const sf of engine.getSourceFiles()) {
    const diags = engine.program.getSyntacticDiagnostics(sf);
    for (const d of diags) {
      const lineAndChar = sf.getLineAndCharacterOfPosition(d.start ?? 0);
      results.push({
        file: sf.fileName,
        line: lineAndChar.line + 1,
        column: lineAndChar.character + 1,
        message:
          typeof d.messageText === 'string'
            ? d.messageText
            : d.messageText.messageText,
      });
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Utility: extract the semantic diagnostics for all user files
// ---------------------------------------------------------------------------

/**
 * Collect semantic diagnostics (type errors) from the engine's
 * program.  Useful for L3 semantic-correctness checks.
 */
export function getSemanticDiagnostics(
  engine: SemanticEngine,
): Array<{ file: string; line: number; column: number; message: string; code: number }> {
  const results: Array<{
    file: string;
    line: number;
    column: number;
    message: string;
    code: number;
  }> = [];

  for (const sf of engine.getSourceFiles()) {
    const diags = engine.program.getSemanticDiagnostics(sf);
    for (const d of diags) {
      const lineAndChar = sf.getLineAndCharacterOfPosition(d.start ?? 0);
      results.push({
        file: sf.fileName,
        line: lineAndChar.line + 1,
        column: lineAndChar.character + 1,
        message:
          typeof d.messageText === 'string'
            ? d.messageText
            : flattenDiagnosticChain(d.messageText),
        code: d.code,
      });
    }
  }

  return results;
}

/**
 * Flatten a TypeScript diagnostic message chain into a single string.
 */
function flattenDiagnosticChain(chain: ts.DiagnosticMessageChain): string {
  const parts: string[] = [];
  let current: ts.DiagnosticMessageChain | undefined = chain;
  while (current) {
    parts.push(current.messageText);
    current = current.next?.[0];
  }
  return parts.join(' → ');
}
