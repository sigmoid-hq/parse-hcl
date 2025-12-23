from __future__ import annotations

from typing import Dict, List

from .body_parser import parse_block_body
from .types import HclBlock, Value
from .value_helpers import literal_string

META_KEYS = {"count", "for_each", "provider", "depends_on", "lifecycle"}


class TerraformSettingsParser:
    def parse(self, block: HclBlock) -> Dict[str, object]:
        parsed = parse_block_body(block["body"])
        return {"properties": parsed["attributes"], "raw": block["raw"], "source": block["source"]}


class ProviderParser:
    def parse(self, block: HclBlock) -> Dict[str, object]:
        name = block["labels"][0] if block["labels"] else "default"
        parsed = parse_block_body(block["body"])
        alias_value = parsed["attributes"].get("alias")  # type: ignore[index]
        alias = literal_string(alias_value) or (alias_value.get("raw") if isinstance(alias_value, dict) else None)

        return {
            "name": name,
            "alias": alias,
            "properties": parsed["attributes"],
            "raw": block["raw"],
            "source": block["source"],
        }


class ModuleParser:
    def parse(self, block: HclBlock) -> Dict[str, object]:
        name = block["labels"][0] if block["labels"] else "unnamed"
        parsed = parse_block_body(block["body"])
        return {"name": name, "properties": parsed["attributes"], "raw": block["raw"], "source": block["source"]}


class ResourceParser:
    def parse(self, block: HclBlock) -> Dict[str, object]:
        labels = block["labels"] + ["unknown", "unnamed"]
        resource_type, name = labels[0], labels[1]
        parsed = parse_block_body(block["body"])

        meta: Dict[str, Value] = {}
        properties: Dict[str, Value] = {}

        for key, value in parsed["attributes"].items():  # type: ignore[index]
            if key in META_KEYS:
                meta[key] = value
            else:
                properties[key] = value

        return {
            "type": resource_type,
            "name": name,
            "properties": properties,
            "blocks": [b for b in parsed["blocks"] if b.get("type") != "dynamic"],  # type: ignore[index]
            "dynamic_blocks": self._extract_dynamic_blocks(parsed["blocks"]),  # type: ignore[index]
            "meta": meta,
            "raw": block["raw"],
            "source": block["source"],
        }

    def _extract_dynamic_blocks(self, blocks: List[Dict[str, object]]) -> List[Dict[str, object]]:
        dynamic_blocks: List[Dict[str, object]] = []

        for child in blocks:
            if child.get("type") != "dynamic":
                continue
            labels = child.get("labels") or []
            label = labels[0] if labels else "dynamic"
            attributes = child.get("attributes", {})
            iterator_value = attributes.get("iterator") if isinstance(attributes, dict) else None
            iterator = literal_string(iterator_value) if isinstance(iterator_value, dict) else None
            content_block = None
            for nested in child.get("blocks", []):  # type: ignore[assignment]
                if nested.get("type") == "content":
                    content_block = nested
                    break

            dynamic_blocks.append(
                {
                    "label": label,
                    "for_each": attributes.get("for_each") if isinstance(attributes, dict) else None,
                    "iterator": iterator,
                    "content": content_block.get("attributes", {}) if content_block else {},
                    "raw": child.get("raw"),
                }
            )

        return dynamic_blocks


class DataParser:
    def parse(self, block: HclBlock) -> Dict[str, object]:
        labels = block["labels"] + ["unknown", "unnamed"]
        data_type, name = labels[0], labels[1]
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
    def parse(self, block: HclBlock) -> Dict[str, object]:
        parsed = parse_block_body(block["body"])
        return {
            "type": block["keyword"],
            "labels": block["labels"],
            "properties": parsed["attributes"],
            "blocks": parsed["blocks"],
            "raw": block["raw"],
            "source": block["source"],
        }
