"""
HCL lexer utilities for tokenizing HCL source code.

Provides low-level lexical analysis functions for parsing HCL syntax including
string handling, comment skipping, brace matching, and value extraction.
"""

from __future__ import annotations

import re
from typing import List, Tuple

QuotedStringResult = Tuple[str, int]
"""Result of reading a quoted string: (value, end_position)."""

ValueReadResult = Tuple[str, int]
"""Result of reading a value: (raw_value, end_position)."""


def is_quote(char: str | None) -> bool:
    """
    Checks if a character is a quote character.

    Args:
        char: The character to check.

    Returns:
        True if the character is a single or double quote.

    Example:
        >>> is_quote('"')
        True
        >>> is_quote("'")
        True
        >>> is_quote('a')
        False
    """
    return char in ('"', "'")


def is_escaped(text: str, index: int) -> bool:
    """
    Checks if a character at the given index is escaped by backslashes.

    Counts consecutive backslashes before the position to determine
    if the character is escaped (odd number of backslashes).

    Args:
        text: The source text.
        index: The position to check.

    Returns:
        True if the character is escaped.

    Example:
        >>> is_escaped('hello\\\\"world', 7)  # The quote after backslashes
        True
        >>> is_escaped('hello"world', 5)
        False
    """
    backslash_count = 0
    pos = index - 1
    while pos >= 0 and text[pos] == "\\":
        backslash_count += 1
        pos -= 1
    return backslash_count % 2 == 1


def skip_whitespace_and_comments(text: str, start: int) -> int:
    """
    Skips whitespace and comments, returning the next significant position.

    Handles:
    - Whitespace characters
    - Block comments (/* ... */)
    - Line comments (// ... and # ...)

    Args:
        text: The source text.
        start: Starting position.

    Returns:
        Position of the next non-whitespace, non-comment character.

    Example:
        >>> text = "  // comment\\nvalue"
        >>> skip_whitespace_and_comments(text, 0)
        14  # Position of 'value'
    """
    index = start
    length = len(text)

    while index < length:
        char = text[index]
        next_char = text[index + 1] if index + 1 < length else ""

        if char.isspace():
            index += 1
            continue

        if char == "/" and next_char == "*":
            end = text.find("*/", index + 2)
            index = length if end == -1 else end + 2
            continue

        if char == "/" and next_char == "/":
            end = text.find("\n", index + 2)
            index = length if end == -1 else end + 1
            continue

        if char == "#":
            end = text.find("\n", index + 1)
            index = length if end == -1 else end + 1
            continue

        break

    return index


def skip_string(text: str, start: int) -> int:
    """
    Skips over a quoted string, handling escape sequences.

    Args:
        text: The source text.
        start: Position of the opening quote.

    Returns:
        Position after the closing quote.

    Example:
        >>> skip_string('"hello world"more', 0)
        13  # Position after closing quote
    """
    quote = text[start]
    index = start + 1
    length = len(text)

    while index < length:
        char = text[index]
        if char == quote and not is_escaped(text, index):
            return index + 1
        index += 1

    return length


def skip_heredoc(text: str, start: int) -> int:
    """
    Skips over a heredoc string.

    Heredocs start with << or <<- followed by a marker, and end with
    the marker on its own line.

    Args:
        text: The source text.
        start: Position of the << characters.

    Returns:
        Position after the heredoc terminator.

    Example:
        >>> text = '<<EOF\\nline1\\nline2\\nEOF\\n'
        >>> skip_heredoc(text, 0)
        21
    """
    match = re.match(r'^<<-?\s*"?([A-Za-z0-9_]+)"?', text[start:])
    if not match:
        return start + 2

    marker = match.group(1)
    after_marker = start + len(match.group(0))
    terminator_index = text.find(f"\n{marker}", after_marker)

    if terminator_index == -1:
        return len(text)

    end_of_terminator = text.find("\n", terminator_index + len(marker) + 1)
    return len(text) if end_of_terminator == -1 else end_of_terminator + 1


def find_matching_brace(content: str, start_index: int) -> int:
    """
    Finds the matching closing brace for an opening brace.

    Properly handles nested braces, strings, comments, and heredocs.

    Args:
        content: The source content.
        start_index: Position of the opening brace '{'.

    Returns:
        Position of the matching closing brace, or -1 if not found.

    Example:
        >>> find_matching_brace('{ nested { } }', 0)
        13
    """
    depth = 0
    index = start_index
    length = len(content)

    while index < length:
        char = content[index]
        next_char = content[index + 1] if index + 1 < length else ""

        if is_quote(char):
            index = skip_string(content, index)
            continue

        if char == "/" and next_char == "*":
            end = content.find("*/", index + 2)
            index = length if end == -1 else end + 2
            continue

        if char == "/" and next_char == "/":
            end = content.find("\n", index + 2)
            index = length if end == -1 else end + 1
            continue

        if char == "#":
            end = content.find("\n", index + 1)
            index = length if end == -1 else end + 1
            continue

        if char == "<" and next_char == "<":
            index = skip_heredoc(content, index)
            continue

        if char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                return index

        index += 1

    return -1


