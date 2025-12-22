/**
 * Type definitions for Terraform artifacts (state files, plans, tfvars) and dependency graphs.
 */

import { BlockKind, Reference, TerraformDocument, Value } from './blocks';

/**
 * Types of nodes in the dependency graph.
 * Extends BlockKind with special node types for references.
 */
export type GraphNodeKind =
    | BlockKind
    | 'module_output'
    | 'path'
    | 'each'
    | 'count'
    | 'self'
    | 'external';

/**
 * A node in the dependency graph representing a Terraform element.
 */
export interface GraphNode {
    /** Unique identifier for the node */
    id: string;
    /** The kind/type of the node */
    kind: GraphNodeKind;
    /** Display name for the node */
    name: string;
    /** Resource/data type (for resource and data nodes) */
    type?: string;
    /** Source file path (if known) */
    source?: string;
}

/**
 * An edge in the dependency graph representing a reference.
 */
export interface GraphEdge {
    /** The source node ID */
    from: string;
    /** The target node ID */
    to: string;
    /** The reference that created this edge */
    reference: Reference;
    /** Source file path where the reference was found */
    source?: string;
}

/**
 * Complete dependency graph with nodes, edges, and orphan references.
 */
export interface DependencyGraph {
    /** All nodes in the graph */
    nodes: GraphNode[];
    /** All edges (dependencies) in the graph */
    edges: GraphEdge[];
    /** References that could not be resolved to nodes */
    orphanReferences: Reference[];
}

/**
 * Export format containing document, graph, and metadata.
 */
export interface TerraformExport {
    /** Export format version */
    version: string;
    /** The parsed document (may be partial for filtered exports) */
    document: Partial<TerraformDocument>;
    /** The dependency graph */
    graph: DependencyGraph;
}

/**
 * Parsed tfvars document containing variable assignments.
 */
export interface TfVarsDocument {
    /** Source file path */
    source: string;
    /** Raw file content */
    raw: string;
    /** Variable assignments (name -> value) */
    assignments: Record<string, Value>;
}

/**
 * An output value from Terraform state.
 */
export interface TerraformStateOutput {
    /** The output value */
    value: unknown;
    /** The output type */
    type?: string | string[];
    /** Whether the output is sensitive */
    sensitive?: boolean;
}

/**
 * A resource instance in Terraform state.
 */
export interface TerraformStateInstance {
    /** Index key (for count/for_each resources) */
    index_key?: string | number;
    /** Resource attributes */
    attributes?: Record<string, unknown>;
    /** Instance status */
    status?: string;
}

/**
 * A resource in Terraform state.
 */
export interface TerraformStateResource {
    /** Module address (for resources in modules) */
    module?: string;
    /** Resource mode (managed or data) */
    mode: 'managed' | 'data';
    /** Resource type */
    type: string;
    /** Resource name */
    name: string;
    /** Provider configuration */
    provider?: string;
    /** Resource instances */
    instances: TerraformStateInstance[];
}

/**
 * Parsed Terraform state document.
 */
export interface TerraformStateDocument {
    /** State format version */
    version: number;
    /** Terraform version that created the state */
    terraform_version?: string;
    /** State serial number */
    serial?: number;
    /** State lineage (unique identifier) */
    lineage?: string;
    /** Output values */
    outputs: Record<string, TerraformStateOutput>;
    /** Resources in state */
    resources: TerraformStateResource[];
    /** Raw state data */
    raw: unknown;
    /** Source file path */
    source: string;
}

/**
 * A resource change in a Terraform plan.
 */
export interface PlanResourceChange {
    /** Resource address */
    address: string;
    /** Module address (if in a module) */
    module_address?: string;
    /** Resource mode */
    mode: 'managed' | 'data';
    /** Resource type */
    type: string;
    /** Resource name */
    name: string;
    /** Provider name */
    provider_name?: string;
    /** Change details */
    change: {
        /** Actions to perform (create, update, delete, etc.) */
        actions: string[];
        /** State before change */
        before?: unknown;
        /** State after change */
        after?: unknown;
        /** Unknown values after change */
        after_unknown?: Record<string, unknown>;
        /** Sensitive values before change */
        before_sensitive?: Record<string, unknown>;
        /** Sensitive values after change */
        after_sensitive?: Record<string, unknown>;
    };
}

/**
 * A resource in planned values.
 */
export interface PlanResource {
    /** Resource address */
    address: string;
    /** Resource mode */
    mode: 'managed' | 'data';
    /** Resource type */
    type: string;
    /** Resource name */
    name: string;
    /** Provider name */
    provider_name?: string;
    /** Resource values */
    values?: Record<string, unknown>;
}

/**
 * A module in planned values.
 */
export interface PlanModule {
    /** Module address */
    address?: string;
    /** Resources in the module */
    resources?: PlanResource[];
    /** Child modules */
    child_modules?: PlanModule[];
}

/**
 * Parsed Terraform plan document.
 */
export interface TerraformPlanDocument {
    /** Plan format version */
    format_version?: string;
    /** Terraform version */
    terraform_version?: string;
    /** Planned values */
    planned_values?: {
        /** Root module */
        root_module?: PlanModule;
    };
    /** Resource changes */
    resource_changes: PlanResourceChange[];
    /** Raw plan data */
    raw: unknown;
    /** Source file path */
    source: string;
}
