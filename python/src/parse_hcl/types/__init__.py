"""
Type definitions for Terraform HCL block structures and artifacts.

Provides comprehensive type coverage for all Terraform configuration elements,
including blocks, values, references, dependency graphs, and artifacts.
"""

from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional, Union

# Use typing_extensions for Python < 3.11 compatibility
try:
    from typing import NotRequired, TypedDict
except ImportError:
    from typing_extensions import NotRequired, TypedDict


# =============================================================================
# Block Kind Types
# =============================================================================

BlockKind = Literal[
    "terraform",
    "provider",
    "variable",
    "output",
    "module",
    "resource",
    "data",
    "locals",
    "moved",
    "import",
    "check",
    "terraform_data",
    "unknown",
]
"""
Known Terraform block types.

- ``terraform``: Terraform settings and required providers
- ``provider``: Provider configuration
- ``variable``: Input variable declarations
- ``output``: Output value declarations
- ``module``: Module calls
- ``resource``: Managed resource definitions
- ``data``: Data source definitions
- ``locals``: Local value definitions
- ``moved``: Resource move declarations
- ``import``: Import declarations
- ``check``: Check assertions
- ``terraform_data``: Terraform data resources
- ``unknown``: Unrecognized block types
"""

ExpressionKind = Literal[
    "traversal",
    "function_call",
    "template",
    "for_expr",
    "conditional",
    "splat",
    "unknown",
]
"""
Types of expressions in HCL.

- ``traversal``: Attribute access (e.g., ``var.name``, ``local.value``)
- ``function_call``: Function invocation (e.g., ``length(var.list)``)
- ``template``: String interpolation (e.g., ``"${var.name}"``)
- ``for_expr``: For expressions/comprehensions
- ``conditional``: Ternary conditional (e.g., ``var.enabled ? "yes" : "no"``)
- ``splat``: Splat expressions (e.g., ``aws_instance.web[*].id``)
- ``unknown``: Unrecognized expression type
"""


# =============================================================================
# Reference Types
# =============================================================================

class VariableReference(TypedDict):
    """Reference to a variable."""

    kind: Literal["variable"]
    name: str


class LocalReference(TypedDict):
    """Reference to a local value."""

    kind: Literal["local"]
    name: str


class ModuleOutputReference(TypedDict):
    """Reference to a module output."""

    kind: Literal["module_output"]
    module: str
    name: str


class DataReference(TypedDict, total=False):
    """Reference to a data source."""

    kind: Literal["data"]
    data_type: str
    name: str
    attribute: Optional[str]
    splat: Optional[bool]


class ResourceReference(TypedDict, total=False):
    """Reference to a resource."""

    kind: Literal["resource"]
    resource_type: str
    name: str
    attribute: Optional[str]
    splat: Optional[bool]


class PathReference(TypedDict):
    """Reference to a path value (path.module, path.root, path.cwd)."""

    kind: Literal["path"]
    name: str


class EachReference(TypedDict):
    """Reference to each.key or each.value in for_each."""

    kind: Literal["each"]
    property: Literal["key", "value"]


class CountReference(TypedDict):
    """Reference to count.index."""

    kind: Literal["count"]
    property: Literal["index"]


class SelfReference(TypedDict):
    """Reference to self.* in provisioners."""

    kind: Literal["self"]
    attribute: str


# Union type for all references (for documentation purposes)
# In practice, we use the general Reference TypedDict below for flexibility
Reference = Union[
    VariableReference,
    LocalReference,
    ModuleOutputReference,
    DataReference,
    ResourceReference,
    PathReference,
    EachReference,
    CountReference,
    SelfReference,
]
"""Reference to a Terraform configuration element. Used for dependency tracking."""


# General Reference TypedDict for runtime flexibility
class ReferenceDict(TypedDict, total=False):
    """
    General reference dictionary that can represent any reference type.
    Used internally for flexibility in reference handling.
    """

    kind: Literal[
        "variable",
        "local",
        "module_output",
        "data",
        "resource",
        "path",
        "each",
        "count",
        "self",
    ]
    name: str
    module: str
    data_type: str
    resource_type: str
    attribute: Optional[str]
    splat: Optional[bool]
    property: Literal["key", "value", "index"]


# =============================================================================
# Value Types
# =============================================================================

class LiteralValue(TypedDict):
    """A literal value (string, number, boolean, or null)."""

    type: Literal["literal"]
    value: Union[str, int, float, bool, None]
    raw: str


