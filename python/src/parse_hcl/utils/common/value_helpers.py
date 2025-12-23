"""
Value extraction helpers for Terraform configuration values.

Provides type-safe extraction of literal values from parsed Value structures.
"""

from __future__ import annotations

from typing import Optional, Union

from ...types import Value


def literal_string(value: Optional[Value]) -> Optional[str]:
    """
    Extracts a string value from a literal Value.

    Args:
        value: A Value dictionary that may contain a literal string.

    Returns:
        The string value if the Value is a literal string, None otherwise.

    Example:
        >>> val = {'type': 'literal', 'value': 'hello', 'raw': '"hello"'}
        >>> literal_string(val)
        'hello'

        >>> val = {'type': 'literal', 'value': 123, 'raw': '123'}
        >>> literal_string(val)
        None
    """
    if value and value.get("type") == "literal" and isinstance(value.get("value"), str):
        return value["value"]  # type: ignore[return-value]
    return None


def literal_boolean(value: Optional[Value]) -> Optional[bool]:
    """
    Extracts a boolean value from a literal Value.

    Args:
        value: A Value dictionary that may contain a literal boolean.

    Returns:
        The boolean value if the Value is a literal boolean, None otherwise.

    Example:
        >>> val = {'type': 'literal', 'value': True, 'raw': 'true'}
        >>> literal_boolean(val)
        True

        >>> val = {'type': 'literal', 'value': 'true', 'raw': '"true"'}
        >>> literal_boolean(val)
        None
    """
    if value and value.get("type") == "literal" and isinstance(value.get("value"), bool):
        return value["value"]  # type: ignore[return-value]
    return None


def literal_number(value: Optional[Value]) -> Optional[Union[int, float]]:
    """
    Extracts a numeric value from a literal Value.

    Preserves the distinction between integers and floats.

    Args:
        value: A Value dictionary that may contain a literal number.

    Returns:
        The numeric value (int or float) if the Value is a literal number,
        None otherwise.

    Example:
        >>> val = {'type': 'literal', 'value': 42, 'raw': '42'}
        >>> literal_number(val)
        42

        >>> val = {'type': 'literal', 'value': 3.14, 'raw': '3.14'}
        >>> literal_number(val)
        3.14

        >>> val = {'type': 'literal', 'value': 'hello', 'raw': '"hello"'}
        >>> literal_number(val)
        None
    """
    if value and value.get("type") == "literal":
        v = value.get("value")
        # Check for bool first since bool is a subclass of int in Python
        if isinstance(v, bool):
            return None
        if isinstance(v, (int, float)):
            return v
    return None


def literal_int(value: Optional[Value]) -> Optional[int]:
    """
    Extracts an integer value from a literal Value.

    Args:
        value: A Value dictionary that may contain a literal integer.

    Returns:
        The integer value if the Value is a literal integer, None otherwise.

    Example:
        >>> val = {'type': 'literal', 'value': 42, 'raw': '42'}
        >>> literal_int(val)
        42

        >>> val = {'type': 'literal', 'value': 3.14, 'raw': '3.14'}
        >>> literal_int(val)
        None
    """
    if value and value.get("type") == "literal":
        v = value.get("value")
        # Check for bool first since bool is a subclass of int in Python
        if isinstance(v, bool):
            return None
        if isinstance(v, int):
            return v
    return None


def literal_float(value: Optional[Value]) -> Optional[float]:
    """
    Extracts a float value from a literal Value.

    Note: This only returns floats, not integers. Use literal_number
    if you want both int and float.

    Args:
        value: A Value dictionary that may contain a literal float.

    Returns:
        The float value if the Value is a literal float, None otherwise.

    Example:
        >>> val = {'type': 'literal', 'value': 3.14, 'raw': '3.14'}
        >>> literal_float(val)
        3.14

        >>> val = {'type': 'literal', 'value': 42, 'raw': '42'}
        >>> literal_float(val)
        None
    """
    if value and value.get("type") == "literal":
        v = value.get("value")
        if isinstance(v, float) and not isinstance(v, bool):
            return v
    return None
