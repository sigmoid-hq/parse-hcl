/**
 * Type definitions for Terraform HCL block structures.
 * Provides comprehensive type coverage for all Terraform configuration elements.
 */

/**
 * Known Terraform block types.
 * - `terraform`: Terraform settings and required providers
 * - `provider`: Provider configuration
 * - `variable`: Input variable declarations
 * - `output`: Output value declarations
 * - `module`: Module calls
 * - `resource`: Managed resource definitions
 * - `data`: Data source definitions
 * - `locals`: Local value definitions
 * - `moved`: Resource move declarations
 * - `import`: Import declarations
 * - `check`: Check assertions
 * - `terraform_data`: Terraform data resources
 * - `unknown`: Unrecognized block types
 */
export type BlockKind =
    | 'terraform'
    | 'provider'
    | 'variable'
    | 'output'
    | 'module'
    | 'resource'
    | 'data'
    | 'locals'
    | 'moved'
    | 'import'
    | 'check'
    | 'terraform_data'
    | 'unknown';

/**
 * Types of expressions in HCL.
 * - `traversal`: Attribute access (e.g., `var.name`, `local.value`)
 * - `function_call`: Function invocation (e.g., `length(var.list)`)
 * - `template`: String interpolation (e.g., `"${var.name}"`)
 * - `for_expr`: For expressions/comprehensions
 * - `conditional`: Ternary conditional (e.g., `var.enabled ? "yes" : "no"`)
 * - `splat`: Splat expressions (e.g., `aws_instance.web[*].id`)
 * - `unknown`: Unrecognized expression type
 */
export type ExpressionKind =
    | 'traversal'
    | 'function_call'
    | 'template'
    | 'for_expr'
    | 'conditional'
    | 'splat'
    | 'unknown';

/**
 * Reference to a Terraform configuration element.
 * Used for dependency tracking and graph building.
 */
export type Reference =
    | { kind: 'variable'; name: string }
    | { kind: 'local'; name: string }
    | { kind: 'module_output'; module: string; name: string }
    | { kind: 'data'; data_type: string; name: string; attribute?: string; splat?: boolean }
    | { kind: 'resource'; resource_type: string; name: string; attribute?: string; splat?: boolean }
    | { kind: 'path'; name: string }
    | { kind: 'each'; property: 'key' | 'value' }
    | { kind: 'count'; property: 'index' }
    | { kind: 'self'; attribute: string };

/**
 * A literal value (string, number, boolean, or null).
 */
export interface LiteralValue {
    type: 'literal';
    /** The parsed literal value */
    value: string | number | boolean | null;
    /** The original raw text */
    raw: string;
}

/**
 * An object/map value with key-value pairs.
 */
export interface ObjectValue {
    type: 'object';
    /** Parsed object entries (if successfully parsed) */
    value?: Record<string, Value>;
    /** The original raw text */
    raw: string;
    /** References found within the object */
    references?: Reference[];
}

/**
 * An array/list value with elements.
 */
export interface ArrayValue {
    type: 'array';
    /** Parsed array elements (if successfully parsed) */
    value?: Value[];
    /** The original raw text */
    raw: string;
    /** References found within the array */
    references?: Reference[];
}

/**
 * An expression value (traversals, function calls, templates, etc.).
 */
export interface ExpressionValue {
    type: 'expression';
    /** The kind of expression */
    kind: ExpressionKind;
    /** The original raw text */
    raw: string;
    /** References found within the expression */
    references?: Reference[];
    /** Additional parsed data (for specific expression types) */
    parsed?: Record<string, unknown>;
}

/**
 * Union type for all possible HCL values.
 */
export type Value = LiteralValue | ObjectValue | ArrayValue | ExpressionValue;

/**
 * Parsed body of an HCL block containing attributes and nested blocks.
 */
export interface ParsedBody {
    /** Key-value attribute assignments */
    attributes: Record<string, Value>;
    /** Nested block definitions */
    blocks: NestedBlock[];
}

