"""
Serialization utilities for Terraform documents.

Provides functions for serializing parsed Terraform documents to JSON
and YAML formats, with optional pruning of empty values.
"""

from __future__ import annotations

import json
from typing import Any, Dict

from ..graph.graph_builder import create_export
from ...types import TerraformDocument, TerraformExport
from .yaml import to_yaml


def to_json(document: Any, prune_empty: bool = True) -> str:
    """
    Serializes a Terraform document to JSON format.

    Args:
        document: The document to serialize (typically a TerraformDocument).
        prune_empty: If True, removes empty arrays, objects, and None values.

    Returns:
        JSON string with 2-space indentation.

    Example:
        >>> doc = {'resource': [{'type': 'aws_instance', 'name': 'main'}]}
        >>> print(to_json(doc))
        {
          "resource": [
            {
              "type": "aws_instance",
              "name": "main"
            }
          ]
        }
    """
    value = _prune_document(document) if prune_empty and _is_terraform_document(document) else document
    return json.dumps(value, indent=2)


def to_json_export(document: TerraformDocument, prune_empty: bool = True) -> str:
    """
    Serializes a Terraform document with dependency graph to JSON.

    Creates a complete export including the document and its dependency
    graph, then serializes to JSON format.

    Args:
        document: The parsed TerraformDocument.
        prune_empty: If True, removes empty values from the document.

    Returns:
        JSON string containing version, document, and graph.

    Example:
        >>> doc = parser.parse_file('main.tf')
        >>> export_json = to_json_export(doc)
        >>> data = json.loads(export_json)
        >>> print(data['version'])
        '1.0.0'
    """
    return json.dumps(to_export(document, prune_empty=prune_empty), indent=2)


def to_export(document: TerraformDocument, prune_empty: bool = True) -> TerraformExport:
    """
    Creates a complete export object with document and dependency graph.

    Args:
        document: The parsed TerraformDocument.
        prune_empty: If True, removes empty values from the document.

    Returns:
        TerraformExport dictionary containing:
        - version: Export format version
        - document: The (optionally pruned) document
        - graph: Dependency graph with nodes and edges

    Example:
        >>> doc = parser.parse_file('main.tf')
        >>> export = to_export(doc)
        >>> print(len(export['graph']['nodes']))
        5
    """
    export_payload = create_export(document)
    pruned_document = _prune_document(document) if prune_empty else document
    export_payload["document"] = pruned_document
    return export_payload


def to_yaml_document(document: Any, prune_empty: bool = True) -> str:
    """
    Serializes a Terraform document to YAML format.

    Args:
        document: The document to serialize (typically a TerraformDocument).
        prune_empty: If True, removes empty arrays, objects, and None values.

    Returns:
        YAML string representation.

    Example:
        >>> doc = {'resource': [{'type': 'aws_instance', 'name': 'main'}]}
        >>> print(to_yaml_document(doc))
        resource:
          - type: aws_instance
            name: main
    """
    value = _prune_document(document) if prune_empty and _is_terraform_document(document) else document
    return to_yaml(value)


def _prune_document(document: TerraformDocument) -> Dict[str, Any]:
    """
    Prunes a Terraform document, removing empty values.

    Args:
        document: The TerraformDocument to prune.

    Returns:
        Pruned document with empty arrays, objects, and None removed.
    """
    return _prune_value(document) or {}


def _prune_value(value: Any) -> Any:
    """
    Recursively prunes a value, removing empty containers and None.

    Args:
        value: The value to prune.

    Returns:
        The pruned value, or None if the value is empty.

    Example:
        >>> _prune_value({'a': [], 'b': 1, 'c': None})
        {'b': 1}
        >>> _prune_value([1, None, [], 2])
        [1, 2]
    """
    if value is None:
        return None
    if isinstance(value, list):
        items = [item for item in (_prune_value(item) for item in value) if item not in (None, [], {}, ())]
        return items or None
    if isinstance(value, dict):
        pruned: Dict[str, Any] = {}
        for key, val in value.items():
            next_val = _prune_value(val)
            if next_val is None or next_val == [] or next_val == {}:
                continue
            pruned[key] = next_val
        return pruned or None
    return value


def _is_terraform_document(doc: Any) -> bool:
    """
    Checks if a value looks like a TerraformDocument.

    Args:
        doc: The value to check.

    Returns:
        True if the value is a dict with a 'resource' key.
    """
    return isinstance(doc, dict) and "resource" in doc