class ObjectValue(TypedDict, total=False):
    """An object/map value with key-value pairs."""

    type: Literal["object"]
    value: Optional[Dict[str, "Value"]]
    raw: str
    references: Optional[List[ReferenceDict]]


class ArrayValue(TypedDict, total=False):
    """An array/list value with elements."""

    type: Literal["array"]
    value: Optional[List["Value"]]
    raw: str
    references: Optional[List[ReferenceDict]]


class ExpressionValue(TypedDict, total=False):
    """An expression value (traversals, function calls, templates, etc.)."""

    type: Literal["expression"]
    kind: ExpressionKind
    raw: str
    references: Optional[List[ReferenceDict]]
    parsed: Optional[Dict[str, Any]]


# General Value type for runtime use
class Value(TypedDict, total=False):
    """
    Union type for all possible HCL values.

    Can be one of:
    - LiteralValue: Simple values (string, number, boolean, null)
    - ObjectValue: Object/map structures
    - ArrayValue: List/array structures
    - ExpressionValue: HCL expressions with references
    """

    type: Literal["literal", "object", "array", "expression"]
    value: Any
    raw: str
    kind: ExpressionKind
    references: List[ReferenceDict]
    parsed: Dict[str, Any]


# =============================================================================
# Parsed Body and Nested Block Types
# =============================================================================

class NestedBlock(TypedDict, total=False):
    """A nested block within a parent block."""

    type: str
    labels: List[str]
    attributes: Dict[str, Value]
    blocks: List["NestedBlock"]
    raw: str


class ParsedBody(TypedDict):
    """Parsed body of an HCL block containing attributes and nested blocks."""

    attributes: Dict[str, Value]
    blocks: List[NestedBlock]


# =============================================================================
# Raw HCL Block Type
# =============================================================================

class HclBlock(TypedDict):
    """A raw HCL block as extracted by the scanner."""

    kind: BlockKind
    keyword: str
    labels: List[str]
    body: str
    raw: str
    source: str


# =============================================================================
# Type Constraint Types
# =============================================================================

class TypeConstraint(TypedDict, total=False):
    """
    Parsed type constraint for a variable.

    Supports:
    - Primitive types: string, number, bool, any
    - Collection types: list(T), set(T), map(T)
    - Structural types: object({ attr = type, ... }), tuple([type, ...])
    - Optional attributes: optional(type)
    """

    base: str
    element: "TypeConstraint"
    elements: List["TypeConstraint"]
    attributes: Dict[str, "TypeConstraint"]
    optional: bool
    raw: str


class VariableValidation(TypedDict, total=False):
    """Validation rule for a variable."""

    condition: Optional[Value]
    error_message: Optional[Value]


# =============================================================================
# Block Definition Types
# =============================================================================

class TerraformSettingsBlock(TypedDict):
    """Terraform settings block (terraform { ... })."""

    properties: Dict[str, Value]
    raw: str
    source: str


class ProviderBlock(TypedDict, total=False):
    """Provider configuration block."""

    name: str
    alias: Optional[str]
    properties: Dict[str, Value]
    raw: str
    source: str


class ModuleBlock(TypedDict):
    """Module call block."""

    name: str
    properties: Dict[str, Value]
    source_raw: NotRequired[str]
    source_output_dir: NotRequired[str]
    raw: str
    source: str


class DynamicBlock(TypedDict, total=False):
    """Dynamic block definition within a resource."""

    label: str
    for_each: Optional[Value]
    iterator: Optional[str]
    content: Dict[str, Value]
    raw: str


class ResourceBlock(TypedDict, total=False):
    """Resource definition block."""

    type: str
    name: str
    properties: Dict[str, Value]
    blocks: List[NestedBlock]
    dynamic_blocks: List[DynamicBlock]
    meta: Dict[str, Value]
    raw: str
    source: str


class DataBlock(TypedDict, total=False):
    """Data source definition block."""

    dataType: str
    name: str
    properties: Dict[str, Value]
    blocks: List[NestedBlock]
    raw: str
    source: str


class VariableBlock(TypedDict, total=False):
    """Variable definition block."""

    name: str
    description: Optional[str]
    type: Optional[str]
    typeConstraint: Optional[TypeConstraint]
    default: Optional[Value]
    validation: Optional[VariableValidation]
    sensitive: Optional[bool]
    nullable: Optional[bool]
    raw: str
    source: str


