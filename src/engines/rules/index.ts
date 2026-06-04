export { RuleEngine } from './rule-engine.js';
export { p1DefensiveImport } from './p1-defensive-import.js';
export { p2TypeCertainty } from './p2-type-certainty.js';
export { p3ErrorCompleteness } from './p3-error-completeness.js';
export { p4ResourceLifecycle } from './p4-resource-lifecycle.js';
export { p5AtomicState } from './p5-atomic-state.js';
export { p6DependencyVerification } from './p6-dependency-verification.js';
export { p7PathResolution } from './p7-path-resolution.js';
export { p8ConfigValidation } from './p8-config-validation.js';
export { p9AsyncDiscipline } from './p9-async-discipline.js';
export { p10OutputContract } from './p10-output-contract.js';
export { p11SideEffectTruth } from './p11-side-effect-truth.js';
export { p12ProjectBoundaries } from './p12-project-boundaries.js';
export { antiEmptySetConsensus } from './anti-empty-set-consensus.js';
export { antiTheatricalFilePath } from './anti-theatrical-file-path.js';

import type { RuleDefinition } from '../types.js';
import { p1DefensiveImport } from './p1-defensive-import.js';
import { p2TypeCertainty } from './p2-type-certainty.js';
import { p3ErrorCompleteness } from './p3-error-completeness.js';
import { p4ResourceLifecycle } from './p4-resource-lifecycle.js';
import { p5AtomicState } from './p5-atomic-state.js';
import { p6DependencyVerification } from './p6-dependency-verification.js';
import { p7PathResolution } from './p7-path-resolution.js';
import { p8ConfigValidation } from './p8-config-validation.js';
import { p9AsyncDiscipline } from './p9-async-discipline.js';
import { p10OutputContract } from './p10-output-contract.js';
import { p11SideEffectTruth } from './p11-side-effect-truth.js';
import { p12ProjectBoundaries } from './p12-project-boundaries.js';
import { antiEmptySetConsensus } from './anti-empty-set-consensus.js';
import { antiTheatricalFilePath } from './anti-theatrical-file-path.js';

export const allRules: RuleDefinition[] = [
  p1DefensiveImport,
  p2TypeCertainty,
  p3ErrorCompleteness,
  p4ResourceLifecycle,
  p5AtomicState,
  p6DependencyVerification,
  p7PathResolution,
  p8ConfigValidation,
  p9AsyncDiscipline,
  p10OutputContract,
  p11SideEffectTruth,
  p12ProjectBoundaries,
  antiEmptySetConsensus,
  antiTheatricalFilePath,
];
