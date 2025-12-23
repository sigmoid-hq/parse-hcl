from __future__ import annotations

import json
import re
from typing import Any, Dict, List

from ..lexer.hcl_lexer import is_escaped, split_array_elements, split_object_entries
from ...types import ExpressionKind, Reference, Value

TRAVERSAL_PATTERN = re.compile(r"[A-Za-z_][\w-]*(?:\[(?:[^[\]]*|\*)])?(?:\.[A-Za-z_][\w-]*(?:\[(?:[^[\]]*|\*)])?)+")
SPLAT_PATTERN = re.compile(r"\[\*]")


def classify_value(raw: str) -> Value:
    trimmed = raw.strip()

    literal = _classify_literal(trimmed)
    if literal:
        return literal

    if _is_quoted_string(trimmed):
        inner = _unquote(trimmed)
        if "${" in inner:
            return _classify_expression(inner, "template")
        return {"type": "literal", "value": inner, "raw": trimmed}

    if trimmed.startswith("<<"):
        return _classify_expression(trimmed, "template")

    if trimmed.startswith("[") and trimmed.endswith("]"):
        return _classify_array(trimmed)

    if trimmed.startswith("{") and trimmed.endswith("}"):
        return _classify_object(trimmed)

    return _classify_expression(trimmed)


def _classify_literal(raw: str) -> Value | None:
    if raw in ("true", "false"):
        return {"type": "literal", "value": raw == "true", "raw": raw}

    if re.match(r"^-?\d+(\.\d+)?([eE][+-]?\d+)?$", raw):
        return {"type": "literal", "value": float(raw) if "." in raw or "e" in raw or "E" in raw else int(raw), "raw": raw}

    if raw == "null":
        return {"type": "literal", "value": None, "raw": raw}

    return None


def _classify_array(raw: str) -> Value:
    elements = split_array_elements(raw)
    parsed_elements = [classify_value(elem) for elem in elements]
    references = _collect_references(parsed_elements)

    return {
        "type": "array",
        "value": parsed_elements or None,
        "raw": raw,
        "references": references or None,
    }


def _classify_object(raw: str) -> Value:
    entries = split_object_entries(raw)
    parsed_entries: Dict[str, Value] = {key: classify_value(value) for key, value in entries}
    references = _collect_references(list(parsed_entries.values()))

    return {
        "type": "object",
        "value": parsed_entries or None,
        "raw": raw,
        "references": references or None,
    }


def _collect_references(values: List[Value]) -> List[Reference]:
    refs: List[Reference] = []

    for value in values:
        if value.get("references"):
            refs.extend(value["references"])  # type: ignore[index]

        if value["type"] == "array" and isinstance(value.get("value"), list):
            refs.extend(_collect_references(value["value"]))  # type: ignore[arg-type]
        if value["type"] == "object" and isinstance(value.get("value"), dict):
            refs.extend(_collect_references(list(value["value"].values())))  # type: ignore[arg-type]

    return _unique_references(refs)


def _classify_expression(raw: str, forced_kind: ExpressionKind | None = None) -> Value:
    kind = forced_kind or _detect_expression_kind(raw)
    references = _extract_expression_references(raw, kind)
    return {"type": "expression", "kind": kind, "raw": raw, "references": references or None}


def _detect_expression_kind(raw: str) -> ExpressionKind:
    if "${" in raw:
        return "template"
    if _has_conditional_operator(raw):
        return "conditional"
    if re.match(r"^[\w.-]+\(", raw):
        return "function_call"
    if re.match(r"^\[\s*for\s+.+\s+in\s+.+:\s+", raw) or re.match(r"^\{\s*for\s+.+\s+in\s+.+:\s+", raw):
        return "for_expr"
    if SPLAT_PATTERN.search(raw):
        return "splat"
    if re.match(r"^[\w.-]+(\[[^\]]*])?$", raw):
        return "traversal"
    return "unknown"