def find_matching_bracket(content: str, start_index: int, open_char: str, close_char: str) -> int:
    """
    Finds the matching closing bracket for any bracket type.

    Similar to find_matching_brace but works with any bracket pair.

    Args:
        content: The source content.
        start_index: Position of the opening bracket.
        open_char: The opening bracket character (e.g., '[', '(').
        close_char: The closing bracket character (e.g., ']', ')').

    Returns:
        Position of the matching closing bracket, or -1 if not found.

    Example:
        >>> find_matching_bracket('[a, [b, c], d]', 0, '[', ']')
        13
    """
    depth = 0
    index = start_index
    length = len(content)

    while index < length:
        char = content[index]
        next_char = content[index + 1] if index + 1 < length else ""

        if is_quote(char):
            index = skip_string(content, index)
            continue

        if char == "/" and next_char == "*":
            end = content.find("*/", index + 2)
            index = length if end == -1 else end + 2
            continue

        if char == "/" and next_char == "/":
            end = content.find("\n", index + 2)
            index = length if end == -1 else end + 1
            continue

        if char == "#":
            end = content.find("\n", index + 1)
            index = length if end == -1 else end + 1
            continue

        if char == open_char:
            depth += 1
        elif char == close_char:
            depth -= 1
            if depth == 0:
                return index

        index += 1

    return -1


def read_identifier(text: str, start: int) -> str:
    """
    Reads an HCL identifier from the given position.

    Identifiers start with a letter or underscore, followed by
    letters, digits, underscores, or hyphens.

    Args:
        text: The source text.
        start: Starting position.

    Returns:
        The identifier string, or empty string if no valid identifier.

    Example:
        >>> read_identifier("my_resource more", 0)
        'my_resource'
        >>> read_identifier("123invalid", 0)
        ''
    """
    match = re.match(r"^[A-Za-z_][\w-]*", text[start:])
    return match.group(0) if match else ""


def read_dotted_identifier(text: str, start: int) -> str:
    """
    Reads a dotted identifier (e.g., module.name.attribute).

    Args:
        text: The source text.
        start: Starting position.

    Returns:
        The dotted identifier string.

    Example:
        >>> read_dotted_identifier("aws_instance.main.id = ", 0)
        'aws_instance.main.id'
    """
    match = re.match(r"^[\w.-]+", text[start:])
    return match.group(0) if match else ""


def read_quoted_string(text: str, start: int) -> QuotedStringResult:
    """
    Reads a quoted string and returns its unescaped value.

    Handles escape sequences: \\\\, \\", \\n, \\t, \\r.

    Args:
        text: The source text.
        start: Position of the opening quote.

    Returns:
        Tuple of (unescaped value, position after closing quote).

    Example:
        >>> read_quoted_string('"hello\\\\nworld" rest', 0)
        ('hello\\nworld', 15)
    """
    quote = text[start]
    index = start + 1
    value = []
    length = len(text)

    while index < length:
        char = text[index]

        if char == quote and not is_escaped(text, index):
            return ("".join(value), index + 1)

        if char == "\\" and index + 1 < length:
            next_char = text[index + 1]
            if next_char in (quote, "\\"):
                value.append(next_char)
                index += 2
                continue
            if next_char == "n":
                value.append("\n")
                index += 2
                continue
            if next_char == "t":
                value.append("\t")
                index += 2
                continue
            if next_char == "r":
                value.append("\r")
                index += 2
                continue

        value.append(char)
        index += 1

    return ("".join(value), length)


