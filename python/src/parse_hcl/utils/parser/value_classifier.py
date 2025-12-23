"""
Value classifier for HCL expressions.

Classifies raw value strings into typed Value structures and extracts references.
"""

from __future__ import annotations

import json
import re
from typing import Any, Dict, List, Optional

from ..lexer.hcl_lexer import is_escaped, split_array_elements, split_object_entries
from ...types import ExpressionKind, ReferenceDict, Value

TRAVERSAL_PATTERN = re.compile(r"[A-Za-z_][\w-]*(?:\[(?:[^[\]]*|\*)])?(?:\.[A-Za-z_][\w-]*(?:\[(?:[^[\]]*|\*)])?)+")
"""Pattern for matching traversal expressions (e.g., aws_instance.web.id)."""

SPLAT_PATTERN = re.compile(r"\[\*]")
"""Pattern for matching splat expressions (e.g., aws_instance.web[*].id)."""


def classify_value(raw: str) -> Value:
    """
    Classifies a raw HCL value string into a typed Value structure.

    Supports literals, quoted strings, arrays, objects, and expressions.

    Args:
        raw: The raw value string to classify.

    Returns:
        The classified Value with type information and extracted references.

    Example:
        >>> classify_value('true')
        {'type': 'literal', 'value': True, 'raw': 'true'}

        >>> classify_value('"hello"')
        {'type': 'literal', 'value': 'hello', 'raw': '"hello"'}

        >>> classify_value('var.region')
        {'type': 'expression', 'kind': 'traversal', 'raw': 'var.region', ...}

        >>> classify_value('[1, 2, 3]')
        {'type': 'array', 'value': [...], 'raw': '[1, 2, 3]'}
    """
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


def _classify_literal(raw: str) -> Optional[Value]:
    """
    Classifies a raw value as a literal (boolean, number, or null).

    Args:
        raw: The trimmed raw value.

    Returns:
        LiteralValue if it's a literal, None otherwise.
    """
    if raw in ("true", "false"):
        return {"type": "literal", "value": raw == "true", "raw": raw}

    if re.match(r"^-?\d+(\.\d+)?([eE][+-]?\d+)?$", raw):
        return {"type": "literal", "value": float(raw) if "." in raw or "e" in raw or "E" in raw else int(raw), "raw": raw}

    if raw == "null":
        return {"type": "literal", "value": None, "raw": raw}

    return None


def _classify_array(raw: str) -> Value:
    """
    Classifies and parses an array value with recursive element parsing.

    Args:
        raw: The raw array string including brackets.

    Returns:
        ArrayValue with parsed elements and extracted references.
    """
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
    """
    Classifies and parses an object value with recursive entry parsing.

    Args:
        raw: The raw object string including braces.

    Returns:
        ObjectValue with parsed entries and extracted references.
    """
    entries = split_object_entries(raw)
    parsed_entries: Dict[str, Value] = {key: classify_value(value) for key, value in entries}
    references = _collect_references(list(parsed_entries.values()))

    return {
        "type": "object",
        "value": parsed_entries or None,
        "raw": raw,
        "references": references or None,
    }


def _collect_references(values: List[Value]) -> List[ReferenceDict]:
    """
    Collects all references from an array of values.

    Args:
        values: Array of Value objects.

    Returns:
        Deduplicated array of references.
    """
    refs: List[ReferenceDict] = []

    for value in values:
        if value.get("references"):
            refs.extend(value["references"])  # type: ignore[arg-type]

        if value["type"] == "array" and isinstance(value.get("value"), list):
            refs.extend(_collect_references(value["value"]))  # type: ignore[arg-type]
        if value["type"] == "object" and isinstance(value.get("value"), dict):
            refs.extend(_collect_references(list(value["value"].values())))  # type: ignore[arg-type]

    return _unique_references(refs)


