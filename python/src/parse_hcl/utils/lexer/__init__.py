# Lexer utilities for HCL scanning.
from .block_scanner import KNOWN_BLOCKS, BlockScanner
from .hcl_lexer import (
    find_matching_brace,
    find_matching_bracket,
    is_escaped,
    is_quote,
    read_dotted_identifier,
    read_identifier,
    read_quoted_string,
    read_value,
    skip_heredoc,
    skip_string,
    skip_whitespace_and_comments,
    split_array_elements,
    split_object_entries,
)

__all__ = [
    # block_scanner
    "KNOWN_BLOCKS",
    "BlockScanner",
    # hcl_lexer
    "find_matching_brace",
    "find_matching_bracket",
    "is_escaped",
    "is_quote",
    "read_dotted_identifier",
    "read_identifier",
    "read_quoted_string",
    "read_value",
    "skip_heredoc",
    "skip_string",
    "skip_whitespace_and_comments",
    "split_array_elements",
    "split_object_entries",
]
