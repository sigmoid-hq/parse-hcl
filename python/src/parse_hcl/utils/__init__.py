# Utility subpackage for the parse-hcl Python port.
#
# This module provides convenient access to all utility functions.
# You can import directly from submodules for more specific imports.

from .common import (
    IGNORED_DIRS,
    ParseError,
    SourceLocation,
    SourceRange,
    debug,
    info,
    is_directory,
    list_terraform_files,
    literal_boolean,
    literal_number,
    literal_string,
    offset_to_location,
    offsets_to_range,
    path_exists,
    read_json_file,
    read_text_file,
    warn,
)
from .graph import GRAPH_VERSION, build_dependency_graph, create_export
from .lexer import (
    KNOWN_BLOCKS,
    BlockScanner,
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
from .parser import classify_value, parse_block_body
from .serialization import to_export, to_json, to_json_export, to_yaml, to_yaml_document

__all__ = [
    # common
    "IGNORED_DIRS",
    "ParseError",
    "SourceLocation",
    "SourceRange",
    "debug",
    "info",
    "is_directory",
    "list_terraform_files",
    "literal_boolean",
    "literal_number",
    "literal_string",
    "offset_to_location",
    "offsets_to_range",
    "path_exists",
    "read_json_file",
    "read_text_file",
    "warn",
    # graph
    "GRAPH_VERSION",
    "build_dependency_graph",
    "create_export",
    # lexer
    "KNOWN_BLOCKS",
    "BlockScanner",
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
    # parser
    "classify_value",
    "parse_block_body",
    # serialization
    "to_export",
    "to_json",
    "to_json_export",
    "to_yaml",
    "to_yaml_document",
]
