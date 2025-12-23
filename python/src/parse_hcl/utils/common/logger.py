"""
Logging utilities for HCL parsing.

Provides simple logging functions with level-based filtering controlled
by the TF_PARSER_DEBUG environment variable.
"""

from __future__ import annotations

import os
import sys


def _enabled(level: str) -> bool:
    """
    Checks if a given log level is enabled.

    Args:
        level: The log level to check ('debug', 'info', 'warn').

    Returns:
        True if the level is enabled. Debug is disabled by default
        unless TF_PARSER_DEBUG environment variable is set.
    """
    env = os.environ.get("TF_PARSER_DEBUG")
    if not env:
        return level != "debug"
    return True


def debug(*args: object) -> None:
    """
    Logs a debug message to stderr.

    Debug messages are only shown when TF_PARSER_DEBUG is set.

    Args:
        *args: Values to print, space-separated.

    Example:
        >>> debug("Parsing block", block_name)
        [parser:debug] Parsing block my_resource
    """
    if _enabled("debug"):
        print("[parser:debug]", *args, file=sys.stderr)


def info(*args: object) -> None:
    """
    Logs an info message to stdout.

    Args:
        *args: Values to print, space-separated.

    Example:
        >>> info("Processed", count, "files")
        [parser:info] Processed 5 files
    """
    if _enabled("info"):
        print("[parser:info]", *args)


def warn(*args: object) -> None:
    """
    Logs a warning message to stderr.

    Args:
        *args: Values to print, space-separated.

    Example:
        >>> warn("Unclosed block at line", line_num)
        [parser:warn] Unclosed block at line 42
    """
    if _enabled("warn"):
        print("[parser:warn]", *args, file=sys.stderr)
