import os
import sys
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from parse_hcl import TerraformParser, to_json, to_yaml_document  # noqa: E402
from parse_hcl.utils.common.fs import list_terraform_files  # noqa: E402
from parse_hcl.utils.output_metadata import annotate_output_metadata  # noqa: E402


class TerraformParserTest(unittest.TestCase):
    def setUp(self) -> None:
        self.fixtures = ROOT / "tests" / "fixtures"
        self.parser = TerraformParser()

    def test_parses_core_blocks_from_file(self) -> None:
        doc = self.parser.parse_file(str(self.fixtures / "main.tf"))

        self.assertEqual(len(doc["variable"]), 1)
        self.assertEqual(doc["variable"][0]["name"], "region")
        self.assertEqual(doc["provider"][0]["name"], "aws")
        self.assertEqual(len(doc["locals"]), 1)
        self.assertEqual(doc["locals"][0]["name"], "name_prefix")

        bucket = doc["resource"][0]
        self.assertEqual(bucket["type"], "aws_s3_bucket")
        self.assertEqual(bucket["name"], "demo")
        self.assertEqual(bucket["meta"]["count"]["type"], "literal")
        self.assertEqual(bucket["meta"]["count"]["raw"], "2")
        self.assertEqual(bucket["properties"]["bucket"]["type"], "expression")
        self.assertNotIn("count", bucket["properties"])

        self.assertEqual(len(doc["output"]), 1)
        self.assertEqual(doc["output"][0]["value"]["type"], "expression")
        first_ref = doc["output"][0]["value"]["references"][0]
        self.assertEqual(first_ref["kind"], "resource")
        self.assertEqual(first_ref["resource_type"], "aws_s3_bucket")

    def test_directory_parsing_with_aggregation(self) -> None:
        discovered = list_terraform_files(str(self.fixtures))
        result = self.parser.parse_directory(str(self.fixtures))

        self.assertEqual(len(discovered), 9)
        self.assertTrue(any(str(Path(f).name) == "child.tf" for f in discovered))
        self.assertEqual(len(result["files"]), 9)
        self.assertTrue(any("child.tf" in f["path"] for f in result["files"]))
        self.assertGreaterEqual(len(result["combined"]["data"]), 2)
        self.assertGreaterEqual(len(result["combined"]["resource"]), 6)
        self.assertGreaterEqual(len(result["combined"]["variable"]), 2)

    def test_serialization_prunes_empty(self) -> None:
        doc = self.parser.parse_file(str(self.fixtures / "data.tf"))
        json_text = to_json(doc)

        self.assertNotIn('"locals"', json_text)
        self.assertNotIn('"variable"', json_text)
        self.assertNotIn('"resource"', json_text)
        self.assertIn('"data"', json_text)

    def test_raw_normalization(self) -> None:
        doc = self.parser.parse_file(str(self.fixtures / "main.tf"))
        raw = doc["variable"][0]["raw"]

        self.assertTrue(raw.startswith('variable "region" {'))
        self.assertNotIn("  type        =", raw)
        self.assertIn("type = string", raw)

    def test_yaml_indentation(self) -> None:
        doc = self.parser.parse_file(str(self.fixtures / "main.tf"))
        yaml_text = to_yaml_document(doc)
        lines = yaml_text.splitlines()

        self.assertTrue(any(line.startswith("  - type: aws_s3_bucket") for line in lines))
        self.assertTrue(any(line.startswith("    name: demo") for line in lines))

    def test_dynamic_and_generic_blocks(self) -> None:
        doc = self.parser.parse_file(str(self.fixtures / "dynamic.tf"))
        self.assertEqual(len(doc["resource"][0]["dynamic_blocks"]), 1)
        self.assertEqual(doc["resource"][0]["dynamic_blocks"][0]["label"], "ingress")
        self.assertEqual(len(doc["moved"]), 1)
        self.assertEqual(len(doc["import"]), 1)
        self.assertEqual(len(doc["check"]), 1)

    def test_attaches_relative_paths_for_split_outputs(self) -> None:
        per_file_base = Path("parse-hcl-output/files").resolve()
        result = self.parser.parse_directory(str(self.fixtures))

        annotate_output_metadata(
            dir_path=str(self.fixtures),
            files=result["files"],
            per_file_base=per_file_base,
            ext=".json",
            cwd=Path.cwd(),
        )

        module_file = next((f for f in result["files"] if f["path"].endswith(str(Path("module_local/main.tf")))), None)
        self.assertIsNotNone(module_file)
        self.assertEqual(module_file.get("relative_path"), str(Path("module_local/main.tf")))

        expected_output = os.path.relpath(per_file_base / "module_local" / "main.tf.json", Path.cwd())
        self.assertEqual(module_file.get("output_path"), expected_output if expected_output else ".")

        module_block = module_file["document"]["module"][0]
        self.assertEqual(module_block.get("source_raw"), "./modules/simple")
        expected_dir = os.path.relpath(per_file_base / "module_local" / "modules" / "simple", Path.cwd())
        self.assertEqual(module_block.get("source_output_dir"), expected_dir if expected_dir else ".")


if __name__ == "__main__":
    unittest.main()