def read_value(text: str, start: int) -> ValueReadResult:
    """
    Reads a complete HCL value expression.

    Handles strings, heredocs, nested structures (objects, arrays),
    and multi-line expressions within brackets.

    Args:
        text: The source text.
        start: Starting position.

    Returns:
        Tuple of (raw value string, end position).

    Example:
        >>> read_value('  "value"\\nnext', 0)
        ('"value"', 9)
    """
    index = skip_whitespace_and_comments(text, start)
    value_start = index
    length = len(text)

    if text.startswith("<<", index):
        newline_index = text.find("\n", index)
        first_line = text[index:] if newline_index == -1 else text[index:newline_index]
        marker_match = re.match(r"^<<-?\s*\"?([A-Za-z0-9_]+)\"?", first_line)
        if marker_match:
            marker = marker_match.group(1)
            terminator_index = text.find(f"\n{marker}", newline_index if newline_index != -1 else index)
            if terminator_index != -1:
                end_of_terminator = text.find("\n", terminator_index + len(marker) + 1)
                end_index = length if end_of_terminator == -1 else end_of_terminator
                return (text[value_start:end_index].strip(), end_index)

    depth = 0
    in_string = False
    string_char: str | None = None

    while index < length:
        char = text[index]
        next_char = text[index + 1] if index + 1 < length else ""

        if not in_string:
            if is_quote(char):
                in_string = True
                string_char = char
                index += 1
                continue

            if char == "/" and next_char == "*":
                end = text.find("*/", index + 2)
                index = length if end == -1 else end + 2
                continue

            if char == "/" and next_char == "/":
                end = text.find("\n", index + 2)
                index = length if end == -1 else end + 1
                continue

            if char == "{":
                depth += 1
            elif char == "[" or char == "(":
                depth += 1
            elif char in ("}", "]", ")"):
                depth = max(depth - 1, 0)

            if (char == "\n" or char == "\r") and depth == 0:
                break
        else:
            if char == string_char and not is_escaped(text, index):
                in_string = False
                string_char = None

        index += 1

    return (text[value_start:index].strip(), index)


def split_array_elements(raw: str) -> List[str]:
    """
    Splits an array literal into its individual elements.

    Handles nested structures and strings properly.

    Args:
        raw: The raw array string including brackets (e.g., '[a, b, c]').

    Returns:
        List of element strings.

    Example:
        >>> split_array_elements('["a", "b", "c"]')
        ['"a"', '"b"', '"c"']
        >>> split_array_elements('[{a: 1}, {b: 2}]')
        ['{a: 1}', '{b: 2}']
    """
    inner = raw[1:-1].strip()
    if not inner:
        return []

    elements: List[str] = []
    current = []
    depth = 0
    in_string = False
    string_char: str | None = None

    for i, char in enumerate(inner):
        if not in_string:
            if is_quote(char):
                in_string = True
                string_char = char
                current.append(char)
                continue

            if char in "{[(":
                depth += 1
                current.append(char)
                continue

            if char in ")]}":
                depth -= 1
                current.append(char)
                continue

            if char == "," and depth == 0:
                chunk = "".join(current).strip()
                if chunk:
                    elements.append(chunk)
                current = []
                continue

            current.append(char)
        else:
            current.append(char)
            if char == string_char and not is_escaped(inner, i):
                in_string = False
                string_char = None

    chunk = "".join(current).strip()
    if chunk:
        elements.append(chunk)

    return elements


def split_object_entries(raw: str) -> List[Tuple[str, str]]:
    """
    Splits an object literal into key-value pairs.

    Handles quoted keys, nested structures, and various separators.

    Args:
        raw: The raw object string including braces (e.g., '{a = 1}').

    Returns:
        List of (key, value) tuples.

    Example:
        >>> split_object_entries('{name = "test", count = 1}')
        [('name', '"test"'), ('count', '1')]
    """
    inner = raw[1:-1].strip()
    if not inner:
        return []

    entries: List[Tuple[str, str]] = []
    index = 0
    length = len(inner)

    while index < length:
        index = skip_whitespace_and_comments(inner, index)
        if index >= length:
            break

        if is_quote(inner[index]):
            key, index = read_quoted_string(inner, index)
        else:
            key = read_dotted_identifier(inner, index)
            index += len(key)

        if not key:
            index += 1
            continue

        index = skip_whitespace_and_comments(inner, index)
        if index < length and inner[index] in ("=", ":"):
            index += 1

        value_raw, index = _read_object_value(inner, index)
        entries.append((key, value_raw))
        index = skip_whitespace_and_comments(inner, index)
        if index < length and inner[index] == ",":
            index += 1

    return entries


def _read_object_value(text: str, start: int) -> ValueReadResult:
    """
    Reads a value within an object literal context.

    Similar to read_value but aware of object boundaries (commas, closing braces).

    Args:
        text: The source text.
        start: Starting position.

    Returns:
        Tuple of (raw value string, end position).
    """
    index = skip_whitespace_and_comments(text, start)
    value_start = index
    length = len(text)

    depth = 0
    in_string = False
    string_char: str | None = None

    while index < length:
        char = text[index]

        if not in_string:
            if is_quote(char):
                in_string = True
                string_char = char
                index += 1
                continue

            if char in "{[(":
                depth += 1
                index += 1
                continue

            if char in "}])":
                if depth == 0:
                    break
                depth -= 1
                index += 1
                continue

            if (char == "," or char == "\n") and depth == 0:
                break

            index += 1
        else:
            if char == string_char and not is_escaped(text, index):
                in_string = False
                string_char = None
            index += 1

    return (text[value_start:index].strip(), index)