/**
 * A nested block within a parent block.
 */
export interface NestedBlock {
    /** The block type identifier */
    type: string;
    /** Block labels (e.g., for provisioner blocks) */
    labels: string[];
    /** Attribute assignments within the block */
    attributes: Record<string, Value>;
    /** Further nested blocks */
    blocks: NestedBlock[];
    /** The original raw text */
    raw: string;
}

/**
 * A raw HCL block as extracted by the scanner.
 */
export interface HclBlock {
    /** The classified block kind */
    kind: BlockKind;
    /** The original keyword used */
    keyword: string;
    /** Block labels (e.g., resource type and name) */
    labels: string[];
    /** The block body content (without braces) */
    body: string;
    /** The complete raw block text */
    raw: string;
    /** Source file path */
    source: string;
}

/**
 * Terraform settings block (terraform { ... }).
 */
export interface TerraformSettingsBlock {
    /** All properties defined in the block */
    properties: Record<string, Value>;
    /** The original raw text */
    raw: string;
    /** Source file path */
    source: string;
}

/**
 * Provider configuration block.
 */
export interface ProviderBlock {
    /** Provider name (e.g., "aws", "google") */
    name: string;
    /** Provider alias (for multiple provider configurations) */
    alias?: string;
    /** All properties defined in the block */
    properties: Record<string, Value>;
    /** The original raw text */
    raw: string;
    /** Source file path */
    source: string;
}

/**
 * Module call block.
 */
export interface ModuleBlock {
    /** Module name (the label) */
    name: string;
    /** All properties defined in the block (including source, version, etc.) */
    properties: Record<string, Value>;
    /** Raw source string as written in HCL (useful when a resolved output dir is added) */
    source_raw?: string;
    /** Relative path to the per-file parse output for the referenced source directory (when available) */
    source_output_dir?: string;
    /** The original raw text */
    raw: string;
    /** Source file path */
    source: string;
}

/**
 * Resource definition block.
 */
export interface ResourceBlock {
    /** Resource type (e.g., "aws_instance", "google_compute_instance") */
    type: string;
    /** Resource name (the second label) */
    name: string;
    /** Resource properties (excluding meta-arguments) */
    properties: Record<string, Value>;
    /** Nested blocks within the resource */
    blocks: NestedBlock[];
    /** Dynamic blocks within the resource */
    dynamic_blocks: DynamicBlock[];
    /** Meta-arguments (count, for_each, provider, depends_on, lifecycle) */
    meta: Record<string, Value>;
    /** The original raw text */
    raw: string;
    /** Source file path */
    source: string;
}

/**
 * Dynamic block definition within a resource.
 */
export interface DynamicBlock {
    /** The label (block type being generated) */
    label: string;
    /** The for_each expression */
    for_each?: Value;
    /** The iterator variable name */
    iterator?: string;
    /** The content block attributes */
    content: Record<string, Value>;
    /** The original raw text */
    raw: string;
}

/**
 * Data source definition block.
 */
export interface DataBlock {
    /** Data source type (e.g., "aws_ami", "google_compute_image") */
    dataType: string;
    /** Data source name (the second label) */
    name: string;
    /** Data source properties */
    properties: Record<string, Value>;
    /** Nested blocks within the data source */
    blocks: NestedBlock[];
    /** The original raw text */
    raw: string;
    /** Source file path */
    source: string;
}

/**
 * Parsed type constraint for a variable.
 */
export interface TypeConstraint {
    /** The base type name (string, number, bool, list, map, object, set, tuple, any) */
    base: string;
    /** Element type for collection types */
    element?: TypeConstraint;
    /** Element types for tuple types */
    elements?: TypeConstraint[];
    /** Attribute types for object types */
    attributes?: Record<string, TypeConstraint>;
    /** Whether the type is optional (for object attributes) */
    optional?: boolean;
    /** The original raw type expression */
    raw: string;
}

/**
 * Validation rule for a variable.
 */
