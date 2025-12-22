import { BlockKind, Reference, TerraformDocument, Value } from './blocks';

export type GraphNodeKind = BlockKind | 'module_output' | 'path' | 'external';

export interface GraphNode {
    id: string;
    kind: GraphNodeKind;
    name: string;
    type?: string;
    source?: string;
}

export interface GraphEdge {
    from: string;
    to: string;
    reference: Reference;
    source?: string;
}

export interface DependencyGraph {
    nodes: GraphNode[];
    edges: GraphEdge[];
    orphanReferences: Reference[];
}

export interface TerraformExport {
    version: string;
    document: Partial<TerraformDocument>;
    graph: DependencyGraph;
}

export interface TfVarsDocument {
    source: string;
    raw: string;
    assignments: Record<string, Value>;
}

export interface TerraformStateOutput {
    value: unknown;
    type?: string | string[];
    sensitive?: boolean;
}

export interface TerraformStateInstance {
    index_key?: string | number;
    attributes?: Record<string, unknown>;
    status?: string;
}

export interface TerraformStateResource {
    module?: string;
    mode: 'managed' | 'data';
    type: string;
    name: string;
    provider?: string;
    instances: TerraformStateInstance[];
}

export interface TerraformStateDocument {
    version: number;
    terraform_version?: string;
    serial?: number;
    lineage?: string;
    outputs: Record<string, TerraformStateOutput>;
    resources: TerraformStateResource[];
    raw: unknown;
    source: string;
}

export interface PlanResourceChange {
    address: string;
    module_address?: string;
    mode: 'managed' | 'data';
    type: string;
    name: string;
    provider_name?: string;
    change: {
        actions: string[];
        before?: unknown;
        after?: unknown;
        after_unknown?: Record<string, unknown>;
        before_sensitive?: Record<string, unknown>;
        after_sensitive?: Record<string, unknown>;
    };
}

export interface PlanResource {
    address: string;
    mode: 'managed' | 'data';
    type: string;
    name: string;
    provider_name?: string;
    values?: Record<string, unknown>;
}

export interface PlanModule {
    address?: string;
    resources?: PlanResource[];
    child_modules?: PlanModule[];
}

export interface TerraformPlanDocument {
    format_version?: string;
    terraform_version?: string;
    planned_values?: {
        root_module?: PlanModule;
    };
    resource_changes: PlanResourceChange[];
    raw: unknown;
    source: string;
}
