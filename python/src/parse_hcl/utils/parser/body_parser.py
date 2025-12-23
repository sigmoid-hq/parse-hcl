from __future__ import annotations

from typing import Dict, List, Tuple

from ..lexer.hcl_lexer import (
    find_matching_brace,
    is_quote,
    read_dotted_identifier,
    read_quoted_string,
    read_value,
    skip_whitespace_and_comments,
)
from ...types import NestedBlock, Value
from .value_classifier import classify_value


def parse_block_body(body: str) -> Dict[str, object]:
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

        if index < length and body[index] == "=":
            raw, end = read_value(body, index + 1)
            attributes[identifier] = classify_value(raw)
            index = end
            continue

        labels: List[str] = []
        while index < length and is_quote(body[index]):
            text, end = read_quoted_string(body, index)
            labels.append(text)
            index = skip_whitespace_and_comments(body, end)

        if index < length and body[index] == "{":
            close_index = find_matching_brace(body, index)
            inner_body = body[index + 1 : close_index] if close_index != -1 else body[index + 1 :]
            parsed = parse_block_body(inner_body)
            raw_block = body[identifier_start : close_index + 1] if close_index != -1 else body[identifier_start:]

            blocks.append(
                {
                    "type": identifier,
                    "labels": labels,
                    "attributes": parsed["attributes"],  # type: ignore[index]
                    "blocks": parsed["blocks"],  # type: ignore[index]
                    "raw": raw_block,
                }
            )

            index = length if close_index == -1 else close_index + 1
            continue

        index += 1

    return {"attributes": attributes, "blocks": blocks}
