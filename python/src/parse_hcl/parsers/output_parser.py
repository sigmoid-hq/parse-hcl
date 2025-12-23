from __future__ import annotations

from typing import Dict

from ..types import HclBlock
from ..utils.common.value_helpers import literal_boolean, literal_string
from ..utils.parser.body_parser import parse_block_body


class OutputParser:
    def parse(self, block: HclBlock) -> Dict[str, object]:
        name = block["labels"][0] if block["labels"] else "unknown"
        parsed = parse_block_body(block["body"])

        description_val = parsed["attributes"].get("description")  # type: ignore[index]
        description = literal_string(description_val) or (description_val.get("raw") if isinstance(description_val, dict) else None)
        value = parsed["attributes"].get("value")  # type: ignore[index]
        sensitive = literal_boolean(parsed["attributes"].get("sensitive"))  # type: ignore[index]

        return {
            "name": name,
            "description": description,
            "value": value,
            "sensitive": sensitive,
            "raw": block["raw"],
            "source": block["source"],
        }
