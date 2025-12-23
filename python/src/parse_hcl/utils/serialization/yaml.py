"""
YAML serialization utilities.

Provides custom YAML serialization that matches the TypeScript implementation.
"""

from __future__ import annotations

import json
from typing import Any

PAD = "  "


def to_yaml(value: Any) -> str:
    """
    Converts a value to a YAML-formatted string.

    Handles nested objects, arrays, and scalar values with proper indentation.

    Args:
        value: The value to serialize.

    Returns:
        YAML-formatted string representation.
    """
    return _render(value, 0)


def _render(value: Any, level: int) -> str:
    """
    Recursively renders a value to YAML format.

    Args:
        value: The value to render.
        level: Current indentation level.

    Returns:
        YAML-formatted string for this value.
    """
    if _is_scalar(value):
        return _format_scalar(value)

    if isinstance(value, list):
        if not value:
            return f"{_indent(level)}[]"
        lines = []
        for item in value:
            if _is_scalar(item):
                lines.append(f"{_indent(level)}- {_format_scalar(item)}")
            else:
                rendered = _render(item, level + 1)
                rendered_lines = rendered.split("\n")
                head = rendered_lines[0]
                head_line = head[len(_indent(level + 1)) :] if head.startswith(_indent(level + 1)) else head
                tail = "\n".join(rendered_lines[1:]) if len(rendered_lines) > 1 else ""
                prefix = f"{_indent(level)}- {head_line}"
                lines.append(f"{prefix}\n{tail}" if tail else prefix)
        return "\n".join(lines)

    if isinstance(value, dict):
        if not value:
            return f"{_indent(level)}{{}}"
        lines = []
        for key, val in value.items():
            if _is_scalar(val):
                lines.append(f"{_indent(level)}{key}: {_format_scalar(val)}")
            else:
                rendered = _render(val, level + 1)
                lines.append(f"{_indent(level)}{key}:\n{rendered}")
        return "\n".join(lines)

    # Fallback: use JSON.stringify equivalent for unknown types
    try:
        return f"{_indent(level)}{json.dumps(value)}"
    except (TypeError, ValueError):
        return f"{_indent(level)}{value!r}"


def _format_scalar(value: Any) -> str:
    """
    Formats a scalar value for YAML output.

    Args:
        value: The scalar value to format.

    Returns:
        YAML-formatted string representation.
    """
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, str):
        return f'"{_escape_string(value)}"' if _needs_quoting(value) else value
    if isinstance(value, (int, float)):
        return str(value)
    # Fallback for other types
    try:
        return json.dumps(value)
    except (TypeError, ValueError):
        return repr(value)


def _escape_string(value: str) -> str:
    """
    Escapes special characters in a string for YAML output.

    Args:
        value: The string to escape.

    Returns:
        Escaped string.
    """
    return value.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n").replace("\t", "\\t").replace("\r", "\\r")


def _indent(level: int) -> str:
    """
    Returns the indentation string for a given level.

    Args:
        level: The indentation level.

    Returns:
        Indentation string (spaces).
    """
    return PAD * level


def _is_scalar(value: Any) -> bool:
    """
    Checks if a value is a scalar type.

    Args:
        value: The value to check.

    Returns:
        True if the value is a scalar (None, str, int, float, bool).
    """
    return value is None or isinstance(value, (str, int, float, bool))


def _needs_quoting(value: str) -> bool:
    """
    Checks if a string needs to be quoted in YAML.

    Args:
        value: The string to check.

    Returns:
        True if the string needs quoting.
    """
    if not value:
        return True

    # Check for YAML special characters
    special_chars = set(':#{}[]&*#?|<>=%@`"\'\n\t\r')
    if special_chars.intersection(value):
        return True

    # Check for leading/trailing whitespace
    if value != value.strip():
        return True

    # Check for values that could be interpreted as other types
    lower = value.lower()
    if lower in ("true", "false", "null", "yes", "no", "on", "off"):
        return True

    # Check if it looks like a number
    try:
        float(value)
        return True
    except ValueError:
        pass

    return False
