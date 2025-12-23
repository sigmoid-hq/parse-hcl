from __future__ import annotations

from typing import Any, Optional

from .types import Value


def literal_string(value: Value | None) -> Optional[str]:
    if value and value.get("type") == "literal" and isinstance(value.get("value"), str):
        return value["value"]  # type: ignore[return-value]
    return None


def literal_boolean(value: Value | None) -> Optional[bool]:
    if value and value.get("type") == "literal" and isinstance(value.get("value"), bool):
        return value["value"]  # type: ignore[return-value]
    return None


def literal_number(value: Value | None) -> Optional[float]:
    if value and value.get("type") == "literal" and isinstance(value.get("value"), (int, float)):
        return float(value["value"])  # type: ignore[return-value]
    return None
