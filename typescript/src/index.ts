/**
 * parse-hcl - Lightweight Terraform HCL Parser
 *
 * A TypeScript library for parsing Terraform configuration files (.tf, .tf.json)
 * and related artifacts (tfvars, tfstate, plan.json).
 *
 * @packageDocumentation
 *
 * @example Basic Usage
 * ```typescript
 * import { TerraformParser, toJson, buildDependencyGraph } from 'parse-hcl';
 *
 * const parser = new TerraformParser();
 *
 * // Parse a single file
 * const doc = parser.parseFile('main.tf');
 *
 * // Parse a directory
 * const result = parser.parseDirectory('./terraform');
 *
 * // Build dependency graph
 * const graph = buildDependencyGraph(doc);
 *
 * // Serialize to JSON
 * const json = toJson(doc);
 * ```
 *
 * @example Working with Artifacts
 * ```typescript
 * import { TfVarsParser, TfStateParser, TfPlanParser } from 'parse-hcl';
 *
 * // Parse tfvars
 * const tfvars = new TfVarsParser().parseFile('terraform.tfvars');
 *
 * // Parse state
 * const state = new TfStateParser().parseFile('terraform.tfstate');
 *
 * // Parse plan
 * const plan = new TfPlanParser().parseFile('plan.json');
 * ```
 */

// Type definitions
export * from './types/blocks';
export * from './types/artifacts';

// Main parsers
export * from './services/terraformParser';
export * from './services/artifactParsers';
export * from './services/terraformJsonParser';

// Utilities
export * from './utils/serialization/serializer';
export * from './utils/graph/graphBuilder';
export * from './utils/common/errors';

// Re-export commonly used utilities
export { classifyValue } from './utils/parser/valueClassifier';
export { parseTypeConstraint } from './parsers/variableParser';