class OutputBlock(TypedDict, total=False):
    """Output definition block."""

    name: str
    description: Optional[str]
    value: Optional[Value]
    sensitive: Optional[bool]
    raw: str
    source: str


class LocalValue(TypedDict, total=False):
    """A single local value definition."""

    name: str
    type: Optional[Literal["literal", "object", "array", "expression"]]
    value: Value
    raw: Optional[str]
    source: str


class GenericBlock(TypedDict, total=False):
    """A generic block for less common block types (moved, import, check, etc.)."""

    type: str
    labels: List[str]
    properties: Dict[str, Value]
    blocks: List[NestedBlock]
    raw: str
    source: str


# =============================================================================
# Terraform Document Type
# =============================================================================

class TerraformDocument(TypedDict):
    """Complete Terraform document containing all parsed blocks."""

    terraform: List[TerraformSettingsBlock]
    provider: List[ProviderBlock]
    variable: List[VariableBlock]
    output: List[OutputBlock]
    module: List[ModuleBlock]
    resource: List[ResourceBlock]
    data: List[DataBlock]
    locals: List[LocalValue]
    moved: List[GenericBlock]
    import_: NotRequired[List[GenericBlock]]  # 'import' is reserved
    check: List[GenericBlock]
    terraform_data: List[GenericBlock]
    unknown: List[GenericBlock]


def create_empty_document() -> Dict[str, List[Any]]:
    """
    Creates an empty TerraformDocument with all arrays initialized.

    Returns:
        A new empty TerraformDocument dictionary.
    """
    return {
        "terraform": [],
        "provider": [],
        "variable": [],
        "output": [],
        "module": [],
        "resource": [],
        "data": [],
        "locals": [],
        "moved": [],
        "import": [],
        "check": [],
        "terraform_data": [],
        "unknown": [],
    }


# =============================================================================
# Parse Result Types
# =============================================================================

class FileParseResult(TypedDict):
    """Result of parsing a single file."""

    path: str
    relative_path: NotRequired[str]
    output_path: NotRequired[str]
    output_dir: NotRequired[str]
    document: TerraformDocument


class DirectoryParseOptions(TypedDict, total=False):
    """Options for directory parsing."""

    aggregate: bool  # Whether to aggregate all files into a combined document (default: True)
    include_per_file: bool  # Whether to include per-file results (default: True)


class DirectoryParseResult(TypedDict, total=False):
    """Result of parsing a directory."""

    combined: TerraformDocument
    files: List[FileParseResult]


# =============================================================================
# Serialization Options
# =============================================================================

class SerializeOptions(TypedDict, total=False):
    """Options for serialization functions."""

    prune_empty: bool  # Whether to prune empty values (default: True)


# =============================================================================
# Graph Types
# =============================================================================

GraphNodeKind = Literal[
    # Block kinds
    "terraform",
    "provider",
    "variable",
    "output",
    "module",
    "resource",
    "data",
    "locals",
    "moved",
    "import",
    "check",
    "terraform_data",
    "unknown",
    # Special node types for references
    "module_output",
    "path",
    "each",
    "count",
    "self",
    "external",
]
"""Types of nodes in the dependency graph. Extends BlockKind with special node types."""


class GraphNode(TypedDict, total=False):
    """A node in the dependency graph representing a Terraform element."""

    id: str
    kind: GraphNodeKind
    name: str
    type: Optional[str]  # Resource/data type (for resource and data nodes)
    source: Optional[str]  # Source file path (if known)


class GraphEdge(TypedDict, total=False):
    """An edge in the dependency graph representing a reference."""

    from_id: str  # Using from_id instead of 'from' (Python reserved word)
    to: str
    reference: ReferenceDict
    source: Optional[str]


# For compatibility with existing code that uses 'from'
class GraphEdgeCompat(TypedDict, total=False):
    """Graph edge with 'from' key for JSON compatibility."""

    # Note: 'from' is accessed via dict notation: edge["from"]
    to: str
    reference: ReferenceDict
    source: Optional[str]


class DependencyGraph(TypedDict):
    """Complete dependency graph with nodes, edges, and orphan references."""

    nodes: List[GraphNode]
    edges: List[Dict[str, Any]]  # Uses 'from' key
    orphanReferences: List[ReferenceDict]


class TerraformExport(TypedDict):
    """Export format containing document, graph, and metadata."""

    version: str
    document: Dict[str, Any]  # Partial TerraformDocument
    graph: DependencyGraph


# =============================================================================
# Artifact Types - tfvars
# =============================================================================

