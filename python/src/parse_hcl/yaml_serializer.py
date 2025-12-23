from __future__ import annotations

from typing import Any

PAD = "  "


def to_yaml(value: Any) -> str:
    return _render(value, 0)


def _render(value: Any, level: int) -> str:
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

    return f"{_indent(level)}{value}"


def _format_scalar(value: Any) -> str:
    if value is None:
        return "null"
    if isinstance(value, str):
        return f'"{value}"' if _needs_quoting(value) else value
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value)


def _indent(level: int) -> str:
    return PAD * level


def _is_scalar(value: Any) -> bool:
    return value is None or isinstance(value, (str, int, float, bool))


def _needs_quoting(value: str) -> bool:
    return bool(
        set(':#{}[]&*#?|<>=%@`').intersection(value)
        or '"' in value
        or "'" in value
        or "\n" in value
    )
