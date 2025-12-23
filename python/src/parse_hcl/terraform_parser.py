from __future__ import annotations

from typing import Dict, List, Optional

from .block_scanner import BlockScanner
from .fs_utils import is_directory, list_terraform_files, path_exists, read_text_file
from .generic_parsers import (
    DataParser,
    GenericBlockParser,
    ModuleParser,
    ProviderParser,
    ResourceParser,
    TerraformSettingsParser,
)
from .locals_parser import LocalsParser
from .output_parser import OutputParser
from .terraform_json_parser import TerraformJsonParser
from .types import DirectoryParseResult, FileParseResult, TerraformDocument, create_empty_document
from .variable_parser import VariableParser


class TerraformParser:
    def __init__(self) -> None:
        self.scanner = BlockScanner()
        self.variable_parser = VariableParser()
        self.output_parser = OutputParser()
        self.locals_parser = LocalsParser()
        self.module_parser = ModuleParser()
        self.provider_parser = ProviderParser()
        self.resource_parser = ResourceParser()
        self.data_parser = DataParser()
        self.terraform_settings_parser = TerraformSettingsParser()
        self.generic_block_parser = GenericBlockParser()
        self.json_parser = TerraformJsonParser()

    def parse_file(self, file_path: str) -> TerraformDocument:
        if file_path.endswith(".tf.json"):
            return self.json_parser.parse_file(file_path)

        content = read_text_file(file_path)
        blocks = self.scanner.scan(content, file_path)
        document = create_empty_document()

        for block in blocks:
            kind = block["kind"]
            if kind == "variable":
                document["variable"].append(self.variable_parser.parse(block))
            elif kind == "output":
                document["output"].append(self.output_parser.parse(block))
            elif kind == "locals":
                document["locals"].extend(self.locals_parser.parse(block))
            elif kind == "module":
                document["module"].append(self.module_parser.parse(block))
            elif kind == "provider":
                document["provider"].append(self.provider_parser.parse(block))
            elif kind == "resource":
                document["resource"].append(self.resource_parser.parse(block))
            elif kind == "data":
                document["data"].append(self.data_parser.parse(block))
            elif kind == "terraform":
                document["terraform"].append(self.terraform_settings_parser.parse(block))
            elif kind == "moved":
                document["moved"].append(self.generic_block_parser.parse(block))
            elif kind == "import":
                document["import"].append(self.generic_block_parser.parse(block))
            elif kind == "check":
                document["check"].append(self.generic_block_parser.parse(block))
            elif kind == "terraform_data":
                document["terraform_data"].append(self.generic_block_parser.parse(block))
            else:
                document["unknown"].append(self.generic_block_parser.parse(block))

        return document

    def parse_directory(self, dir_path: str, aggregate: bool = True, include_per_file: bool = True) -> DirectoryParseResult:
        if not path_exists(dir_path) or not is_directory(dir_path):
            raise ValueError(f"Invalid directory path: {dir_path}")

        files = list_terraform_files(dir_path)
        parsed_files: List[FileParseResult] = [{"path": file_path, "document": self.parse_file(file_path)} for file_path in files]

        combined = self.combine([item["document"] for item in parsed_files]) if aggregate else None
        result: DirectoryParseResult = {"files": parsed_files if include_per_file else []}
        if combined is not None:
            result["combined"] = combined
        return result

    def combine(self, documents: List[TerraformDocument]) -> TerraformDocument:
        combined = create_empty_document()
        for doc in documents:
            combined["terraform"].extend(doc.get("terraform", []))
            combined["provider"].extend(doc.get("provider", []))
            combined["variable"].extend(doc.get("variable", []))
            combined["output"].extend(doc.get("output", []))
            combined["module"].extend(doc.get("module", []))
            combined["resource"].extend(doc.get("resource", []))
            combined["data"].extend(doc.get("data", []))
            combined["locals"].extend(doc.get("locals", []))
            combined["moved"].extend(doc.get("moved", []))
            combined["import"].extend(doc.get("import", []))
            combined["check"].extend(doc.get("check", []))
            combined["terraform_data"].extend(doc.get("terraform_data", []))
            combined["unknown"].extend(doc.get("unknown", []))
        return combined
