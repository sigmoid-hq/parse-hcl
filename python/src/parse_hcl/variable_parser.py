from __future__ import annotations

from typing import Dict, List, Optional

from .body_parser import parse_block_body
from .types import HclBlock, Value
from .value_helpers import literal_boolean, literal_string


class VariableParser:
    def parse(self, block: HclBlock) -> Dict[str, object]:
        name = block["labels"][0] if block["labels"] else "unknown"
        parsed = parse_block_body(block["body"])

        description_val = parsed["attributes"].get("description")  # type: ignore[index]
        description = literal_string(description_val) or (description_val.get("raw") if isinstance(description_val, dict) else None)
        type_val = parsed["attributes"].get("type")  # type: ignore[index]
        type_raw = literal_string(type_val) or (type_val.get("raw") if isinstance(type_val, dict) else None)
        sensitive = literal_boolean(parsed["attributes"].get("sensitive"))  # type: ignore[index]
        nullable = literal_boolean(parsed["attributes"].get("nullable"))  # type: ignore[index]
        validation = self._extract_validation(parsed["blocks"])  # type: ignore[arg-type]
        type_constraint = parse_type_constraint(type_raw) if type_raw else None

        return {
            "name": name,
            "description": description,
            "type": type_raw,
            "typeConstraint": type_constraint,
            "default": parsed["attributes"].get("default"),  # type: ignore[index]
            "validation": validation,
            "sensitive": sensitive,
            "nullable": nullable,
            "raw": block["raw"],
            "source": block["source"],
        }

    def _extract_validation(self, blocks: List[Dict[str, object]]) -> Optional[Dict[str, Value]]:
        validation_block = next((b for b in blocks if b.get("type") == "validation"), None)
        if not validation_block:
            return None

        attrs = validation_block.get("attributes", {})
        condition = attrs.get("condition") if isinstance(attrs, dict) else None
        error_message = attrs.get("error_message") if isinstance(attrs, dict) else None

        if not condition and not error_message:
            return None

        return {"condition": condition, "error_message": error_message}


def parse_type_constraint(raw: str) -> Dict[str, object]:
    trimmed = raw.strip()
    primitives = {"string", "number", "bool", "any"}
    if trimmed in primitives:
        return {"base": trimmed, "raw": trimmed}

    collection_match = _match_collection(trimmed)
    if collection_match:
        base, inner = collection_match
        return {"base": base, "element": parse_type_constraint(inner), "raw": trimmed}

    optional_match = _match_optional(trimmed)
    if optional_match:
        inner = parse_type_constraint(optional_match)
        inner_copy = dict(inner)
        inner_copy["optional"] = True
        inner_copy["raw"] = trimmed
        return inner_copy

    tuple_match = _match_tuple(trimmed)
    if tuple_match:
        return {"base": "tuple", "raw": trimmed}

    object_match = _match_object(trimmed)
    if object_match is not None:
        return {"base": "object", "attributes": object_match, "raw": trimmed}

    return {"base": trimmed, "raw": trimmed}


def _match_collection(raw: str) -> Optional[tuple[str, str]]:
    if raw.startswith(("list(", "set(", "map(")) and raw.endswith(")"):
        parts = raw.split("(", 1)
        base = parts[0].strip()
        inner = raw[len(base) + 1 : -1]
        return base, inner
    return None


def _match_optional(raw: str) -> Optional[str]:
    if raw.startswith("optional(") and raw.endswith(")"):
        return raw[len("optional(") : -1].strip()
    return None


def _match_tuple(raw: str) -> Optional[str]:
    if raw.startswith("tuple(") and raw.endswith(")"):
        return raw
    return None


def _match_object(raw: str) -> Optional[Dict[str, object]]:
    if not raw.startswith("object(") or not raw.endswith(")"):
        return None
    inner = raw[len("object(") : -1].strip()
    if not inner.startswith("{") or not inner.endswith("}"):
        return None
    return _parse_object_type_attributes(inner[1:-1])


def _parse_object_type_attributes(inner: str) -> Dict[str, object]:
    attributes: Dict[str, object] = {}
    trimmed = inner.strip()
    if not trimmed:
        return attributes

    depth = 0
    current = []
    entries: List[str] = []

    for char in trimmed:
        if char in "({[":
            depth += 1
            current.append(char)
        elif char in ")}]":
            depth -= 1
            current.append(char)
        elif char == "," and depth == 0:
            entry = "".join(current).strip()
            if entry:
                entries.append(entry)
            current = []
        else:
            current.append(char)
    if "".join(current).strip():
        entries.append("".join(current).strip())

    for entry in entries:
        if "=" in entry:
            name, type_expr = entry.split("=", 1)
            attributes[name.strip()] = parse_type_constraint(type_expr.strip())

    return attributes
