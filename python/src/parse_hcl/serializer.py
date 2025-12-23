from __future__ import annotations

import json
from typing import Any, Dict

from .graph import create_export
from .types import TerraformDocument, TerraformExport
from .yaml_serializer import to_yaml


def to_json(document: Any, prune_empty: bool = True) -> str:
    value = _prune_document(document) if prune_empty and _is_terraform_document(document) else document
    return json.dumps(value, indent=2)


def to_json_export(document: TerraformDocument, prune_empty: bool = True) -> str:
    return json.dumps(to_export(document, prune_empty=prune_empty), indent=2)


def to_export(document: TerraformDocument, prune_empty: bool = True) -> TerraformExport:
    export_payload = create_export(document)
    pruned_document = _prune_document(document) if prune_empty else document
    export_payload["document"] = pruned_document
    return export_payload


def to_yaml_document(document: Any, prune_empty: bool = True) -> str:
    value = _prune_document(document) if prune_empty and _is_terraform_document(document) else document
    return to_yaml(value)


def _prune_document(document: TerraformDocument) -> Dict[str, Any]:
    return _prune_value(document) or {}


def _prune_value(value: Any) -> Any:
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
    return isinstance(doc, dict) and "resource" in doc
