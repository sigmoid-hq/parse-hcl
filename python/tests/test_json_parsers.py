import sys
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from parse_hcl import TerraformParser, TfVarsParser, to_json, to_json_export  # noqa: E402


class JsonParserTest(unittest.TestCase):
    def setUp(self) -> None:
        self.fixtures = ROOT / "tests" / "fixtures"
        self.parser = TerraformParser()

    def test_parses_tf_json_configs(self) -> None:
        doc = self.parser.parse_file(str(self.fixtures / "config.tf.json"))

        self.assertEqual(doc["provider"][0]["name"], "aws")
        self.assertEqual(doc["locals"][0]["name"], "name_prefix")
        self.assertEqual(doc["resource"][0]["type"], "aws_s3_bucket")
        ref = doc["output"][0]["value"]["references"][0]
        self.assertEqual(ref["kind"], "resource")
        self.assertEqual(ref["resource_type"], "aws_s3_bucket")

    def test_parses_tfvars_json(self) -> None:
        parsed = TfVarsParser().parse_file(str(self.fixtures / "vars.auto.tfvars.json"))
        self.assertEqual(parsed["assignments"]["project"]["type"], "literal")
        self.assertEqual(parsed["assignments"]["cidrs"]["type"], "array")

    def test_prune_toggle_on_export(self) -> None:
        doc = self.parser.parse_file(str(self.fixtures / "config.tf.json"))
        full = to_json(doc, prune_empty=False)
        self.assertIn("unknown", full)
        pruned = to_json(doc)
        self.assertNotIn("unknown", pruned)

        exported = to_json_export(self.parser.parse_file(str(self.fixtures / "main.tf")), prune_empty=False)
        self.assertIn("dynamic_blocks", exported)
        self.assertIn("blocks", exported)


if __name__ == "__main__":
    unittest.main()
