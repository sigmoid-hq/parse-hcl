from __future__ import annotations

import json
import os
from pathlib import Path
from typing import List, TypeVar

IGNORED_DIRS = {".terraform", ".git", "node_modules", "__pycache__"}
T = TypeVar("T")


def read_text_file(file_path: str) -> str:
    return Path(file_path).read_text(encoding="utf-8")


def read_json_file(file_path: str) -> T:
    return json.loads(read_text_file(file_path))  # type: ignore[return-value]


def list_terraform_files(dir_path: str) -> List[str]:
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
    return Path(target_path).exists()


def is_directory(target_path: str) -> bool:
    path = Path(target_path)
    return path.exists() and path.is_dir()
