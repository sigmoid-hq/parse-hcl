"""
Parser for HCL block body content.

Extracts attributes and nested blocks from block body strings.
"""

from __future__ import annotations

from typing import Dict, List

from ...types import NestedBlock, ParsedBody, Value
from ..lexer.hcl_lexer import (
    find_matching_brace,
    is_quote,
    read_dotted_identifier,
    read_quoted_string,
    read_value,
    skip_whitespace_and_comments,
)
from .value_classifier import classify_value


def parse_block_body(body: str) -> ParsedBody:
    """
    Parses an HCL block body into attributes and nested blocks.

    Extracts all attribute assignments (key = value) and nested blocks
    (identifier "label" { ... }) from the body content.

    Args:
        body: The raw body content of an HCL block (without outer braces).

    Returns:
        ParsedBody containing:
        - attributes: Dict of attribute name to classified Value
        - blocks: List of NestedBlock structures

    Example:
        >>> body = 'name = "test"\\ncount = 5\\ninner { foo = "bar" }'
        >>> result = parse_block_body(body)
        >>> result["attributes"]["name"]
        {'type': 'literal', 'value': 'test', 'raw': '"test"'}
    """
    attributes: Dict[str, Value] = {}
    blocks: List[NestedBlock] = []

    index = 0
    length = len(body)

    while index < length:
        index = skip_whitespace_and_comments(body, index)
        if index >= length:
            break

        identifier_start = index
        identifier = read_dotted_identifier(body, index)
        if not identifier:
            index += 1
            continue

        index += len(identifier)
        index = skip_whitespace_and_comments(body, index)

        # Check for attribute assignment (identifier = value)
        if index < length and body[index] == "=":
            raw, end = read_value(body, index + 1)
            attributes[identifier] = classify_value(raw)
            index = end
            continue

        # Collect labels for nested block
        labels: List[str] = []
        while index < length and is_quote(body[index]):
            text, end = read_quoted_string(body, index)
            labels.append(text)
            index = skip_whitespace_and_comments(body, end)

        # Check for nested block (identifier "label"* { ... })
        if index < length and body[index] == "{":
            close_index = find_matching_brace(body, index)

            # Handle unclosed brace - use remaining content
            if close_index == -1:
                inner_body = body[index + 1 :]
                raw_block = body[identifier_start:]
                close_index = length - 1  # Set to end for index advancement
            else:
                inner_body = body[index + 1 : close_index]
                raw_block = body[identifier_start : close_index + 1]

            parsed = parse_block_body(inner_body)

            blocks.append(
                {
                    "type": identifier,
                    "labels": labels,
                    "attributes": parsed["attributes"],
                    "blocks": parsed["blocks"],
                    "raw": raw_block,
                }
            )

            index = close_index + 1
            continue

        index += 1

    return {"attributes": attributes, "blocks": blocks}
