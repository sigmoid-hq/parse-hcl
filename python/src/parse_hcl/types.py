from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional, TypedDict

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

ExpressionKind = Literal[
    "traversal",
    "function_call",
    "template",
    "for_expr",
    "conditional",
    "splat",
    "unknown",
]


class Reference(TypedDict, total=False):
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
    # For self references
    # attribute stored in "attribute"


class Value(TypedDict, total=False):
    type: Literal["literal", "object", "array", "expression"]
    value: Any
    raw: str
    kind: ExpressionKind
    references: List[Reference]
    parsed: Dict[str, Any]


class NestedBlock(TypedDict, total=False):
    type: str
    labels: List[str]
    attributes: Dict[str, Value]
    blocks: List["NestedBlock"]
    raw: str


class HclBlock(TypedDict):
    kind: BlockKind
    keyword: str
    labels: List[str]
    body: str
    raw: str
    source: str


TerraformDocument = Dict[str, Any]


class FileParseResult(TypedDict):
    path: str
    document: TerraformDocument


class DirectoryParseResult(TypedDict, total=False):
    combined: TerraformDocument
    files: List[FileParseResult]


class DependencyGraph(TypedDict):
    nodes: List[Dict[str, Any]]
    edges: List[Dict[str, Any]]
    orphanReferences: List[Reference]


class TerraformExport(TypedDict):
    version: str
    document: Dict[str, Any]
    graph: DependencyGraph


def create_empty_document() -> TerraformDocument:
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