def _has_conditional_operator(raw: str) -> bool:
    depth = 0
    in_string = False
    string_char: str | None = None
    question_found = False
    question_depth = -1

    for i, char in enumerate(raw):
        if not in_string:
            if char in ('"', "'"):
                in_string = True
                string_char = char
                continue
            if char in "([{":
                depth += 1
                continue
            if char in ")]}":
                depth -= 1
                continue
            if char == "?" and depth == 0:
                question_found = True
                question_depth = depth
                continue
            if char == ":" and question_found and depth == question_depth:
                return True
        else:
            if char == string_char and not is_escaped(raw, i):
                in_string = False
                string_char = None
    return False


def _extract_expression_references(raw: str, kind: ExpressionKind) -> List[Reference]:
    base_refs = _extract_references_from_text(raw)

    if kind == "template":
        matches = re.findall(r"\${([^}]+)}", raw)
        inner_refs = []
        for expr in matches:
            inner_refs.extend(_extract_references_from_text(expr))
        return _unique_references(base_refs + inner_refs)

    return base_refs


def _extract_references_from_text(raw: str) -> List[Reference]:
    refs: List[Reference] = []
    refs.extend(_extract_special_references(raw))

    for match in TRAVERSAL_PATTERN.findall(raw):
        has_splat = "[*]" in match
        parts = [re.sub(r"\[.*?]", "", part) for part in match.split(".")]

        if parts[0] == "var" and len(parts) > 1:
            refs.append({"kind": "variable", "name": parts[1]})
            continue

        if parts[0] == "local" and len(parts) > 1:
            refs.append({"kind": "local", "name": parts[1]})
            continue

        if parts[0] == "module" and len(parts) > 1:
            attribute = ".".join(parts[2:]) or parts[1]
            refs.append({"kind": "module_output", "module": parts[1], "name": attribute})
            continue

        if parts[0] == "data" and len(parts) > 2:
            attribute = ".".join(parts[3:]) or None
            ref: Reference = {
                "kind": "data",
                "data_type": parts[1],
                "name": parts[2],
                "attribute": attribute,
            }
            if has_splat:
                ref["splat"] = True
            refs.append(ref)
            continue

        if parts[0] == "path" and len(parts) > 1:
            refs.append({"kind": "path", "name": parts[1]})
            continue

        if parts[0] in ("each", "count", "self"):
            continue

        if len(parts) >= 2:
            attribute = ".".join(parts[2:]) or None
            ref: Reference = {
                "kind": "resource",
                "resource_type": parts[0],
                "name": parts[1],
                "attribute": attribute,
            }
            if has_splat:
                ref["splat"] = True
            refs.append(ref)

    return _unique_references(refs)


def _extract_special_references(raw: str) -> List[Reference]:
    refs: List[Reference] = []
    for match in re.findall(r"\beach\.(key|value)\b", raw):
        refs.append({"kind": "each", "property": match})  # type: ignore[arg-type]
    if re.search(r"\bcount\.index\b", raw):
        refs.append({"kind": "count", "property": "index"})  # type: ignore[arg-type]
    for match in re.findall(r"\bself\.([\w-]+)", raw):
        refs.append({"kind": "self", "attribute": match})
    return refs


def _unique_references(refs: List[Reference]) -> List[Reference]:
    seen = set()
    unique: List[Reference] = []
    for ref in refs:
        key = json.dumps(ref, sort_keys=True)
        if key in seen:
            continue
        seen.add(key)
        unique.append(ref)
    return unique


def _is_quoted_string(value: str) -> bool:
    return (value.startswith('"') and value.endswith('"')) or (value.startswith("'") and value.endswith("'"))


def _unquote(value: str) -> str:
    quote = value[0]
    inner = value[1:-1]
    result = []
    i = 0
    while i < len(inner):
        if inner[i] == "\\" and i + 1 < len(inner):
            nxt = inner[i + 1]
            if nxt == "n":
                result.append("\n")
                i += 2
                continue
            if nxt == "t":
                result.append("\t")
                i += 2
                continue
            if nxt == "r":
                result.append("\r")
                i += 2
                continue
            if nxt == "\\":
                result.append("\\")
                i += 2
                continue
            if nxt == quote:
                result.append(quote)
                i += 2
                continue
        result.append(inner[i])
        i += 1
    return "".join(result)
