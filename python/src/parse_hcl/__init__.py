"""
parse-hcl: A Python library for parsing Terraform HCL configuration files.

Provides comprehensive parsing for Terraform configurations including:
- HCL (.tf) and JSON (.tf.json) configuration files
- Terraform state files (.tfstate)
- Terraform plan files
- Variable files (.tfvars)

Example:
    >>> from parse_hcl import TerraformParser
    >>>
    >>> parser = TerraformParser()
    >>> doc = parser.parse_file('main.tf')
    >>>
    >>> for resource in doc['resource']:
    ...     print(f"{resource['type']}.{resource['name']}")
"""

from .parsers.variable_parser import parse_type_constraint
from .services.artifact_parsers import TfPlanParser, TfStateParser, TfVarsParser
from .services.terraform_json_parser import TerraformJsonParser
from .services.terraform_parser import TerraformParser
from .types import (
    # Literal types
    BlockKind,
    ExpressionKind,
    GraphNodeKind,
    # Reference types
    CountReference,
    DataReference,
    EachReference,
    LocalReference,
    ModuleOutputReference,
    PathReference,
    Reference,
    ReferenceDict,
    ResourceReference,
    SelfReference,
    VariableReference,
    # Value types
    ArrayValue,
    ExpressionValue,
    LiteralValue,
    ObjectValue,
    Value,
    # Block types
    DataBlock,
    DynamicBlock,
    GenericBlock,
    HclBlock,
    LocalValue,
    ModuleBlock,
    NestedBlock,
    OutputBlock,
    ParsedBody,
    ProviderBlock,
    ResourceBlock,
    TerraformSettingsBlock,
    TypeConstraint,
    VariableBlock,
    VariableValidation,
    # Document types
    DirectoryParseOptions,
    DirectoryParseResult,
    FileParseResult,
    SerializeOptions,
    TerraformDocument,
    # Graph types
    DependencyGraph,
    GraphEdge,
    GraphEdgeCompat,
    GraphNode,
    TerraformExport,
    # Artifact types
    PlanChange,
    PlanModule,
    PlanResource,
    PlanResourceChange,
    PlannedValues,
    TerraformPlanDocument,
    TerraformStateDocument,
    TerraformStateInstance,
    TerraformStateOutput,
    TerraformStateResource,
    TfVarsDocument,
    # Functions
    create_empty_document,
)
from .utils.common.errors import (
    ParseError,
    SourceLocation,
    SourceRange,
    offset_to_location,
    offsets_to_range,
)
from .utils.graph.graph_builder import build_dependency_graph, create_export
from .utils.parser.value_classifier import classify_value
from .utils.serialization.serializer import to_export, to_json, to_json_export, to_yaml_document

__all__ = [
    # Parsers
    "TerraformParser",
    "TerraformJsonParser",
    "TfVarsParser",
    "TfStateParser",
    "TfPlanParser",
    # Serialization
    "to_json",
    "to_json_export",
    "to_export",
    "to_yaml_document",
    # Graph
    "build_dependency_graph",
    "create_export",
    # Errors
    "ParseError",
    "SourceLocation",
    "SourceRange",
    "offset_to_location",
    "offsets_to_range",
    # Utilities
    "classify_value",
    "parse_type_constraint",
    "create_empty_document",
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
    # Artifact types
    "TfVarsDocument",
    "TerraformStateOutput",
    "TerraformStateInstance",
    "TerraformStateResource",
    "TerraformStateDocument",
    "PlanChange",
    "PlanResourceChange",
    "PlanResource",
    "PlanModule",
    "PlannedValues",
    "TerraformPlanDocument",
]
