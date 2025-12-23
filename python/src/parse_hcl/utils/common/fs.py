"""
File system utilities for Terraform configuration parsing.

Provides functions for reading files and discovering Terraform configuration
files in directories.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, List, TypeVar

IGNORED_DIRS = {".terraform", ".git", "node_modules", "__pycache__"}
"""Directories to skip when scanning for Terraform files."""

T = TypeVar("T")


def read_text_file(file_path: str) -> str:
    """
    Reads a text file and returns its contents as a string.

    Args:
        file_path: Path to the file to read.

    Returns:
        The file contents as a UTF-8 string.

    Raises:
        FileNotFoundError: If the file does not exist.
        IOError: If the file cannot be read.

    Example:
        >>> content = read_text_file("main.tf")
        >>> print(content[:50])
        'resource "aws_instance" "example" {...'
    """
    return Path(file_path).read_text(encoding="utf-8")


def read_json_file(file_path: str) -> Any:
    """
    Reads a JSON file and returns its parsed contents.

    Args:
        file_path: Path to the JSON file to read.

    Returns:
        The parsed JSON data.

    Raises:
        FileNotFoundError: If the file does not exist.
        json.JSONDecodeError: If the file is not valid JSON.

    Example:
        >>> data = read_json_file("terraform.tfstate")
        >>> print(data.get("version"))
        4
    """
    return json.loads(read_text_file(file_path))


def list_terraform_files(dir_path: str) -> List[str]:
    """
    Recursively finds all Terraform files in a directory.

    Scans the directory tree for files ending in .tf or .tf.json,
    skipping common non-Terraform directories like .terraform, .git,
    node_modules, and __pycache__.

    Args:
        dir_path: Path to the directory to scan.

    Returns:
        Sorted list of absolute paths to Terraform files.

    Example:
        >>> files = list_terraform_files("./infrastructure")
        >>> print(files)
        ['./infrastructure/main.tf', './infrastructure/variables.tf']
    """
    files: List[str] = []
    stack = [Path(dir_path)]

    while stack:
        current = stack.pop()
        if not current.exists():
            continue

        for entry in current.iterdir():
            if entry.is_dir():
                if entry.name in IGNORED_DIRS:
                    continue
                stack.append(entry)
                continue

            if entry.is_file() and (entry.name.endswith(".tf") or entry.name.endswith(".tf.json")):
                files.append(str(entry))

    return sorted(files)


def path_exists(target_path: str) -> bool:
    """
    Checks if a path exists on the filesystem.

    Args:
        target_path: Path to check.

    Returns:
        True if the path exists, False otherwise.

    Example:
        >>> path_exists("main.tf")
        True
        >>> path_exists("nonexistent.tf")
        False
    """
    return Path(target_path).exists()


def is_directory(target_path: str) -> bool:
    """
    Checks if a path is an existing directory.

    Args:
        target_path: Path to check.

    Returns:
        True if the path exists and is a directory, False otherwise.

    Example:
        >>> is_directory("./modules")
        True
        >>> is_directory("main.tf")
        False
    """
    path = Path(target_path)
    return path.exists() and path.is_dir()
