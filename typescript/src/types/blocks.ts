export type BlockKind =
    | 'terraform'
    | 'provider'
    | 'variable'
    | 'output'
    | 'module'
    | 'resource'
    | 'data'
    | 'locals';

export type ExpressionKind = 'traversal' | 'function_call' | 'template' | 'for_expr' | 'unknown';

export type Reference =
    | { kind: 'variable'; name: string }
    | { kind: 'local'; name: string }
    | { kind: 'module_output'; module: string; name: string }
    | { kind: 'data'; data_type: string; name: string; attribute?: string }
    | { kind: 'resource'; resource_type: string; name: string; attribute?: string }
    | { kind: 'path'; name: string };

export interface LiteralValue {
    type: 'literal';
    value: string | number | boolean | null;
    raw: string;
}

export interface ObjectValue {
    type: 'object';
    value?: Record<string, Value>;
    raw: string;
    references?: Reference[];
}

export interface ArrayValue {
    type: 'array';
    value?: Value[];
    raw: string;
    references?: Reference[];
}

export interface ExpressionValue {
    type: 'expression';
    kind: ExpressionKind;
    raw: string;
    references?: Reference[];
    parsed?: Record<string, unknown>;
}

export type Value = LiteralValue | ObjectValue | ArrayValue | ExpressionValue;

export interface ParsedBody {
    attributes: Record<string, Value>;
    blocks: NestedBlock[];
}

export interface NestedBlock {
    type: string;
    labels: string[];
    attributes: Record<string, Value>;
    blocks: NestedBlock[];
    raw: string;
}

export interface HclBlock {
    kind: BlockKind;
    labels: string[];
    body: string;
    raw: string;
    source: string;
}

export interface TerraformSettingsBlock {
    properties: Record<string, Value>;
    raw: string;
    source: string;
}

export interface ProviderBlock {
    name: string;
    alias?: string;
    properties: Record<string, Value>;
    raw: string;
    source: string;
}

export interface ModuleBlock {
    name: string;
    properties: Record<string, Value>;
    raw: string;
    source: string;
}

export interface ResourceBlock {
    type: string;
    name: string;
    properties: Record<string, Value>;
    blocks: NestedBlock[];
    dynamic_blocks: DynamicBlock[];
    meta: Record<string, Value>;
    raw: string;
    source: string;
}

export interface DynamicBlock {
    label: string;
    for_each?: Value;
    iterator?: string;
    content: Record<string, Value>;
    raw: string;
}

export interface DataBlock {
    dataType: string;
    name: string;
    properties: Record<string, Value>;
    blocks: NestedBlock[];
    raw: string;
    source: string;
}

export interface VariableBlock {
    name: string;
    description?: string;
    type?: string;
    default?: unknown;
    validation?: {
        condition?: string;
        error_message?: string;
    };
    sensitive?: boolean;
    raw: string;
    source: string;
}

export interface OutputBlock {
    name: string;
    description?: string;
    value?: Value;
    sensitive?: boolean;
    raw: string;
    source: string;
}

export interface LocalValue {
    name: string;
    type: Value['type'];
    value: Value;
    raw: string;
    source: string;
}

export interface TerraformDocument {
    terraform: TerraformSettingsBlock[];
    provider: ProviderBlock[];
    variable: VariableBlock[];
    output: OutputBlock[];
    module: ModuleBlock[];
    resource: ResourceBlock[];
    data: DataBlock[];
    locals: LocalValue[];
}

export function createEmptyDocument(): TerraformDocument {
    return {
        terraform: [],
        provider: [],
        variable: [],
        output: [],
        module: [],
        resource: [],
        data: [],
        locals: []
    };
}

export interface FileParseResult {
    path: string;
    document: TerraformDocument;
}

export interface DirectoryParseOptions {
    aggregate?: boolean;
    includePerFile?: boolean;
}

export interface DirectoryParseResult {
    combined?: TerraformDocument;
    files: FileParseResult[];
}
