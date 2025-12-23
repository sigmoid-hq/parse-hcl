"""
Error handling utilities for HCL parsing.

Provides error types with source location information for debugging.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional


@dataclass
class SourceLocation:
    """
    Represents a location in source code.

    Attributes:
        line: 1-based line number.
        column: 1-based column number.
        offset: 0-based character offset from start of content.
    """

    line: int
    column: int
    offset: int


@dataclass
class SourceRange:
    """
    Represents a range in source code from start to end positions.

    Attributes:
        start: The starting SourceLocation.
        end: The ending SourceLocation.
    """

    start: SourceLocation
    end: SourceLocation


class ParseError(Exception):
    """
    Error raised when HCL parsing fails.

    Contains location information for debugging and error reporting.

    Attributes:
        source: The source file path where the error occurred.
        location: The location in the source where the error occurred.
        end_location: Optional end location for range-based errors.

    Example:
        >>> loc = SourceLocation(line=10, column=5, offset=100)
        >>> raise ParseError("Unexpected token", "main.tf", loc)
        ParseError: Unexpected token at main.tf:10:5
    """

    def __init__(
        self,
        message: str,
        source: str,
        location: SourceLocation,
        end_location: Optional[SourceLocation] = None,
    ):
        """
        Creates a new ParseError.

        Args:
            message: The error message.
            source: The source file path.
            location: The location where the error occurred.
            end_location: Optional end location for range-based errors.
        """
        location_str = f"{source}:{location.line}:{location.column}"
        super().__init__(f"{message} at {location_str}")
        self.source = source
        self.location = location
        self.end_location = end_location


def offset_to_location(content: str, offset: int) -> SourceLocation:
    """
    Calculates line and column numbers from a character offset.

    Args:
        content: The full source content.
        offset: The 0-based character offset.

    Returns:
        SourceLocation with line, column, and offset.

    Example:
        >>> content = "line1\\nline2\\nline3"
        >>> offset_to_location(content, 7)
        SourceLocation(line=2, column=2, offset=7)
    """
    safe_offset = min(offset, len(content))
    line = 1
    column = 1

    for i in range(safe_offset):
        if content[i] == "\n":
            line += 1
            column = 1
        else:
            column += 1

    return SourceLocation(line=line, column=column, offset=safe_offset)


def offsets_to_range(content: str, start_offset: int, end_offset: int) -> SourceRange:
    """
    Creates a SourceRange from start and end offsets.

    Args:
        content: The full source content.
        start_offset: The 0-based start offset.
        end_offset: The 0-based end offset.

    Returns:
        SourceRange spanning from start to end.

    Example:
        >>> content = "variable \\"name\\" {}"
        >>> offsets_to_range(content, 0, 8)
        SourceRange(start=..., end=...)
    """
    return SourceRange(
        start=offset_to_location(content, start_offset),
        end=offset_to_location(content, end_offset),
    )
