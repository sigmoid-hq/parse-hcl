from __future__ import annotations

import os
from pathlib import Path
from typing import List, Optional

from ..types import FileParseResult
from .common.value_helpers import literal_string


def annotate_output_metadata(
    *,
    dir_path: str,
    files: List[FileParseResult],
    per_file_base: Optional[Path],
    ext: str,
    cwd: Optional[Path] = None,
) -> None:
    """
    Adds relative path metadata to per-file results and module blocks.

    - Sets ``relative_path`` for each file (relative to the parsed directory).
    - Sets ``output_path``/``output_dir`` (relative to cwd) when split outputs are enabled.
    - Sets ``source_output_dir`` on module blocks that reference local directories inside the parsed tree.
    """
    root = Path(dir_path).resolve()
    current = (cwd or Path.cwd()).resolve()
    base = per_file_base.resolve() if per_file_base else None

    for file in files:
        abs_path = Path(file["path"]).resolve()
        try:
            rel_path = abs_path.relative_to(root)
        except ValueError:
            rel_path = abs_path

        file["relative_path"] = str(rel_path)

        if base:
            per_file_target = base / f"{rel_path}{ext}"
            rel_output = os.path.relpath(per_file_target, current)
            file["output_path"] = rel_output or "."
            file["output_dir"] = os.path.dirname(file["output_path"]) or "."

    if not base:
        return

    for file in files:
        file_dir = Path(file["path"]).resolve().parent
        for module in file["document"].get("module", []):
            source_val = module.get("properties", {}).get("source")
            source_raw = _raw_source(source_val)
            if source_raw is not None:
                module["source_raw"] = source_raw

            source_literal = literal_string(source_val)
            if not source_literal or not _is_local_path(source_literal):
                continue

            resolved_source = (file_dir / source_literal).resolve()
            if not resolved_source.exists() or not resolved_source.is_dir():
                continue

            try:
                rel_to_root = resolved_source.relative_to(root)
            except ValueError:
                continue

            output_dir = base / rel_to_root
            module["source_output_dir"] = os.path.relpath(output_dir, current) or "."


def _is_local_path(source: str) -> bool:
    if "://" in source or "::" in source:
        return False
    return source.startswith(".") or os.path.isabs(source)


def _raw_source(value: Any) -> Optional[str]:
    if not isinstance(value, dict):
        return None

    if value.get("type") == "literal" and isinstance(value.get("value"), str):
        return value["value"]

    raw_val = value.get("raw")
    if isinstance(raw_val, str):
        return raw_val

    return None
