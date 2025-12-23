from __future__ import annotations

from typing import Dict, List

from ..types import HclBlock
from ..utils.parser.body_parser import parse_block_body


class LocalsParser:
    def parse(self, block: HclBlock) -> List[Dict[str, object]]:
        parsed = parse_block_body(block["body"])
        locals_list: List[Dict[str, object]] = []

        for name, value in parsed["attributes"].items():  # type: ignore[index]
            locals_list.append(
                {
                    "name": name,
                    "type": value.get("type") if isinstance(value, dict) else None,
                    "value": value,
                    "raw": value.get("raw") if isinstance(value, dict) else None,
                    "source": block["source"],
                }
            )

        return locals_list
