"""
Main Terraform parser for HCL configuration files.

Parses .tf and .tf.json files into structured TerraformDocument objects.
"""

from __future__ import annotations

from typing import List

from ..parsers.generic_parser import (
    DataParser,
    GenericBlockParser,
    ModuleParser,
    ProviderParser,
    ResourceParser,
    TerraformSettingsParser,
)
from ..parsers.locals_parser import LocalsParser
from ..parsers.output_parser import OutputParser
from ..parsers.variable_parser import VariableParser
from ..types import DirectoryParseResult, FileParseResult, TerraformDocument, create_empty_document
from ..utils.common.fs import is_directory, list_terraform_files, path_exists, read_text_file
from ..utils.common.logger import info
from ..utils.lexer.block_scanner import BlockScanner
from .terraform_json_parser import TerraformJsonParser


class TerraformParser:
    """
    Parser for Terraform configuration files (.tf, .tf.json).

    Provides methods for parsing single files and directories of Terraform
    configurations into structured TerraformDocument objects.

    Example:
        >>> parser = TerraformParser()
        >>>
        >>> # Parse a single file
        >>> doc = parser.parse_file('main.tf')
        >>>
        >>> # Parse a directory
        >>> result = parser.parse_directory('./terraform')
        >>>
        >>> # Access parsed resources
        >>> for resource in doc['resource']:
        ...     print(f"{resource['type']}.{resource['name']}")
    """

    def __init__(self) -> None:
        """Initializes the TerraformParser with all required sub-parsers."""
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
        """
        Parses a single Terraform configuration file.

        Supports both HCL (.tf) and JSON (.tf.json) formats.

        Args:
            file_path: Path to the Terraform configuration file.

        Returns:
            A TerraformDocument containing all parsed blocks.

        Raises:
            FileNotFoundError: If the file does not exist.
            ParseError: If the file contains invalid HCL syntax.

        Example:
            >>> parser = TerraformParser()
            >>> doc = parser.parse_file('main.tf')
            >>> print(len(doc['resource']))
            5
        """
        if file_path.endswith(".tf.json"):
            info(f"Parsing Terraform JSON file: {file_path}")
            return self.json_parser.parse_file(file_path)

        info(f"Parsing Terraform file: {file_path}")
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
        """
        Parses all Terraform configuration files in a directory.

        Recursively finds and parses all .tf and .tf.json files in the directory,
        excluding common non-Terraform directories (.terraform, .git, node_modules).

        Args:
            dir_path: Path to the directory to parse.
            aggregate: Whether to combine all files into a single document (default: True).
            include_per_file: Whether to include per-file results (default: True).

        Returns:
            A DirectoryParseResult containing:
            - combined: The aggregated TerraformDocument (if aggregate is True)
            - files: List of per-file parse results (if include_per_file is True)

        Raises:
            ValueError: If the directory path is invalid.

        Example:
            >>> parser = TerraformParser()
            >>> result = parser.parse_directory('./terraform')
            >>> print(len(result['combined']['resource']))
            10
            >>> print(len(result['files']))
            3
        """
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
        """
        Combines multiple TerraformDocument objects into a single document.

        Merges all blocks from each document into a single unified document.

        Args:
            documents: List of TerraformDocument objects to combine.

        Returns:
            A single TerraformDocument containing all blocks from all documents.

        Example:
            >>> parser = TerraformParser()
            >>> doc1 = parser.parse_file('main.tf')
            >>> doc2 = parser.parse_file('variables.tf')
            >>> combined = parser.combine([doc1, doc2])
        """
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
