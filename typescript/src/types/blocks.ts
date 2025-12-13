export type BlockKind =
    | 'terraform'
    | 'provider'
    | 'variable'
    | 'output'
    | 'module'
    | 'resource'
    | 'data'
    | 'locals';

export type AttributeKind = 'string' | 'number' | 'bool' | 'array' | 'object' | 'expression';

export interface AttributeValue {
    kind: AttributeKind;
    raw: string;
    value?: string | number | boolean | unknown[] | Record<string, unknown>;
}

export interface ParsedBody {
    attributes: Record<string, AttributeValue>;
    blocks: NestedBlock[];
}

export interface NestedBlock {
    type: string;
    labels: string[];
    attributes: Record<string, AttributeValue>;
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
    properties: Record<string, AttributeValue>;
    raw: string;
    source: string;
}

export interface ProviderBlock {
    name: string;
    alias?: string;
    properties: Record<string, AttributeValue>;
    raw: string;
    source: string;
}

export interface ModuleBlock {
    name: string;
    source?: AttributeValue;
    variables: Record<string, AttributeValue>;
    raw: string;
    sourceFile: string;
}

export interface ResourceBlock {
    type: string;
    name: string;
    properties: Record<string, AttributeValue>;
    blocks: NestedBlock[];
    meta: Record<string, AttributeValue>;
    raw: string;
    source: string;
}

export interface DataBlock {
    dataType: string;
    name: string;
    properties: Record<string, AttributeValue>;
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
        errorMessage?: string;
    };
    sensitive?: boolean;
    raw: string;
    source: string;
}

export interface OutputBlock {
    name: string;
    description?: string;
    value?: AttributeValue;
    sensitive?: boolean;
    raw: string;
    source: string;
}

export interface LocalValue {
    name: string;
    value: AttributeValue;
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
