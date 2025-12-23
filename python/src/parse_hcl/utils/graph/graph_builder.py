from __future__ import annotations

from typing import Any, Dict, List

from ...types import DependencyGraph, Reference, TerraformDocument, TerraformExport

GRAPH_VERSION = "1.0.0"


def build_dependency_graph(document: TerraformDocument) -> DependencyGraph:
    nodes: Dict[str, Dict[str, Any]] = {}
    edges: List[Dict[str, Any]] = []
    orphan_references: List[Reference] = []
    edge_keys = set()

    _populate_nodes(document, nodes)

    def add_edges(from_node: Dict[str, Any] | None, refs: List[Reference], source: str | None = None) -> None:
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
            edges.append({"from": from_node["id"], "to": target["id"], "reference": ref, "source": source})

    for block in document.get("terraform", []):
        node = nodes.get(_node_id("terraform", "settings"))
        add_edges(node, _references_from_attributes(block.get("properties")), block.get("source"))

    for provider in document.get("provider", []):
        node = nodes.get(_node_id("provider", provider.get("name"), provider.get("alias")))
        add_edges(node, _references_from_attributes(provider.get("properties")), provider.get("source"))

    for variable in document.get("variable", []):
        node = nodes.get(_node_id("variable", variable.get("name")))
        add_edges(node, _references_from_value(variable.get("default")), variable.get("source"))

    for output in document.get("output", []):
        node = nodes.get(_node_id("output", output.get("name")))
        add_edges(node, _references_from_value(output.get("value")), output.get("source"))

    for module in document.get("module", []):
        node = nodes.get(_node_id("module", module.get("name")))
        add_edges(node, _references_from_attributes(module.get("properties")), module.get("source"))

    for resource in document.get("resource", []):
        node = nodes.get(_node_id("resource", resource.get("type"), resource.get("name")))
        add_edges(node, _references_from_attributes(resource.get("properties")), resource.get("source"))
        add_edges(node, _references_from_attributes(resource.get("meta")), resource.get("source"))

        for dyn in resource.get("dynamic_blocks", []):
            add_edges(node, _references_from_value(dyn.get("for_each")), resource.get("source"))
            add_edges(node, _references_from_attributes(dyn.get("content")), resource.get("source"))

        add_edges(node, _references_from_nested_blocks(resource.get("blocks", [])), resource.get("source"))

    for data in document.get("data", []):
        node = nodes.get(_node_id("data", data.get("dataType"), data.get("name")))
        add_edges(node, _references_from_attributes(data.get("properties")), data.get("source"))
        add_edges(node, _references_from_nested_blocks(data.get("blocks", [])), data.get("source"))

    for local in document.get("locals", []):
        node = nodes.get(_node_id("locals", local.get("name")))
        add_edges(node, _references_from_value(local.get("value")), local.get("source"))

    other_blocks = []
    other_blocks.extend(document.get("moved", []))
    other_blocks.extend(document.get("import", []))
    other_blocks.extend(document.get("check", []))
    other_blocks.extend(document.get("terraform_data", []))
    other_blocks.extend(document.get("unknown", []))

    for block in other_blocks:
        all_refs = _references_from_attributes(block.get("properties")) + _references_from_nested_blocks(block.get("blocks", []))
        block_node = nodes.get(_node_id(block.get("type"), (block.get("labels") or ["default"])[0]))
        if not block_node:
            new_node = {
                "id": _node_id(block.get("type"), (block.get("labels") or ["default"])[0]),
                "kind": block.get("type"),
                "name": (block.get("labels") or ["default"])[0],
                "source": block.get("source"),
            }
            nodes[new_node["id"]] = new_node
            add_edges(new_node, all_refs, block.get("source"))
        else:
            add_edges(block_node, all_refs, block.get("source"))

    return {"nodes": list(nodes.values()), "edges": edges, "orphanReferences": orphan_references}


def create_export(document: TerraformDocument) -> TerraformExport:
    return {"version": GRAPH_VERSION, "document": document, "graph": build_dependency_graph(document)}


