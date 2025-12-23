"""
Parser for Terraform variable blocks.

Extracts variable declarations with type constraints, defaults, and validations.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Tuple

from ..types import HclBlock, TypeConstraint, Value, VariableValidation
from ..utils.common.value_helpers import literal_boolean, literal_string
from ..utils.parser.body_parser import parse_block_body

# Regex patterns for type constraint parsing (matches TypeScript implementation)
COLLECTION_PATTERN = re.compile(r"^(list|set|map)\s*\(\s*([\s\S]*)\s*\)$")
OPTIONAL_PATTERN = re.compile(r"^optional\s*\(\s*([\s\S]*)\s*\)$")
TUPLE_PATTERN = re.compile(r"^tuple\s*\(\s*\[([\s\S]*)\]\s*\)$")
OBJECT_PATTERN = re.compile(r"^object\s*\(\s*\{([\s\S]*)\}\s*\)$")


class VariableParser:
    """
    Parser for Terraform variable definition blocks.

    Example HCL:
        variable "instance_type" {
          type        = string
          default     = "t2.micro"
          description = "EC2 instance type"
          sensitive   = false

          validation {
            condition     = can(regex("^t[23]\\\\.", var.instance_type))
            error_message = "Must be a t2 or t3 instance type."
          }
        }
    """

    def parse(self, block: HclBlock) -> Dict[str, object]:
        """
        Parses a variable block into a structured VariableBlock.

        Args:
            block: The raw HCL block to parse.

        Returns:
            Parsed VariableBlock with all extracted fields including:
            - name: Variable name
            - description: Optional description
            - type: Type constraint expression
            - typeConstraint: Parsed type constraint
            - default: Default value
            - validation: Validation rules
            - sensitive: Whether the variable is sensitive
            - nullable: Whether the variable is nullable
        """
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

    def _extract_validation(self, blocks: List[Dict[str, object]]) -> Optional[VariableValidation]:
        """
        Extracts validation rules from nested validation blocks.

        Args:
            blocks: Nested blocks from the variable body.

        Returns:
            VariableValidation if a validation block exists, None otherwise.
        """
        validation_block = next((b for b in blocks if b.get("type") == "validation"), None)
        if not validation_block:
            return None

        attrs = validation_block.get("attributes", {})
        condition = attrs.get("condition") if isinstance(attrs, dict) else None
        error_message = attrs.get("error_message") if isinstance(attrs, dict) else None

        if not condition and not error_message:
            return None

        return {"condition": condition, "error_message": error_message}


def parse_type_constraint(raw: str) -> TypeConstraint:
    """
    Parses a Terraform type constraint expression into a structured TypeConstraint.

    Uses regex patterns for robust parsing that handles whitespace correctly.

    Supports:
    - Primitive types: string, number, bool, any
    - Collection types: list(T), set(T), map(T)
    - Structural types: object({ attr = type, ... }), tuple([type, ...])
    - Optional attributes: optional(type)

    Args:
        raw: The raw type expression string.

    Returns:
        Parsed TypeConstraint with base type and nested structure.

    Example:
        >>> parse_type_constraint('string')
        {'base': 'string', 'raw': 'string'}

        >>> parse_type_constraint('list(string)')
        {'base': 'list', 'element': {'base': 'string', ...}, 'raw': 'list(string)'}

        >>> parse_type_constraint('list ( string )')  # Handles whitespace
        {'base': 'list', 'element': {'base': 'string', ...}, 'raw': 'list ( string )'}

        >>> parse_type_constraint('tuple([string, number])')
        {'base': 'tuple', 'elements': [...], 'raw': 'tuple([string, number])'}
    """
    trimmed = raw.strip()
    primitives = {"string", "number", "bool", "any"}

    if trimmed in primitives:
        return {"base": trimmed, "raw": trimmed}

    # Check for collection types: list(T), set(T), map(T) - using regex for whitespace
    collection_match = COLLECTION_PATTERN.match(trimmed)
    if collection_match:
        base, inner = collection_match.groups()
        return {
            "base": base,
            "element": parse_type_constraint(inner.strip()),
            "raw": trimmed,
        }

    # Check for optional(T) - using regex for whitespace
    optional_match = OPTIONAL_PATTERN.match(trimmed)
    if optional_match:
        inner = parse_type_constraint(optional_match.group(1).strip())
        result = dict(inner)
        result["optional"] = True
        result["raw"] = trimmed
        return result  # type: ignore[return-value]

    # Check for tuple([T1, T2, ...]) - preserve element types
    tuple_match = TUPLE_PATTERN.match(trimmed)
    if tuple_match:
        inner_content = tuple_match.group(1).strip()
        elements = _parse_tuple_elements(inner_content)
        result: TypeConstraint = {
            "base": "tuple",
            "raw": trimmed,
        }
        if elements:
            result["elements"] = elements  # type: ignore[typeddict-unknown-key]
        return result

    # Check for object({ attr = type, ... }) - using regex for whitespace
    object_match = OBJECT_PATTERN.match(trimmed)
    if object_match:
        inner_content = object_match.group(1)
        attributes = _parse_object_type_attributes(inner_content)
        result = {
            "base": "object",
            "raw": trimmed,
        }
        if attributes:
            result["attributes"] = attributes
        return result

    # Default: treat as unknown/complex type expression
    return {"base": trimmed, "raw": trimmed}


def _parse_tuple_elements(inner: str) -> List[TypeConstraint]:
    """
    Parses tuple element types from the inner content of a tuple type.

    Handles nested types correctly by tracking bracket depth.

    Args:
        inner: The content inside tuple([ ... ]).

    Returns:
        List of TypeConstraint for each element.
    """
    elements: List[TypeConstraint] = []
    trimmed = inner.strip()

    if not trimmed:
        return elements

    # Split by commas, respecting nested structures
    depth = 0
    current: List[str] = []
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

    # Don't forget the last entry
    final = "".join(current).strip()
    if final:
        entries.append(final)

    # Parse each element type
    for entry in entries:
        elements.append(parse_type_constraint(entry))

    return elements


def _parse_object_type_attributes(inner: str) -> Dict[str, TypeConstraint]:
    """
    Parses object type attributes from the inner content of an object type.

    Handles nested types and complex expressions correctly.

    Args:
        inner: The content inside object({ ... }).

    Returns:
        Record of attribute names to their TypeConstraints.
    """
    attributes: Dict[str, TypeConstraint] = {}
    trimmed = inner.strip()

    if not trimmed:
        return attributes

    # Split by commas, respecting nested structures
    depth = 0
    current: List[str] = []
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

    # Don't forget the last entry
    final = "".join(current).strip()
    if final:
        entries.append(final)

    # Parse each entry (format: "name = type")
    for entry in entries:
        match = re.match(r"^(\w+)\s*=\s*([\s\S]+)$", entry)
        if match:
            attr_name, attr_type = match.groups()
            attributes[attr_name] = parse_type_constraint(attr_type.strip())

    return attributes
