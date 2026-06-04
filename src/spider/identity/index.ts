/**
 * identity/index.ts — Barrel re-exports from identity modules
 *
 * This file re-exports all functions from the identity/ directory,
 * making them available via `import from '../spider/identity.js'`.
 */

export { formatSpiderIdentityHeader, VISION_CAPABILITIES } from './identity-header.js';
export { getSpiderInstructions, getSubagentIdentity } from './instructions.js';