class TfVarsDocument(TypedDict):
    """Parsed tfvars document containing variable assignments."""

    source: str
    raw: str
    assignments: Dict[str, Value]


# =============================================================================
# Artifact Types - Terraform State
# =============================================================================

class TerraformStateOutput(TypedDict, total=False):
    """An output value from Terraform state."""

    value: Any
    type: Optional[Union[str, List[str]]]
    sensitive: Optional[bool]


class TerraformStateInstance(TypedDict, total=False):
    """A resource instance in Terraform state."""

    index_key: Optional[Union[str, int]]
    attributes: Optional[Dict[str, Any]]
    status: Optional[str]


class TerraformStateResource(TypedDict, total=False):
    """A resource in Terraform state."""

    module: Optional[str]
    mode: Literal["managed", "data"]
    type: str
    name: str
    provider: Optional[str]
    instances: List[TerraformStateInstance]


class TerraformStateDocument(TypedDict, total=False):
    """Parsed Terraform state document."""

    version: int
    terraform_version: Optional[str]
    serial: Optional[int]
    lineage: Optional[str]
    outputs: Dict[str, TerraformStateOutput]
    resources: List[TerraformStateResource]
    raw: Any
    source: str


# =============================================================================
# Artifact Types - Terraform Plan
# =============================================================================

class PlanResourceChange(TypedDict, total=False):
    """A resource change in a Terraform plan."""

    address: str
    module_address: Optional[str]
    mode: Literal["managed", "data"]
    type: str
    name: str
    provider_name: Optional[str]
    change: "PlanChange"


class PlanChange(TypedDict, total=False):
    """Change details for a resource."""

    actions: List[str]
    before: Optional[Any]
    after: Optional[Any]
    after_unknown: Optional[Dict[str, Any]]
    before_sensitive: Optional[Dict[str, Any]]
    after_sensitive: Optional[Dict[str, Any]]


class PlanResource(TypedDict, total=False):
    """A resource in planned values."""

    address: str
    mode: Literal["managed", "data"]
    type: str
    name: str
    provider_name: Optional[str]
    values: Optional[Dict[str, Any]]


class PlanModule(TypedDict, total=False):
    """A module in planned values."""

    address: Optional[str]
    resources: Optional[List[PlanResource]]
    child_modules: Optional[List["PlanModule"]]


class PlannedValues(TypedDict, total=False):
    """Planned values section of a plan."""

    root_module: Optional[PlanModule]


class TerraformPlanDocument(TypedDict, total=False):
    """Parsed Terraform plan document."""

    format_version: Optional[str]
    terraform_version: Optional[str]
    planned_values: Optional[PlannedValues]
    resource_changes: List[PlanResourceChange]
    raw: Any
    source: str


# =============================================================================
# Export all types
# =============================================================================

__all__ = [
    # Literal types
    "BlockKind",
    "ExpressionKind",
    "GraphNodeKind",
    # Reference types
    "Reference",
    "ReferenceDict",
    "VariableReference",
    "LocalReference",
    "ModuleOutputReference",
    "DataReference",
    "ResourceReference",
    "PathReference",
    "EachReference",
    "CountReference",
    "SelfReference",
    # Value types
    "Value",
    "LiteralValue",
    "ObjectValue",
    "ArrayValue",
    "ExpressionValue",
    # Block types
    "HclBlock",
    "NestedBlock",
    "ParsedBody",
    "TypeConstraint",
    "VariableValidation",
    "TerraformSettingsBlock",
    "ProviderBlock",
    "ModuleBlock",
    "DynamicBlock",
    "ResourceBlock",
    "DataBlock",
    "VariableBlock",
    "OutputBlock",
    "LocalValue",
    "GenericBlock",
    # Document types
    "TerraformDocument",
    "FileParseResult",
    "DirectoryParseOptions",
    "DirectoryParseResult",
    "SerializeOptions",
    # Graph types
    "GraphNode",
    "GraphEdge",
    "GraphEdgeCompat",
    "DependencyGraph",
    "TerraformExport",
    # Artifact types - tfvars
    "TfVarsDocument",
    # Artifact types - state
    "TerraformStateOutput",
    "TerraformStateInstance",
    "TerraformStateResource",
    "TerraformStateDocument",
    # Artifact types - plan
    "PlanChange",
    "PlanResourceChange",
    "PlanResource",
    "PlanModule",
    "PlannedValues",
    "TerraformPlanDocument",
    # Functions
    "create_empty_document",
]