export interface VariableValidation {
    /** The condition expression (must evaluate to true) */
    condition?: Value;
    /** The error message to display when condition is false */
    error_message?: Value;
}

/**
 * Variable definition block.
 */
export interface VariableBlock {
    /** Variable name */
    name: string;
    /** Variable description */
    description?: string;
    /** Type constraint expression */
    type?: string;
    /** Parsed type constraint (if type is provided) */
    typeConstraint?: TypeConstraint;
    /** Default value */
    default?: Value;
    /** Validation rules */
    validation?: VariableValidation;
    /** Whether the variable is sensitive */
    sensitive?: boolean;
    /** Whether the variable is nullable */
    nullable?: boolean;
    /** The original raw text */
    raw: string;
    /** Source file path */
    source: string;
}

/**
 * Output definition block.
 */
export interface OutputBlock {
    /** Output name */
    name: string;
    /** Output description */
    description?: string;
    /** The output value expression */
    value?: Value;
    /** Whether the output is sensitive */
    sensitive?: boolean;
    /** The original raw text */
    raw: string;
    /** Source file path */
    source: string;
}

/**
 * A single local value definition.
 */
export interface LocalValue {
    /** Local value name */
    name: string;
    /** The value type classification */
    type: Value['type'];
    /** The parsed value */
    value: Value;
    /** The original raw text */
    raw: string;
    /** Source file path */
    source: string;
}

/**
 * A generic block for less common block types (moved, import, check, etc.).
 */
export interface GenericBlock {
    /** The block type */
    type: string;
    /** Block labels */
    labels: string[];
    /** Block properties */
    properties: Record<string, Value>;
    /** Nested blocks */
    blocks: NestedBlock[];
    /** The original raw text */
    raw: string;
    /** Source file path */
    source: string;
}

/**
 * Complete Terraform document containing all parsed blocks.
 */
export interface TerraformDocument {
    /** Terraform settings blocks */
    terraform: TerraformSettingsBlock[];
    /** Provider configurations */
    provider: ProviderBlock[];
    /** Variable declarations */
    variable: VariableBlock[];
    /** Output declarations */
    output: OutputBlock[];
    /** Module calls */
    module: ModuleBlock[];
    /** Resource definitions */
    resource: ResourceBlock[];
    /** Data source definitions */
    data: DataBlock[];
    /** Local value definitions */
    locals: LocalValue[];
    /** Moved declarations */
    moved: GenericBlock[];
    /** Import declarations */
    import: GenericBlock[];
    /** Check assertions */
    check: GenericBlock[];
    /** Terraform data resources */
    terraform_data: GenericBlock[];
    /** Unrecognized blocks */
    unknown: GenericBlock[];
}

/**
 * Creates an empty TerraformDocument with all arrays initialized.
 * @returns A new empty TerraformDocument
 */
export function createEmptyDocument(): TerraformDocument {
    return {
        terraform: [],
        provider: [],
        variable: [],
        output: [],
        module: [],
        resource: [],
        data: [],
        locals: [],
        moved: [],
        import: [],
        check: [],
        terraform_data: [],
        unknown: []
    };
}

/**
 * Result of parsing a single file.
 */
export interface FileParseResult {
    /** The file path */
    path: string;
    /** Path relative to the parsed directory root */
    relative_path?: string;
    /** Relative path (from cwd) to the per-file parse output */
    output_path?: string;
    /** Relative directory containing the per-file parse output */
    output_dir?: string;
    /** The parsed document */
    document: TerraformDocument;
}

/**
 * Options for directory parsing.
 */
export interface DirectoryParseOptions {
    /** Whether to aggregate all files into a combined document (default: true) */
    aggregate?: boolean;
    /** Whether to include per-file results (default: true) */
    includePerFile?: boolean;
}

/**
 * Result of parsing a directory.
 */
export interface DirectoryParseResult {
    /** Combined document from all files (if aggregate is true) */
    combined?: TerraformDocument;
    /** Per-file parsing results (if includePerFile is true) */
    files: FileParseResult[];
}
