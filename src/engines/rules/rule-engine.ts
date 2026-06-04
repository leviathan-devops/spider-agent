import * as ts from 'typescript';
import type { SemanticFinding, RuleDefinition } from '../types.js';

/** Create a SemanticFinding with line number automatically extracted from the node. */
function makeFinding(
  ruleId: string,
  severity: SemanticFinding['severity'],
  message: string,
  node: ts.Node,
  sourceFile: ts.SourceFile,
  fixSuggestion?: string,
): SemanticFinding {
  const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  return {
    ruleId,
    severity,
    message,
    file: sourceFile.fileName,
    line: line + 1, // 1-based
    fixSuggestion,
  };
}

export class RuleEngine {
  private rules: Map<string, RuleDefinition> = new Map();

  register(rule: RuleDefinition): void {
    if (this.rules.has(rule.id)) {
      throw new Error(`Rule ${rule.id} already registered: ${this.rules.get(rule.id)!.name}`);
    }
    this.rules.set(rule.id, rule);
  }

  registerAll(rules: RuleDefinition[]): void {
    for (const rule of rules) {
      this.register(rule);
    }
  }

  runOnSourceFile(sourceFile: ts.SourceFile, checker: ts.TypeChecker): SemanticFinding[] {
    const allFindings: SemanticFinding[] = [];
    for (const rule of this.rules.values()) {
      try {
        const findings = rule.run(sourceFile, checker);
        allFindings.push(...findings);
      } catch (err) {
        allFindings.push({
          ruleId: rule.id,
          severity: 'INFO',
          message: `Rule ${rule.id} ("${rule.name}") threw during analysis: ${err instanceof Error ? err.message : String(err)}`,
          file: sourceFile.fileName,
          line: 1,
        });
      }
    }
    return allFindings;
  }

  getRule(id: string): RuleDefinition | undefined {
    return this.rules.get(id);
  }

  getAllRules(): RuleDefinition[] {
    return Array.from(this.rules.values());
  }
}
