from __future__ import annotations

import json
import re
from typing import Any, Dict

from ..types import TerraformDocument, Value, create_empty_document
from ..utils.common.fs import read_json_file
from ..utils.parser.value_classifier import classify_value


class TerraformJsonParser:
    def parse_file(self, file_path: str) -> TerraformDocument:
        json_data = read_json_file(file_path)
        return self.parse(json_data, file_path)

    def parse(self, json_data: Dict[str, Any], source: str = "json-config") -> TerraformDocument:
        doc = create_empty_document()
        self._parse_terraform(json_data.get("terraform"), doc, source)
        self._parse_providers(json_data.get("provider"), doc, source)
        self._parse_variables(json_data.get("variable"), doc, source)
        self._parse_outputs(json_data.get("output"), doc, source)
        self._parse_locals(json_data.get("locals"), doc, source)
        self._parse_modules(json_data.get("module"), doc, source)
        self._parse_resources(json_data.get("resource"), doc, source)
        self._parse_data(json_data.get("data"), doc, source)
        return doc

    def _parse_terraform(self, value: Any, doc: TerraformDocument, source: str) -> None:
        if not isinstance(value, list):
            return
        for item in value:
            if isinstance(item, dict):
                doc["terraform"].append({"properties": _convert_attributes(item), "raw": _stringify(item), "source": source})

    def _parse_providers(self, value: Any, doc: TerraformDocument, source: str) -> None:
        if not isinstance(value, dict):
            return
        for name, config in value.items():
            configs = config if isinstance(config, list) else [config]
            for alias_cfg in configs:
                if not isinstance(alias_cfg, dict):
                    continue
                alias = alias_cfg.get("alias") if isinstance(alias_cfg.get("alias"), str) else None
                doc["provider"].append(
                    {
                        "name": name,
                        "alias": alias,
                        "properties": _convert_attributes(alias_cfg, skip_keys={"alias"}),
                        "raw": _stringify(alias_cfg),
                        "source": source,
                    }
                )

    def _parse_variables(self, value: Any, doc: TerraformDocument, source: str) -> None:
        if not isinstance(value, dict):
            return
        for name, config in value.items():
            cfg = config or {}
            if not isinstance(cfg, dict):
                continue
            doc["variable"].append(
                {
                    "name": name,
                    "description": cfg.get("description") if isinstance(cfg.get("description"), str) else None,
                    "type": cfg.get("type") if isinstance(cfg.get("type"), str) else None,
                    "default": _convert_json_value(cfg["default"]) if "default" in cfg else None,
                    "validation": None,
                    "sensitive": cfg.get("sensitive") if isinstance(cfg.get("sensitive"), bool) else None,
                    "raw": _stringify(cfg),
                    "source": source,
                }
            )

    def _parse_outputs(self, value: Any, doc: TerraformDocument, source: str) -> None:
        if not isinstance(value, dict):
            return
        for name, config in value.items():
            cfg = config or {}
            if not isinstance(cfg, dict):
                continue
            doc["output"].append(
                {
                    "name": name,
                    "description": cfg.get("description") if isinstance(cfg.get("description"), str) else None,
                    "value": _convert_json_value(cfg.get("value")),
                    "sensitive": cfg.get("sensitive") if isinstance(cfg.get("sensitive"), bool) else None,
                    "raw": _stringify(cfg),
                    "source": source,
                }
            )

    def _parse_locals(self, value: Any, doc: TerraformDocument, source: str) -> None:
        if not isinstance(value, dict):
            return
        for name, val in value.items():
            converted = _convert_json_value(val)
            doc["locals"].append({"name": name, "type": converted.get("type"), "value": converted, "raw": converted.get("raw"), "source": source})

    def _parse_modules(self, value: Any, doc: TerraformDocument, source: str) -> None:
        if not isinstance(value, dict):
            return
        for name, config in value.items():
            cfg = config or {}
            if not isinstance(cfg, dict):
                continue
            doc["module"].append({"name": name, "properties": _convert_attributes(cfg), "raw": _stringify(cfg), "source": source})

    def _parse_resources(self, value: Any, doc: TerraformDocument, source: str) -> None:
        if not isinstance(value, dict):
            return
        for resource_type, resource_by_name in value.items():
            if not isinstance(resource_by_name, dict):
                continue
            for name, config_list in resource_by_name.items():
                configs = config_list if isinstance(config_list, list) else [config_list]
                for cfg in configs:
                    if not isinstance(cfg, dict):
                        continue
                    parsed = _convert_attributes(cfg)
                    doc["resource"].append(
                        {
                            "type": resource_type,
                            "name": name,
                            "properties": parsed,
                            "blocks": [],
                            "dynamic_blocks": [],
                            "meta": {},
                            "raw": _stringify(cfg),
                            "source": source,
                        }
                    )

    def _parse_data(self, value: Any, doc: TerraformDocument, source: str) -> None:
        if not isinstance(value, dict):
            return
        for data_type, data_by_name in value.items():
            if not isinstance(data_by_name, dict):
                continue
            for name, config_list in data_by_name.items():
                configs = config_list if isinstance(config_list, list) else [config_list]
                for cfg in configs:
                    if not isinstance(cfg, dict):
                        continue
                    parsed = _convert_attributes(cfg)
                    doc["data"].append(
                        {
                            "dataType": data_type,
                            "name": name,
                            "properties": parsed,
                            "blocks": [],
                            "raw": _stringify(cfg),
                            "source": source,
                        }
                    )


def _convert_attributes(obj: Dict[str, Any], skip_keys: set[str] | None = None) -> Dict[str, Value]:
    skip_keys = skip_keys or set()
    return {key: _convert_json_value(val) for key, val in obj.items() if key not in skip_keys}


def _convert_json_value(input_val: Any) -> Value:
    if input_val is None:
        return {"type": "literal", "value": None, "raw": "null"}
    if isinstance(input_val, str):
        if _looks_like_expression(input_val):
            return classify_value(input_val)
        return {"type": "literal", "value": input_val, "raw": input_val}
    if isinstance(input_val, (int, float, bool)):
        return {"type": "literal", "value": input_val, "raw": str(input_val)}
    if isinstance(input_val, list):
        return {"type": "array", "value": [_convert_json_value(item) for item in input_val], "raw": _stringify(input_val)}
    if isinstance(input_val, dict):
        return {"type": "object", "value": {key: _convert_json_value(val) for key, val in input_val.items()}, "raw": _stringify(input_val)}
    return {"type": "literal", "value": str(input_val), "raw": str(input_val)}


def _looks_like_expression(value: str) -> bool:
    return "${" in value or re.match(r"^[\w.]+\(", value) or re.match(r"^[\w.]+$", value)


def _stringify(value: Any) -> str:
    try:
        return json.dumps(value)
    except Exception:
        return str(value)
