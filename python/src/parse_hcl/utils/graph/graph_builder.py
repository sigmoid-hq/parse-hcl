"""
Dependency graph builder for Terraform configurations.

Builds a directed graph of dependencies between Terraform configuration elements
by analyzing references in values and attributes.
"""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional, Set

from ...types import (
    DependencyGraph,
    GraphNode,
    GraphNodeKind,
    ReferenceDict,
    TerraformDocument,
    TerraformExport,
    Value,
)

GRAPH_VERSION = "1.0.0"
"""Current version of the graph export format."""


def build_dependency_graph(document: TerraformDocument) -> DependencyGraph:
    """
    Builds a dependency graph from a Terraform document.

    Analyzes all blocks in the document to extract references and builds
    a directed graph showing dependencies between configuration elements.

    Args:
        document: The parsed TerraformDocument.

    Returns:
        DependencyGraph containing:
        - nodes: All configuration elements as graph nodes
        - edges: Dependencies between nodes based on references
        - orphanReferences: References that couldn't be resolved to nodes

    Example:
        >>> parser = TerraformParser()
        >>> doc = parser.parse_file('main.tf')
        >>> graph = build_dependency_graph(doc)
        >>> print(f"Nodes: {len(graph['nodes'])}, Edges: {len(graph['edges'])}")
    """
    nodes: Dict[str, GraphNode] = {}
    edges: List[Dict[str, Any]] = []
    orphan_references: List[ReferenceDict] = []
    edge_keys: Set[str] = set()

    _populate_nodes(document, nodes)

    def add_edges(
        from_node: Optional[GraphNode],
        refs: List[ReferenceDict],
        source: Optional[str] = None,
    ) -> None:
        """Adds edges from a source node to all referenced targets."""
        if not from_node or not refs:
            return
        for ref in refs:
            target = _ensure_target_node(ref, nodes)
            if not target:
                orphan_references.append(ref)
                continue
            key = f"{from_node['id']}->{target['id']}:{_ref_key(ref)}"
            if key in edge_keys:
                continue
            edge_keys.add(key)
            edges.append({
                "from": from_node["id"],
                "to": target["id"],
                "reference": ref,
                "source": source,
            })

    # Process terraform settings blocks
    for block in document.get("terraform", []):
        node = nodes.get(_node_id("terraform", "settings"))
        add_edges(node, _references_from_attributes(block.get("properties")), block.get("source"))

    # Process provider blocks
    for provider in document.get("provider", []):
        node = nodes.get(_node_id("provider", provider.get("name"), provider.get("alias")))
        add_edges(node, _references_from_attributes(provider.get("properties")), provider.get("source"))

    # Process variable blocks
    for variable in document.get("variable", []):
        node = nodes.get(_node_id("variable", variable.get("name")))
        add_edges(node, _references_from_value(variable.get("default")), variable.get("source"))

    # Process output blocks
    for output in document.get("output", []):
        node = nodes.get(_node_id("output", output.get("name")))
        add_edges(node, _references_from_value(output.get("value")), output.get("source"))

    # Process module blocks
    for module in document.get("module", []):
        node = nodes.get(_node_id("module", module.get("name")))
        add_edges(node, _references_from_attributes(module.get("properties")), module.get("source"))

    # Process resource blocks
    for resource in document.get("resource", []):
        node = nodes.get(_node_id("resource", resource.get("type"), resource.get("name")))
        add_edges(node, _references_from_attributes(resource.get("properties")), resource.get("source"))
        add_edges(node, _references_from_attributes(resource.get("meta")), resource.get("source"))

        # Process dynamic blocks within resources
        for dyn in resource.get("dynamic_blocks", []):
            add_edges(node, _references_from_value(dyn.get("for_each")), resource.get("source"))
            add_edges(node, _references_from_attributes(dyn.get("content")), resource.get("source"))

        # Process nested blocks within resources
        add_edges(node, _references_from_nested_blocks(resource.get("blocks", [])), resource.get("source"))

    # Process data blocks
    for data in document.get("data", []):
        node = nodes.get(_node_id("data", data.get("dataType"), data.get("name")))
        add_edges(node, _references_from_attributes(data.get("properties")), data.get("source"))
        add_edges(node, _references_from_nested_blocks(data.get("blocks", [])), data.get("source"))

    # Process locals blocks
    for local in document.get("locals", []):
        node = nodes.get(_node_id("locals", local.get("name")))
        add_edges(node, _references_from_value(local.get("value")), local.get("source"))

    # Process other block types (moved, import, check, terraform_data, unknown)
    other_blocks: List[Dict[str, Any]] = []
    other_blocks.extend(document.get("moved", []))
    other_blocks.extend(document.get("import", []))
    other_blocks.extend(document.get("check", []))
    other_blocks.extend(document.get("terraform_data", []))
    other_blocks.extend(document.get("unknown", []))

    for block in other_blocks:
        all_refs = (
            _references_from_attributes(block.get("properties"))
            + _references_from_nested_blocks(block.get("blocks", []))
        )
        labels = block.get("labels") or ["default"]
        block_type = block.get("type")
        block_node = nodes.get(_node_id(block_type, labels[0]))

        if not block_node:
            new_node: GraphNode = {
                "id": _node_id(block_type, labels[0]),
                "kind": block_type,  # type: ignore[typeddict-item]
                "name": labels[0],
                "source": block.get("source"),
            }
            nodes[new_node["id"]] = new_node
            add_edges(new_node, all_refs, block.get("source"))
        else:
            add_edges(block_node, all_refs, block.get("source"))

    return {
        "nodes": list(nodes.values()),
        "edges": edges,
        "orphanReferences": orphan_references,
    }


