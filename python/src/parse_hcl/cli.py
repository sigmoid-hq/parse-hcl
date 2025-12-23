from __future__ import annotations

import sys
from pathlib import Path
from typing import Any, Dict

from .services.artifact_parsers import TfPlanParser, TfStateParser, TfVarsParser
from .services.terraform_parser import TerraformParser
from .utils.serialization.serializer import to_export, to_json, to_json_export, to_yaml_document


def _usage() -> str:
    return "Usage: parse-hcl --file <path> | --dir <path> [--format json|yaml] [--graph] [--no-prune]"


def parse_args(argv: list[str]) -> Dict[str, Any]:
    opts: Dict[str, Any] = {"format": "json", "graph": False, "prune": True}
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
            emit(_tfvars_parse(file_path), opts)
            return
        if suffix == ".tfstate":
            emit(TfStateParser().parse_file(str(file_path)), opts)
            return
        if suffix == ".json" and file_str.endswith("plan.json"):
            emit(TfPlanParser().parse_file(str(file_path)), opts)
            return

        doc = parser.parse_file(str(file_path))
        emit(doc, opts)
        return

    if opts.get("dir"):
        dir_path = Path(opts["dir"]).resolve()
        result = parser.parse_directory(str(dir_path))
        combined = result.get("combined") or parser.combine([item["document"] for item in result.get("files", [])])
        emit(to_export(combined, prune_empty=opts["prune"]) if opts.get("graph") else result, opts)


def _tfvars_parse(file_path: Path) -> Any:
    return TfVarsParser().parse_file(str(file_path))


def emit(data: Any, opts: Dict[str, Any]) -> None:
    if opts.get("graph") and not _is_terraform_doc(data):
        print("Graph export requested but input is not a Terraform document; emitting raw output.", file=sys.stderr)

    if opts.get("format") == "yaml":
        print(to_yaml_document(data, prune_empty=opts.get("prune", True)))
        return

    if opts.get("graph") and _is_terraform_doc(data):
        print(to_json_export(data, prune_empty=opts.get("prune", True)))
        return

    print(to_json(data, prune_empty=opts.get("prune", True)))


def _is_terraform_doc(data: Any) -> bool:
    return isinstance(data, dict) and "resource" in data


if __name__ == "__main__":
    main()
