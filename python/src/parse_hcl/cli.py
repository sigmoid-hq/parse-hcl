from __future__ import annotations

import sys
from pathlib import Path
from typing import Any, Dict, List

from .services.artifact_parsers import TfPlanParser, TfStateParser, TfVarsParser
from .services.terraform_parser import TerraformParser
from .utils.output_metadata import annotate_output_metadata
from .utils.serialization.serializer import to_json, to_json_export, to_yaml_document

DEFAULT_SINGLE_BASENAME = "parse-hcl-output"
DEFAULT_COMBINED_BASENAME = "parse-hcl-output.combined"
DEFAULT_PER_FILE_DIR = "parse-hcl-output/files"


def _usage() -> str:
    return (
        "Usage: parse-hcl --file <path> | --dir <path> [--format json|yaml] "
        "[--graph] [--no-prune] [--out <path>] [--out-dir <dir>] [--stdout]"
    )


def parse_args(argv: list[str]) -> Dict[str, Any]:
    opts: Dict[str, Any] = {"format": "json", "graph": False, "prune": True, "split": True, "stdout": False}
    i = 0
    while i < len(argv):
        arg = argv[i]
        if arg == "--file" and i + 1 < len(argv):
            opts["file"] = argv[i + 1]
            i += 2
            continue
        if arg == "--dir" and i + 1 < len(argv):
            opts["dir"] = argv[i + 1]
            i += 2
            continue
        if arg == "--format" and i + 1 < len(argv):
            fmt = argv[i + 1]
            if fmt in ("json", "yaml"):
                opts["format"] = fmt
            i += 2
            continue
        if arg == "--graph":
            opts["graph"] = True
            i += 1
            continue
        if arg == "--no-prune":
            opts["prune"] = False
            i += 1
            continue
        if arg == "--out" and i + 1 < len(argv):
            opts["out"] = argv[i + 1]
            i += 2
            continue
        if arg == "--out-dir" and i + 1 < len(argv):
            opts["out_dir"] = argv[i + 1]
            i += 2
            continue
        if arg == "--split":
            opts["split"] = True
            i += 1
            continue
        if arg == "--no-split":
            opts["split"] = False
            i += 1
            continue
        if arg == "--stdout":
            opts["stdout"] = True
            i += 1
            continue
        if arg == "--no-stdout":
            opts["stdout"] = False
            i += 1
            continue
        i += 1
    return opts


def main() -> None:
    opts = parse_args(sys.argv[1:])
    parser = TerraformParser()

    if not opts.get("file") and not opts.get("dir"):
        print(_usage(), file=sys.stderr)
        sys.exit(1)

    if opts.get("file"):
        file_path = Path(opts["file"]).resolve()
        suffix = file_path.suffix
        file_str = str(file_path)

        if "tfvars" in file_str:
            emit_single(file_path, _tfvars_parse(file_path), opts)
            return
        if suffix == ".tfstate":
            emit_single(file_path, TfStateParser().parse_file(str(file_path)), opts)
            return
        if suffix == ".json" and file_str.endswith("plan.json"):
            emit_single(file_path, TfPlanParser().parse_file(str(file_path)), opts)
            return

        doc = parser.parse_file(str(file_path))
        emit_single(file_path, doc, opts)
        return

    if opts.get("dir"):
        dir_path = Path(opts["dir"]).resolve()
        result = parser.parse_directory(str(dir_path))
        combined = result.get("combined") or parser.combine([item["document"] for item in result.get("files", [])])
        emit_directory(dir_path, result.get("files", []), combined, opts)


def _tfvars_parse(file_path: Path) -> Any:
    return TfVarsParser().parse_file(str(file_path))


def emit_single(file_path: Path, data: Any, opts: Dict[str, Any]) -> None:
    rendered = _render(data, opts)
    ext = _ext(opts["format"])
    default_name = f"{DEFAULT_SINGLE_BASENAME}{ext}"
    target_path = _resolve_out_path(opts.get("out"), default_name, opts["format"])
    _write_file(target_path, rendered)

    if opts.get("stdout"):
        print(rendered)


def emit_directory(dir_path: Path, files: List[Dict[str, Any]], combined_doc: Dict[str, Any], opts: Dict[str, Any]) -> None:
    ext = _ext(opts["format"])
    per_file_base = _resolve_per_file_base(opts) if opts.get("split") else None
    annotate_output_metadata(
        dir_path=str(dir_path),
        files=files,
        per_file_base=per_file_base,
        ext=ext,
        cwd=Path.cwd(),
    )
    combined_data = combined_doc if opts.get("graph") else {"combined": combined_doc, "files": files if opts.get("split") else []}
    combined_rendered = _render(combined_data, opts)
    combined_default = f"{DEFAULT_COMBINED_BASENAME}{ext}"
    combined_target = _resolve_out_path(opts.get("out"), combined_default, opts["format"], is_dir_mode=True)
    _write_file(combined_target, combined_rendered)

    if opts.get("split") and per_file_base:
        for file_result in files:
            rel_path = file_result.get("relative_path") or Path(file_result["path"]).resolve().relative_to(dir_path)
            per_file_target = per_file_base / Path(f"{rel_path}{ext}")
            rendered = _render(file_result["document"], opts)
            _write_file(per_file_target, rendered)

    if opts.get("stdout"):
        print(combined_rendered)


def _render(data: Any, opts: Dict[str, Any]) -> str:
    if opts.get("graph") and not _is_terraform_doc(data):
        print("Graph export requested but input is not a Terraform document; emitting raw output.", file=sys.stderr)

    if opts.get("format") == "yaml":
        return to_yaml_document(data, prune_empty=opts.get("prune", True))

    if opts.get("graph") and _is_terraform_doc(data):
        return to_json_export(data, prune_empty=opts.get("prune", True))

    return to_json(data, prune_empty=opts.get("prune", True))


def _resolve_out_path(out: str | None, default_name: str, fmt: str, is_dir_mode: bool = False) -> Path:
    default_path = Path(default_name).resolve()
    if not out:
        return default_path

    resolved = Path(out).resolve()
    if resolved.exists() and resolved.is_dir():
        name = f"{'combined' if is_dir_mode else 'output'}{_ext(fmt)}"
        return resolved / name

    if resolved.suffix == "":
        return Path(f"{resolved}{_ext(fmt)}")

    return resolved


def _resolve_per_file_base(opts: Dict[str, Any]) -> Path:
    if opts.get("out_dir"):
        return Path(opts["out_dir"]).resolve()

    if opts.get("out"):
        resolved_out = Path(opts["out"]).resolve()
        if resolved_out.exists() and resolved_out.is_dir():
            return resolved_out / "per-file"
        return resolved_out.parent / "per-file"

    return Path(DEFAULT_PER_FILE_DIR).resolve()


def _write_file(target_path: Path, contents: str) -> None:
    target_path.parent.mkdir(parents=True, exist_ok=True)
    target_path.write_text(contents, encoding="utf-8")


def _ext(fmt: str) -> str:
    return ".yaml" if fmt == "yaml" else ".json"


def _is_terraform_doc(data: Any) -> bool:
    return isinstance(data, dict) and "resource" in data


if __name__ == "__main__":
    main()