def _populate_nodes(document: TerraformDocument, nodes: Dict[str, Dict[str, Any]]) -> None:
    def add_node(node: Dict[str, Any]) -> None:
        if node["id"] not in nodes:
            nodes[node["id"]] = node

    add_node({"id": _node_id("terraform", "settings"), "kind": "terraform", "name": "settings"})

    for provider in document.get("provider", []):
        add_node(
            {
                "id": _node_id("provider", provider.get("name"), provider.get("alias")),
                "kind": "provider",
                "name": provider.get("alias") or provider.get("name"),
                "type": provider.get("name"),
                "source": provider.get("source"),
            }
        )

    for variable in document.get("variable", []):
        add_node({"id": _node_id("variable", variable.get("name")), "kind": "variable", "name": variable.get("name"), "source": variable.get("source")})

    for output in document.get("output", []):
        add_node({"id": _node_id("output", output.get("name")), "kind": "output", "name": output.get("name"), "source": output.get("source")})

    for module in document.get("module", []):
        add_node({"id": _node_id("module", module.get("name")), "kind": "module", "name": module.get("name"), "source": module.get("source")})

    for resource in document.get("resource", []):
        add_node(
            {
                "id": _node_id("resource", resource.get("type"), resource.get("name")),
                "kind": "resource",
                "name": resource.get("name"),
                "type": resource.get("type"),
                "source": resource.get("source"),
            }
        )

    for data in document.get("data", []):
        add_node(
            {
                "id": _node_id("data", data.get("dataType"), data.get("name")),
                "kind": "data",
                "name": data.get("name"),
                "type": data.get("dataType"),
                "source": data.get("source"),
            }
        )

    for local in document.get("locals", []):
        add_node({"id": _node_id("locals", local.get("name")), "kind": "locals", "name": local.get("name"), "source": local.get("source")})


def _references_from_attributes(attributes: Dict[str, Any] | None) -> List[Reference]:
    if not attributes:
        return []
    refs: List[Reference] = []
    for value in attributes.values():
        refs.extend(_references_from_value(value))
    return refs


def _references_from_nested_blocks(blocks: List[Dict[str, Any]]) -> List[Reference]:
    refs: List[Reference] = []
    for block in blocks or []:
        refs.extend(_references_from_attributes(block.get("attributes")))
        refs.extend(_references_from_nested_blocks(block.get("blocks", [])))
    return refs


def _references_from_value(value: Any) -> List[Reference]:
    if not isinstance(value, dict):
        return []

    direct = value.get("references") or []
    if value.get("type") == "object" and isinstance(value.get("value"), dict):
        return direct + _references_from_attributes(value.get("value"))
    if value.get("type") == "array" and isinstance(value.get("value"), list):
        nested = []
        for item in value.get("value"):
            nested.extend(_references_from_value(item))
        return direct + nested
    return direct or []


def _node_id(kind: str | None, primary: str | None, secondary: str | None = None) -> str:
    parts = [part for part in (kind, primary, secondary) if part]
    return ".".join(parts)


def _ensure_target_node(ref: Reference, nodes: Dict[str, Dict[str, Any]]) -> Dict[str, Any] | None:
    ref_id = _reference_to_id(ref)
    if ref_id in nodes:
        return nodes[ref_id]
    placeholder = _reference_to_node(ref)
    if placeholder:
        nodes[placeholder["id"]] = placeholder
        return placeholder
    return None


def _reference_to_id(ref: Reference) -> str:
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


def _reference_to_node(ref: Reference) -> Dict[str, Any] | None:
    kind = ref.get("kind")
    if kind == "variable":
        return {"id": _reference_to_id(ref), "kind": "variable", "name": ref.get("name")}
    if kind == "local":
        return {"id": _reference_to_id(ref), "kind": "locals", "name": ref.get("name")}
    if kind == "module_output":
        return {"id": _reference_to_id(ref), "kind": "module_output", "name": ref.get("name"), "type": ref.get("module")}
    if kind == "data":
        return {"id": _reference_to_id(ref), "kind": "data", "name": ref.get("name"), "type": ref.get("data_type")}
    if kind == "resource":
        return {"id": _reference_to_id(ref), "kind": "resource", "name": ref.get("name"), "type": ref.get("resource_type")}
    if kind == "path":
        return {"id": _reference_to_id(ref), "kind": "path", "name": ref.get("name")}
    if kind == "each":
        return {"id": _reference_to_id(ref), "kind": "each", "name": ref.get("property")}
    if kind == "count":
        return {"id": _reference_to_id(ref), "kind": "count", "name": ref.get("property")}
    if kind == "self":
        return {"id": _reference_to_id(ref), "kind": "self", "name": ref.get("attribute")}
    return {"id": f"external.{_ref_key(ref)}", "kind": "external", "name": "external"}


def _ref_key(ref: Reference) -> str:
    import json
    return json.dumps(ref, sort_keys=True)
