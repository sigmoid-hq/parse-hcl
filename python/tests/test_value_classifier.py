import sys
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from parse_hcl import classify_value  # noqa: E402


class ValueClassifierTest(unittest.TestCase):
    def test_extracts_references_in_arrays(self) -> None:
        value = classify_value("[aws_s3_bucket.demo, module.mod.output]")
        self.assertEqual(value["type"], "array")
        self.assertIn({"kind": "resource", "resource_type": "aws_s3_bucket", "name": "demo", "attribute": None}, value["references"])
        self.assertIn({"kind": "module_output", "module": "mod", "name": "output"}, value["references"])

    def test_handles_indexed_traversals(self) -> None:
        value = classify_value("aws_s3_bucket.demo[0].bucket")
        self.assertEqual(value["type"], "expression")
        self.assertIn(
            {"kind": "resource", "resource_type": "aws_s3_bucket", "name": "demo", "attribute": "bucket"},
            value["references"],
        )


if __name__ == "__main__":
    unittest.main()
