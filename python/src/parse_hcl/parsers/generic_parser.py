"""
Generic parsers for Terraform block types.

Provides parsers for terraform settings, provider, module, resource, data,
and generic blocks.
"""

from __future__ import annotations

from typing import Dict, List

from ..types import HclBlock, Value
from ..utils.common.value_helpers import literal_string
from ..utils.parser.body_parser import parse_block_body

META_KEYS = {"count", "for_each", "provider", "depends_on", "lifecycle"}


class TerraformSettingsParser:
    """Parser for terraform settings blocks."""

    def parse(self, block: HclBlock) -> Dict[str, object]:
        """
        Parses a terraform settings block.

        Args:
            block: The raw HCL block.

        Returns:
            Parsed terraform settings with properties.
        """
        parsed = parse_block_body(block["body"])
        return {
            "properties": parsed["attributes"],
            "raw": block["raw"],
            "source": block["source"],
        }


class ProviderParser:
    """Parser for provider configuration blocks."""

    def parse(self, block: HclBlock) -> Dict[str, object]:
        """
        Parses a provider configuration block.

        Args:
            block: The raw HCL block.

        Returns:
            Parsed provider with name, alias, and properties.
        """
        labels = block.get("labels", [])
        name = labels[0] if labels else "default"
        parsed = parse_block_body(block["body"])
        alias_value = parsed["attributes"].get("alias")
        alias = literal_string(alias_value) or (alias_value.get("raw") if isinstance(alias_value, dict) else None)

        return {
            "name": name,
            "alias": alias,
            "properties": parsed["attributes"],
            "raw": block["raw"],
            "source": block["source"],
        }


class ModuleParser:
    """Parser for module call blocks."""

    def parse(self, block: HclBlock) -> Dict[str, object]:
        """
        Parses a module call block.

        Args:
            block: The raw HCL block.

        Returns:
            Parsed module with name and properties.
        """
        labels = block.get("labels", [])
        name = labels[0] if labels else "unnamed"
        parsed = parse_block_body(block["body"])
        return {
            "name": name,
            "properties": parsed["attributes"],
            "raw": block["raw"],
            "source": block["source"],
        }


class ResourceParser:
    """Parser for resource definition blocks."""

    def parse(self, block: HclBlock) -> Dict[str, object]:
        """
        Parses a resource definition block.

        Extracts resource type, name, properties, nested blocks, dynamic blocks,
        and meta-arguments.

        Args:
            block: The raw HCL block.

        Returns:
            Parsed resource with type, name, properties, blocks, and meta.
        """
        labels = block.get("labels", [])
        # Safe label extraction with fallbacks
        resource_type = labels[0] if len(labels) > 0 else "unknown"
        name = labels[1] if len(labels) > 1 else "unnamed"
        parsed = parse_block_body(block["body"])

        meta: Dict[str, Value] = {}
        properties: Dict[str, Value] = {}

        for key, value in parsed["attributes"].items():
            if key in META_KEYS:
                meta[key] = value
            else:
                properties[key] = value

        return {
            "type": resource_type,
            "name": name,
            "properties": properties,
            "blocks": [b for b in parsed["blocks"] if b.get("type") != "dynamic"],
            "dynamic_blocks": self._extract_dynamic_blocks(parsed["blocks"]),
            "meta": meta,
            "raw": block["raw"],
            "source": block["source"],
        }

    def _extract_dynamic_blocks(self, blocks: List[Dict[str, object]]) -> List[Dict[str, object]]:
        """
        Extracts dynamic block definitions from nested blocks.

        Args:
            blocks: List of nested blocks.

        Returns:
            List of parsed dynamic block structures.
        """
        dynamic_blocks: List[Dict[str, object]] = []

        for child in blocks:
            if child.get("type") != "dynamic":
                continue

            labels = child.get("labels")
            if not isinstance(labels, list):
                labels = []
            label = labels[0] if labels else "dynamic"

            attributes = child.get("attributes", {})
            if not isinstance(attributes, dict):
                attributes = {}

            iterator_value = attributes.get("iterator")
            iterator = literal_string(iterator_value) if isinstance(iterator_value, dict) else None

            content_block = None
            nested_blocks = child.get("blocks", [])
            if isinstance(nested_blocks, list):
                for nested in nested_blocks:
                    if isinstance(nested, dict) and nested.get("type") == "content":
                        content_block = nested
                        break

            dynamic_blocks.append(
                {
                    "label": label,
                    "for_each": attributes.get("for_each"),
                    "iterator": iterator,
                    "content": content_block.get("attributes", {}) if content_block else {},
                    "raw": child.get("raw"),
                }
            )

        return dynamic_blocks


class DataParser:
    """Parser for data source definition blocks."""

    def parse(self, block: HclBlock) -> Dict[str, object]:
        """
        Parses a data source definition block.

        Args:
            block: The raw HCL block.

        Returns:
            Parsed data source with dataType, name, properties, and blocks.
        """
        labels = block.get("labels", [])
        # Safe label extraction with fallbacks
        data_type = labels[0] if len(labels) > 0 else "unknown"
        name = labels[1] if len(labels) > 1 else "unnamed"
        parsed = parse_block_body(block["body"])

        return {
            "dataType": data_type,
            "name": name,
            "properties": parsed["attributes"],
            "blocks": parsed["blocks"],
            "raw": block["raw"],
            "source": block["source"],
        }


class GenericBlockParser:
    """Parser for generic/unknown block types."""

    def parse(self, block: HclBlock) -> Dict[str, object]:
        """
        Parses a generic block (moved, import, check, etc.).

        Args:
            block: The raw HCL block.

        Returns:
            Parsed block with type, labels, properties, and nested blocks.
        """
        parsed = parse_block_body(block["body"])
        return {
            "type": block["keyword"],
            "labels": block.get("labels", []),
            "properties": parsed["attributes"],
            "blocks": parsed["blocks"],
            "raw": block["raw"],
            "source": block["source"],
        }
