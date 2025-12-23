from __future__ import annotations

from typing import List

from ..common.errors import ParseError, offset_to_location
from ..common.logger import warn
from ...types import BlockKind, HclBlock
from .hcl_lexer import find_matching_brace, is_quote, read_identifier, read_quoted_string, skip_string, skip_whitespace_and_comments

KNOWN_BLOCKS = {
    "terraform",
    "locals",
    "provider",
    "variable",
    "output",
    "module",
    "resource",
    "data",
    "moved",
    "import",
    "check",
    "terraform_data",
}


class BlockScanner:
    def scan(self, content: str, source: str, strict: bool = False) -> List[HclBlock]:
        blocks: List[HclBlock] = []
        length = len(content)
        index = 0

        while index < length:
            index = skip_whitespace_and_comments(content, index)

            if index >= length:
                break

            if is_quote(content[index]):
                index = skip_string(content, index)
                continue

            identifier_start = index
            keyword = read_identifier(content, index)

            if not keyword:
                index += 1
                continue

            index += len(keyword)
            index = skip_whitespace_and_comments(content, index)

            labels: List[str] = []
            while index < length and is_quote(content[index]):
                text, end = read_quoted_string(content, index)
                labels.append(text)
                index = skip_whitespace_and_comments(content, end)

            if index >= length or content[index] != "{":
                index = identifier_start + len(keyword)
                continue
            brace_index = index
            end_index = find_matching_brace(content, brace_index)

            if end_index == -1:
                location = offset_to_location(content, brace_index)
                message = f"Unclosed block '{keyword}': missing closing '}}'"
                if strict:
                    raise ParseError(message, source, location)
                warn(f"{message} in {source}:{location.line}:{location.column}")
                break

            raw = _normalize_raw(content[identifier_start : end_index + 1])
            body = content[brace_index + 1 : end_index]
            kind: BlockKind = keyword if keyword in KNOWN_BLOCKS else "unknown"  # type: ignore[assignment]

            blocks.append(
                {
                    "kind": kind,
                    "keyword": keyword,
                    "labels": labels,
                    "body": body.strip(),
                    "raw": raw,
                    "source": source,
                }
            )

            index = end_index + 1

        return blocks


def _normalize_raw(raw: str) -> str:
    trimmed = raw.strip()
    lines = trimmed.splitlines()

    if len(lines) == 1:
        return lines[0]

    indents = [
        len(line[: len(line) - len(line.lstrip())])
        for line in lines[1:]
        if line.strip()
    ]
    min_indent = min(indents) if indents else 0

    def normalize_alignment(line: str) -> str:
        import re

        line = re.sub(r"\s{2,}=\s*", " = ", line)
        line = re.sub(r"\s*=\s{2,}", " = ", line)
        return line.rstrip()

    normalized_lines = []
    for idx, line in enumerate(lines):
        without_indent = line.lstrip() if idx == 0 else line[min(min_indent, len(line)) :]
        normalized_lines.append(normalize_alignment(without_indent))

    return "\n".join(normalized_lines)