def _classify_expression(raw: str, forced_kind: Optional[ExpressionKind] = None) -> Value:
    """
    Classifies an expression and extracts its references.

    Args:
        raw: The raw expression string.
        forced_kind: Optional forced expression kind.

    Returns:
        ExpressionValue with kind and references.
    """
    kind = forced_kind or _detect_expression_kind(raw)
    references = _extract_expression_references(raw, kind)
    return {"type": "expression", "kind": kind, "raw": raw, "references": references or None}


def _detect_expression_kind(raw: str) -> ExpressionKind:
    """
    Detects the kind of an expression based on its syntax.

    Args:
        raw: The raw expression string.

    Returns:
        The detected ExpressionKind.
    """
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
    """
    Checks if an expression contains a conditional (ternary) operator.

    Handles nested expressions and strings correctly.

    Args:
        raw: The raw expression string.

    Returns:
        True if the expression is a conditional.
    """
    depth = 0
    in_string = False
    string_char: Optional[str] = None
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


def _extract_expression_references(raw: str, kind: ExpressionKind) -> List[ReferenceDict]:
    """
    Extracts references from an expression.

    Args:
        raw: The raw expression string.
        kind: The expression kind.

    Returns:
        Array of extracted references.
    """
    base_refs = _extract_references_from_text(raw)

    if kind == "template":
        matches = re.findall(r"\${([^}]+)}", raw)
        inner_refs: List[ReferenceDict] = []
        for expr in matches:
            inner_refs.extend(_extract_references_from_text(expr))
        return _unique_references(base_refs + inner_refs)

    return base_refs


def _extract_references_from_text(raw: str) -> List[ReferenceDict]:
    """
    Extracts all references from a text string.

    Supports: var.*, local.*, module.*, data.*, resource references,
    path.*, each.*, count.*, self.*

    Args:
        raw: The raw text to extract references from.

    Returns:
        Array of extracted references.
    """
    refs: List[ReferenceDict] = []
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
            ref: ReferenceDict = {
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
            ref: ReferenceDict = {
                "kind": "resource",
                "resource_type": parts[0],
                "name": parts[1],
                "attribute": attribute,
            }
            if has_splat:
                ref["splat"] = True
            refs.append(ref)

    return _unique_references(refs)


def _extract_special_references(raw: str) -> List[ReferenceDict]:
    """
    Extracts special references: each.key, each.value, count.index, self.*

    Args:
        raw: The raw text to extract from.

    Returns:
        Array of special references.
    """
    refs: List[ReferenceDict] = []
    for match in re.findall(r"\beach\.(key|value)\b", raw):
        refs.append({"kind": "each", "property": match})  # type: ignore[typeddict-item]
    if re.search(r"\bcount\.index\b", raw):
        refs.append({"kind": "count", "property": "index"})  # type: ignore[typeddict-item]
    for match in re.findall(r"\bself\.([\w-]+)", raw):
        refs.append({"kind": "self", "attribute": match})
    return refs


def _unique_references(refs: List[ReferenceDict]) -> List[ReferenceDict]:
    """
    Removes duplicate references based on their JSON representation.

    Args:
        refs: Array of references (may contain duplicates).

    Returns:
        Deduplicated array of references.
    """
    seen = set()
    unique: List[ReferenceDict] = []
    for ref in refs:
        key = json.dumps(ref, sort_keys=True)
        if key in seen:
            continue
        seen.add(key)
        unique.append(ref)
    return unique


def _is_quoted_string(value: str) -> bool:
    """
    Checks if a value is a quoted string (single or double quotes).

    Args:
        value: The value to check.

    Returns:
        True if the value is a quoted string.
    """
    return (value.startswith('"') and value.endswith('"')) or (value.startswith("'") and value.endswith("'"))


def _unquote(value: str) -> str:
    """
    Removes quotes from a quoted string and handles escape sequences.

    Args:
        value: The quoted string.

    Returns:
        The unquoted string with escape sequences processed.
    """
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
