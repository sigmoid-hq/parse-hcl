from __future__ import annotations

from typing import Any, Dict

from ..types import Value
from ..utils.parser.body_parser import parse_block_body
from ..utils.common.fs import read_json_file, read_text_file
from .terraform_json_parser import _convert_json_value


class TfVarsParser:
    def parse_file(self, file_path: str) -> Dict[str, Any]:
        if file_path.endswith(".json"):
            json_data = read_json_file(file_path)
            assignments = {key: _convert_json_value(val) for key, val in json_data.items()} if isinstance(json_data, dict) else {}
            return {"source": file_path, "raw": _stringify(json_data), "assignments": assignments}

        raw = read_text_file(file_path)
        parsed = parse_block_body(raw)
        return {"source": file_path, "raw": raw, "assignments": parsed["attributes"]}


class TfStateParser:
    def parse_file(self, file_path: str) -> Dict[str, Any]:
        raw = read_json_file(file_path)
        return self.parse(raw, file_path)

    def parse(self, raw: Any, source: str = "") -> Dict[str, Any]:
        data = raw or {}
        if not isinstance(data, dict):
            data = {}
        resources_raw = data.get("resources", [])
        resources = [self._normalize_state_resource(item) for item in resources_raw] if isinstance(resources_raw, list) else []
        outputs = _normalize_state_outputs(data.get("outputs") or {})

        version = data.get("version")
        terraform_version = data.get("terraform_version") if isinstance(data.get("terraform_version"), str) else None
        serial = data.get("serial") if isinstance(data.get("serial"), int) else None
        lineage = data.get("lineage") if isinstance(data.get("lineage"), str) else None
        version_num = version if isinstance(version, int) else int(version) if isinstance(version, str) and version.isdigit() else 0

        return {
            "version": version_num,
            "terraform_version": terraform_version,
            "serial": serial,
            "lineage": lineage,
            "outputs": outputs,
            "resources": resources,
            "raw": raw,
            "source": source,
        }

    def _normalize_state_resource(self, resource: Any) -> Dict[str, Any]:
        data = resource or {}
        if not isinstance(data, dict):
            data = {}
        instances_raw = data.get("instances", [])
        instances = [_normalize_state_instance(item) for item in instances_raw] if isinstance(instances_raw, list) else []

        return {
            "module": data.get("module") if isinstance(data.get("module"), str) else None,
            "mode": "data" if data.get("mode") == "data" else "managed",
            "type": data.get("type") if isinstance(data.get("type"), str) else "unknown",
            "name": data.get("name") if isinstance(data.get("name"), str) else "unknown",
            "provider": data.get("provider") if isinstance(data.get("provider"), str) else None,
            "instances": instances,
        }


class TfPlanParser:
    def parse_file(self, file_path: str) -> Dict[str, Any]:
        raw = read_json_file(file_path)
        return self.parse(raw, file_path)

    def parse(self, raw: Any, source: str = "") -> Dict[str, Any]:
        data = raw or {}
        if not isinstance(data, dict):
            data = {}
        planned_values = data.get("planned_values")
        resource_changes = data.get("resource_changes", [])

        result: Dict[str, Any] = {
            "format_version": data.get("format_version") if isinstance(data.get("format_version"), str) else None,
            "terraform_version": data.get("terraform_version") if isinstance(data.get("terraform_version"), str) else None,
            "planned_values": None,
            "resource_changes": [],
            "raw": raw,
            "source": source,
        }

        if isinstance(planned_values, dict):
            root_module = planned_values.get("root_module") if isinstance(planned_values.get("root_module"), dict) else {}
            result["planned_values"] = {"root_module": _normalize_plan_module(root_module)}

        if isinstance(resource_changes, list):
            result["resource_changes"] = [_normalize_plan_resource_change(item) for item in resource_changes]

        return result


def _normalize_state_outputs(outputs: Dict[str, Any]) -> Dict[str, Any]:
    result: Dict[str, Any] = {}
    for name, value in outputs.items():
        output = value if isinstance(value, dict) else {}
        result[name] = {"value": output.get("value", value), "type": output.get("type"), "sensitive": bool(output.get("sensitive"))}
    return result


def _normalize_state_instance(instance: Any) -> Dict[str, Any]:
    data = instance or {}
    if not isinstance(data, dict):
        data = {}
    index_key = None
    if isinstance(data.get("index_key"), (str, int)):
        index_key = data["index_key"]
    elif isinstance(data.get("index"), (str, int)):
        index_key = data["index"]

    attributes = data.get("attributes") or data.get("attributes_flat")
    attributes = attributes if isinstance(attributes, dict) else None

    return {"index_key": index_key, "attributes": attributes, "status": data.get("status") if isinstance(data.get("status"), str) else None}


def _normalize_plan_module(module: Dict[str, Any]) -> Dict[str, Any]:
    resources_raw = module.get("resources", [])
    children_raw = module.get("child_modules", [])

    resources = [_normalize_plan_resource(r) for r in resources_raw] if isinstance(resources_raw, list) else []
    children = [_normalize_plan_module(child) for child in children_raw] if isinstance(children_raw, list) else []

    return {
        "address": module.get("address") if isinstance(module.get("address"), str) else None,
        "resources": resources,
        "child_modules": children,
    }


def _normalize_plan_resource(resource: Any) -> Dict[str, Any]:
    data = resource or {}
    if not isinstance(data, dict):
        data = {}
    address = data.get("address") if isinstance(data.get("address"), str) else None

    return {
        "address": address or _build_address(data),
        "mode": "data" if data.get("mode") == "data" else "managed",
        "type": data.get("type") if isinstance(data.get("type"), str) else "unknown",
        "name": data.get("name") if isinstance(data.get("name"), str) else "unknown",
        "provider_name": data.get("provider_name") if isinstance(data.get("provider_name"), str) else None,
        "values": data.get("values") if isinstance(data.get("values"), dict) else None,
    }


def _normalize_plan_resource_change(change: Any) -> Dict[str, Any]:
    data = change or {}
    if not isinstance(data, dict):
        data = {}
    change_data = data.get("change") if isinstance(data.get("change"), dict) else {}

    return {
        "address": data.get("address") if isinstance(data.get("address"), str) else _build_address(data),
        "module_address": data.get("module_address") if isinstance(data.get("module_address"), str) else None,
        "mode": "data" if data.get("mode") == "data" else "managed",
        "type": data.get("type") if isinstance(data.get("type"), str) else "unknown",
        "name": data.get("name") if isinstance(data.get("name"), str) else "unknown",
        "provider_name": data.get("provider_name") if isinstance(data.get("provider_name"), str) else None,
        "change": {
            "actions": change_data.get("actions") if isinstance(change_data.get("actions"), list) else [],
            "before": change_data.get("before"),
            "after": change_data.get("after"),
            "after_unknown": change_data.get("after_unknown") if isinstance(change_data.get("after_unknown"), dict) else None,
            "before_sensitive": change_data.get("before_sensitive") if isinstance(change_data.get("before_sensitive"), dict) else None,
            "after_sensitive": change_data.get("after_sensitive") if isinstance(change_data.get("after_sensitive"), dict) else None,
        },
    }


def _build_address(data: Dict[str, Any]) -> str:
    mode = "data" if data.get("mode") == "data" else "resource"
    resource_type = data.get("type") if isinstance(data.get("type"), str) else "unknown"
    name = data.get("name") if isinstance(data.get("name"), str) else "unknown"
    return f"{mode}.{resource_type}.{name}"


def _stringify(value: Any) -> str:
    try:
        import json
        return json.dumps(value)
    except Exception:
        return str(value)