def create_export(document: TerraformDocument) -> TerraformExport:
    """
    Creates an export object containing document and dependency graph.

    Args:
        document: The parsed TerraformDocument.

    Returns:
        TerraformExport with version, document, and dependency graph.

    Example:
        >>> parser = TerraformParser()
        >>> doc = parser.parse_file('main.tf')
        >>> export = create_export(doc)
        >>> print(export['version'])
        '1.0.0'
    """
    return {
        "version": GRAPH_VERSION,
        "document": document,
        "graph": build_dependency_graph(document),
    }


def _populate_nodes(document: TerraformDocument, nodes: Dict[str, GraphNode]) -> None:
    """
    Populates the nodes dictionary with all configuration elements.

    Args:
        document: The TerraformDocument to extract nodes from.
        nodes: Dictionary to populate with nodes (mutated in place).
    """
    def add_node(node: GraphNode) -> None:
        node_id = node.get("id", "")
        if node_id and node_id not in nodes:
            nodes[node_id] = node

    # Always add terraform settings node
    add_node({
        "id": _node_id("terraform", "settings"),
        "kind": "terraform",
        "name": "settings",
    })

    # Add provider nodes
    for provider in document.get("provider", []):
        add_node({
            "id": _node_id("provider", provider.get("name"), provider.get("alias")),
            "kind": "provider",
            "name": provider.get("alias") or provider.get("name"),
            "type": provider.get("name"),
            "source": provider.get("source"),
        })

    # Add variable nodes
    for variable in document.get("variable", []):
        add_node({
            "id": _node_id("variable", variable.get("name")),
            "kind": "variable",
            "name": variable.get("name"),
            "source": variable.get("source"),
        })

    # Add output nodes
    for output in document.get("output", []):
        add_node({
            "id": _node_id("output", output.get("name")),
            "kind": "output",
            "name": output.get("name"),
            "source": output.get("source"),
        })

    # Add module nodes
    for module in document.get("module", []):
        add_node({
            "id": _node_id("module", module.get("name")),
            "kind": "module",
            "name": module.get("name"),
            "source": module.get("source"),
        })

    # Add resource nodes
    for resource in document.get("resource", []):
        add_node({
            "id": _node_id("resource", resource.get("type"), resource.get("name")),
            "kind": "resource",
            "name": resource.get("name"),
            "type": resource.get("type"),
            "source": resource.get("source"),
        })

    # Add data nodes
    for data in document.get("data", []):
        add_node({
            "id": _node_id("data", data.get("dataType"), data.get("name")),
            "kind": "data",
            "name": data.get("name"),
            "type": data.get("dataType"),
            "source": data.get("source"),
        })

    # Add locals nodes
    for local in document.get("locals", []):
        add_node({
            "id": _node_id("locals", local.get("name")),
            "kind": "locals",
            "name": local.get("name"),
            "source": local.get("source"),
        })


def _references_from_attributes(attributes: Optional[Dict[str, Any]]) -> List[ReferenceDict]:
    """
    Extracts all references from a dictionary of attributes.

    Args:
        attributes: Dictionary of attribute name to Value.

    Returns:
        List of all references found in attribute values.
    """
    if not attributes:
        return []
    refs: List[ReferenceDict] = []
    for value in attributes.values():
        refs.extend(_references_from_value(value))
    return refs


def _references_from_nested_blocks(blocks: List[Dict[str, Any]]) -> List[ReferenceDict]:
    """
    Recursively extracts references from nested blocks.

    Args:
        blocks: List of nested block dictionaries.

    Returns:
        List of all references found in nested blocks.
    """
    refs: List[ReferenceDict] = []
    for block in blocks or []:
        refs.extend(_references_from_attributes(block.get("attributes")))
        refs.extend(_references_from_nested_blocks(block.get("blocks", [])))
    return refs


