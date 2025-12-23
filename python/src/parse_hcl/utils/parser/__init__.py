# Parsing helpers for HCL values and bodies.
from .body_parser import parse_block_body
from .value_classifier import classify_value

__all__ = [
    "classify_value",
    "parse_block_body",
]
