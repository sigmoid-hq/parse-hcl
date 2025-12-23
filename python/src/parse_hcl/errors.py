from __future__ import annotations

from dataclasses import dataclass


@dataclass
class SourceLocation:
    line: int
    column: int
    offset: int


@dataclass
class SourceRange:
    start: SourceLocation
    end: SourceLocation


class ParseError(Exception):
    def __init__(self, message: str, source: str, location: SourceLocation, end_location: SourceLocation | None = None):
        location_str = f"{source}:{location.line}:{location.column}"
        super().__init__(f"{message} at {location_str}")
        self.source = source
        self.location = location
        self.end_location = end_location


def offset_to_location(content: str, offset: int) -> SourceLocation:
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
    return SourceRange(start=offset_to_location(content, start_offset), end=offset_to_location(content, end_offset))
