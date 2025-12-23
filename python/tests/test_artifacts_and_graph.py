import sys
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from parse_hcl import TerraformParser, TfPlanParser, TfStateParser, TfVarsParser, build_dependency_graph  # noqa: E402


class ArtifactParsersTest(unittest.TestCase):
    def setUp(self) -> None:
        self.fixtures = ROOT / "tests" / "fixtures"

    def test_parses_tfvars_assignments(self) -> None:
        parsed = TfVarsParser().parse_file(str(self.fixtures / "sample.tfvars"))
        self.assertEqual(parsed["assignments"]["project"]["type"], "literal")
        self.assertEqual(parsed["assignments"]["env"]["type"], "literal")
        self.assertEqual(parsed["assignments"]["cidrs"]["type"], "array")

    def test_parses_state(self) -> None:
        parsed = TfStateParser().parse_file(str(self.fixtures / "terraform.tfstate"))
        self.assertEqual(parsed["version"], 4)
        self.assertEqual(parsed["outputs"]["bucket_name"]["value"], "demo-bucket")
        self.assertEqual(parsed["resources"][0]["type"], "aws_s3_bucket")
        self.assertEqual(parsed["resources"][0]["instances"][0]["attributes"]["bucket"], "demo-bucket")

    def test_parses_plan(self) -> None:
        parsed = TfPlanParser().parse_file(str(self.fixtures / "plan.json"))
        self.assertEqual(parsed["format_version"], "1.0")
        self.assertIn("create", parsed["resource_changes"][0]["change"]["actions"])
        values = parsed["planned_values"]["root_module"]["resources"][0]["values"]
        self.assertEqual(values.get("bucket"), "demo-bucket")


class DependencyGraphTest(unittest.TestCase):
    def setUp(self) -> None:
        self.fixtures = ROOT / "tests" / "fixtures"
        self.parser = TerraformParser()

    def test_builds_nodes_and_edges(self) -> None:
        doc = self.parser.parse_file(str(self.fixtures / "main.tf"))
        graph = build_dependency_graph(doc)

        resource_node_id = "resource.aws_s3_bucket.demo"
        local_node_id = "locals.name_prefix"
        output_node_id = "output.bucket_name"

        self.assertTrue(any(node["id"] == resource_node_id for node in graph["nodes"]))
        self.assertTrue(any(node["id"] == output_node_id for node in graph["nodes"]))
        self.assertTrue(any(edge["to"] == local_node_id and edge["from"] == resource_node_id for edge in graph["edges"]))
        self.assertTrue(any(edge["to"] == resource_node_id and edge["from"] == output_node_id for edge in graph["edges"]))

    def test_depends_on_references(self) -> None:
        doc = self.parser.parse_file(str(self.fixtures / "depends_on.tf"))
        graph = build_dependency_graph(doc)

        base_id = "resource.aws_s3_bucket.base"
        dependent_id = "resource.aws_s3_bucket.dependent"
        self.assertTrue(any(edge["from"] == dependent_id and edge["to"] == base_id for edge in graph["edges"]))


if __name__ == "__main__":
    unittest.main()