def _references_from_value(value: Any) -> List[ReferenceDict]:
    """
    Extracts references from a Value object, including nested values.

    Args:
        value: A Value dictionary or any other value.

    Returns:
        List of references found in the value.
    """
    if not isinstance(value, dict):
        return []

    direct: List[ReferenceDict] = value.get("references") or []

    # Recursively extract from object values
    if value.get("type") == "object" and isinstance(value.get("value"), dict):
        return direct + _references_from_attributes(value.get("value"))

    # Recursively extract from array values
    if value.get("type") == "array" and isinstance(value.get("value"), list):
        nested: List[ReferenceDict] = []
        for item in value.get("value"):
            nested.extend(_references_from_value(item))
        return direct + nested

    return direct


def _node_id(
    kind: Optional[str],
    primary: Optional[str],
    secondary: Optional[str] = None,
) -> str:
    """
    Generates a unique node ID from kind and name components.

    Args:
        kind: The node kind (e.g., 'resource', 'variable').
        primary: Primary identifier (e.g., resource type or variable name).
        secondary: Optional secondary identifier (e.g., resource name).

    Returns:
        Dot-separated node ID string.
    """
    parts = [part for part in (kind, primary, secondary) if part]
    return ".".join(parts)


def _ensure_target_node(
    ref: ReferenceDict,
    nodes: Dict[str, GraphNode],
) -> Optional[GraphNode]:
    """
    Ensures a target node exists for a reference, creating placeholder if needed.

    Args:
        ref: The reference to find or create a node for.
        nodes: Dictionary of existing nodes (may be mutated).

    Returns:
        The existing or newly created node, or None if unresolvable.
    """
    ref_id = _reference_to_id(ref)
    if ref_id in nodes:
        return nodes[ref_id]

    placeholder = _reference_to_node(ref)
    if placeholder:
        nodes[placeholder["id"]] = placeholder
        return placeholder

    return None


def _reference_to_id(ref: ReferenceDict) -> str:
    """
    Converts a reference to its corresponding node ID.

    Args:
        ref: The reference dictionary.

    Returns:
        The node ID for this reference.
    """
    kind = ref.get("kind")

    if kind == "variable":
        return _node_id("variable", ref.get("name"))
    if kind == "local":
        return _node_id("locals", ref.get("name"))
    if kind == "module_output":
        return _node_id("module_output", ref.get("module"), ref.get("name"))
    if kind == "data":
        return _node_id("data", ref.get("data_type"), ref.get("name"))
    if kind == "resource":
        return _node_id("resource", ref.get("resource_type"), ref.get("name"))
    if kind == "path":
        return _node_id("path", ref.get("name"))
    if kind == "each":
        return _node_id("each", ref.get("property"))
    if kind == "count":
        return _node_id("count", ref.get("property"))
    if kind == "self":
        return _node_id("self", ref.get("attribute"))

    return ""


def _reference_to_node(ref: ReferenceDict) -> Optional[GraphNode]:
    """
    Creates a placeholder node for a reference.

    Args:
        ref: The reference dictionary.

    Returns:
        A GraphNode representing this reference, or external node as fallback.
    """
    kind = ref.get("kind")
    ref_id = _reference_to_id(ref)

    node_map: Dict[str, GraphNode] = {
        "variable": {"id": ref_id, "kind": "variable", "name": ref.get("name")},
        "local": {"id": ref_id, "kind": "locals", "name": ref.get("name")},
        "module_output": {
            "id": ref_id,
            "kind": "module_output",
            "name": ref.get("name"),
            "type": ref.get("module"),
        },
        "data": {
            "id": ref_id,
            "kind": "data",
            "name": ref.get("name"),
            "type": ref.get("data_type"),
        },
        "resource": {
            "id": ref_id,
            "kind": "resource",
            "name": ref.get("name"),
            "type": ref.get("resource_type"),
        },
        "path": {"id": ref_id, "kind": "path", "name": ref.get("name")},
        "each": {"id": ref_id, "kind": "each", "name": ref.get("property")},
        "count": {"id": ref_id, "kind": "count", "name": ref.get("property")},
        "self": {"id": ref_id, "kind": "self", "name": ref.get("attribute")},
    }

    if kind in node_map:
        return node_map[kind]  # type: ignore[return-value]

    # External/unknown reference
    return {
        "id": f"external.{_ref_key(ref)}",
        "kind": "external",  # type: ignore[typeddict-item]
        "name": "external",
    }


def _ref_key(ref: ReferenceDict) -> str:
    """
    Generates a unique key for a reference (for deduplication).

    Args:
        ref: The reference dictionary.

    Returns:
        JSON string representation of the reference.
    """
    return json.dumps(ref, sort_keys=True)
