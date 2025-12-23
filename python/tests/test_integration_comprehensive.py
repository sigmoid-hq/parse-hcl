import sys
from pathlib import Path
import unittest
import json

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from parse_hcl import (  # noqa: E402
    ParseError,
    TerraformParser,
    build_dependency_graph,
    classify_value,
    offset_to_location,
    parse_type_constraint,
    to_json,
    to_yaml_document,
)
from parse_hcl.utils.lexer.block_scanner import BlockScanner  # noqa: E402
from parse_hcl.utils.lexer.hcl_lexer import find_matching_brace, is_escaped, split_array_elements, split_object_entries  # noqa: E402


class ComprehensiveTest(unittest.TestCase):
    def setUp(self) -> None:
        self.fixtures = ROOT / "tests" / "fixtures"
        self.parser = TerraformParser()

    def test_type_constraint_and_validation(self) -> None:
        doc = self.parser.parse_file(str(self.fixtures / "advanced.tf"))
        instance_config = next(v for v in doc["variable"] if v["name"] == "instance_config")

        self.assertEqual(instance_config["typeConstraint"]["base"], "object")
        self.assertIn("name", instance_config["typeConstraint"]["attributes"])
        self.assertIsNotNone(instance_config["validation"])
        self.assertIsNotNone(instance_config["validation"]["condition"])
        self.assertIsNotNone(instance_config["validation"]["error_message"])
        self.assertFalse(instance_config["nullable"])

    def test_locals_and_providers(self) -> None:
        doc = self.parser.parse_file(str(self.fixtures / "advanced.tf"))
        self.assertTrue(any(local["name"] == "app_name" for local in doc["locals"]))
        self.assertTrue(any(p.get("alias") == "west" for p in doc["provider"]))

    def test_data_resources_and_meta(self) -> None:
        doc = self.parser.parse_file(str(self.fixtures / "advanced.tf"))
        ami = next(d for d in doc["data"] if d["name"] == "ubuntu")
        self.assertEqual(len([b for b in ami["blocks"] if b["type"] == "filter"]), 2)

        instance = next(r for r in doc["resource"] if r["type"] == "aws_instance" and r["name"] == "web")
        self.assertIsNotNone(instance["meta"]["count"])

        sg = next(r for r in doc["resource"] if r["type"] == "aws_security_group")
        self.assertGreaterEqual(len(sg["dynamic_blocks"]), 1)
        self.assertEqual(sg["dynamic_blocks"][0]["label"], "ingress")

        volume = next(r for r in doc["resource"] if r["type"] == "aws_ebs_volume")
        self.assertIsNotNone(volume["meta"]["depends_on"])
        self.assertIsNotNone(volume["meta"]["depends_on"].get("references"))

    def test_modules_outputs_and_generic_blocks(self) -> None:
        doc = self.parser.parse_file(str(self.fixtures / "advanced.tf"))
        vpc = next(m for m in doc["module"] if m["name"] == "vpc")
        self.assertIn("source", vpc["properties"])
        self.assertIn("version", vpc["properties"])

        instance_ids = next(o for o in doc["output"] if o["name"] == "instance_ids")
        self.assertEqual(instance_ids["value"]["kind"], "splat")

        self.assertEqual(len(doc["moved"]), 1)
        self.assertEqual(len(doc["import"]), 1)
        self.assertEqual(len(doc["check"]), 1)

    def test_dependency_graph_nodes(self) -> None:
        doc = self.parser.parse_file(str(self.fixtures / "advanced.tf"))
        graph = build_dependency_graph(doc)
        node_kinds = {node["kind"] for node in graph["nodes"]}
        self.assertTrue({"variable", "locals", "resource", "data", "module", "output", "provider"}.issubset(node_kinds))
        self.assertTrue(any(edge["reference"]["kind"] == "variable" for edge in graph["edges"]))

    def test_serialization_pruning(self) -> None:
        doc = self.parser.parse_file(str(self.fixtures / "advanced.tf"))
        pruned = json.loads(to_json(doc))
        self.assertNotIn("unknown", pruned)
        yaml_text = to_yaml_document(doc)
        self.assertIn("variable:", yaml_text)

    def test_lexer_and_scanner_utilities(self) -> None:
        self.assertTrue(is_escaped('test\\"here', 5))
        self.assertFalse(is_escaped('test"here', 4))
        self.assertEqual(split_array_elements("[1, 2, 3]"), ["1", "2", "3"])
        self.assertEqual(split_object_entries("{ a = 1, b = 2 }")[0][0], "a")
        self.assertEqual(find_matching_brace("{ content }", 0), 10)

        scanner = BlockScanner()
        content = 'resource "test" "name" { unclosed'
        with self.assertRaises(ParseError):
            scanner.scan(content, "test.tf", strict=True)
        self.assertEqual(scanner.scan(content, "test.tf", strict=False), [])

        location = offset_to_location("line1\nline2\nline3", 6)
        self.assertEqual(location.line, 2)
        self.assertEqual(location.column, 1)


if __name__ == "__main__":
    unittest.main()
