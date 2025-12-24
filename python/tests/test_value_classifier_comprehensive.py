"""Comprehensive tests for value classifier."""

import sys
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from parse_hcl import classify_value


class LiteralValuesTest(unittest.TestCase):
    """Tests for literal value classification."""

    def test_boolean_literals(self) -> None:
        result_true = classify_value("true")
        self.assertEqual(result_true["type"], "literal")
        self.assertEqual(result_true["value"], True)

        result_false = classify_value("false")
        self.assertEqual(result_false["type"], "literal")
        self.assertEqual(result_false["value"], False)

    def test_numeric_literals(self) -> None:
        # Integers
        self.assertEqual(classify_value("42")["value"], 42)
        self.assertEqual(classify_value("-17")["value"], -17)

        # Floats
        self.assertEqual(classify_value("3.14")["value"], 3.14)
        self.assertEqual(classify_value("-0.5")["value"], -0.5)

        # Scientific notation
        self.assertEqual(classify_value("1e10")["value"], 1e10)
        self.assertEqual(classify_value("1.5e-3")["value"], 0.0015)

    def test_null_literal(self) -> None:
        result = classify_value("null")
        self.assertEqual(result["type"], "literal")
        self.assertIsNone(result["value"])

    def test_quoted_strings(self) -> None:
        result_double = classify_value('"hello"')
        self.assertEqual(result_double["type"], "literal")
        self.assertEqual(result_double["value"], "hello")

        result_single = classify_value("'world'")
        self.assertEqual(result_single["type"], "literal")
        self.assertEqual(result_single["value"], "world")

    def test_escape_sequences(self) -> None:
        self.assertEqual(classify_value('"line1\\nline2"')["value"], "line1\nline2")
        self.assertEqual(classify_value('"tab\\there"')["value"], "tab\there")
        self.assertEqual(classify_value('"quote\\"here"')["value"], 'quote"here')
        self.assertEqual(classify_value('"back\\\\slash"')["value"], "back\\slash")


class ArrayValuesTest(unittest.TestCase):
    """Tests for array value classification."""

    def test_simple_arrays(self) -> None:
        result = classify_value("[1, 2, 3]")
        self.assertEqual(result["type"], "array")
        self.assertEqual(len(result["value"]), 3)

    def test_mixed_type_arrays(self) -> None:
        result = classify_value('["a", 1, true, null]')
        self.assertEqual(result["type"], "array")
        self.assertEqual(len(result["value"]), 4)

    def test_nested_arrays(self) -> None:
        result = classify_value("[[1, 2], [3, 4]]")
        self.assertEqual(result["type"], "array")
        self.assertEqual(len(result["value"]), 2)
        self.assertEqual(result["value"][0]["type"], "array")

    def test_extracts_references_from_arrays(self) -> None:
        result = classify_value("[var.a, local.b]")
        self.assertEqual(len(result["references"]), 2)
        self.assertEqual(result["references"][0]["kind"], "variable")
        self.assertEqual(result["references"][0]["name"], "a")
        self.assertEqual(result["references"][1]["kind"], "local")
        self.assertEqual(result["references"][1]["name"], "b")


class ObjectValuesTest(unittest.TestCase):
    """Tests for object value classification."""

    def test_simple_objects(self) -> None:
        result = classify_value("{ a = 1, b = 2 }")
        self.assertEqual(result["type"], "object")
        self.assertIn("a", result["value"])
        self.assertIn("b", result["value"])

    def test_nested_objects(self) -> None:
        result = classify_value('{ outer = { inner = "value" } }')
        self.assertEqual(result["type"], "object")
        self.assertEqual(result["value"]["outer"]["type"], "object")

    def test_extracts_references_from_objects(self) -> None:
        result = classify_value("{ key = var.value }")
        self.assertEqual(len(result["references"]), 1)
        self.assertEqual(result["references"][0]["kind"], "variable")
        self.assertEqual(result["references"][0]["name"], "value")


class ExpressionValuesTest(unittest.TestCase):
    """Tests for expression value classification."""

    def test_simple_traversals(self) -> None:
        result = classify_value("var.region")
        self.assertEqual(result["type"], "expression")
        self.assertEqual(result["kind"], "traversal")
        self.assertEqual(result["references"][0]["kind"], "variable")
        self.assertEqual(result["references"][0]["name"], "region")

    def test_function_calls(self) -> None:
        result = classify_value("length(var.list)")
        self.assertEqual(result["type"], "expression")
        self.assertEqual(result["kind"], "function_call")

    def test_template_expressions(self) -> None:
        result = classify_value('"${var.name}-suffix"')
        self.assertEqual(result["type"], "expression")
        self.assertEqual(result["kind"], "template")
        self.assertEqual(result["references"][0]["kind"], "variable")
        self.assertEqual(result["references"][0]["name"], "name")

    def test_conditional_expressions(self) -> None:
        result = classify_value('var.enabled ? "yes" : "no"')
        self.assertEqual(result["type"], "expression")
        self.assertEqual(result["kind"], "conditional")

    def test_splat_expressions(self) -> None:
        result = classify_value("aws_instance.web[*].id")
        self.assertEqual(result["type"], "expression")
        self.assertEqual(result["kind"], "splat")
        self.assertEqual(result["references"][0]["kind"], "resource")
        self.assertEqual(result["references"][0]["resource_type"], "aws_instance")
        self.assertEqual(result["references"][0]["name"], "web")
        self.assertTrue(result["references"][0].get("splat"))


class SpecialReferencesTest(unittest.TestCase):
    """Tests for special reference types."""

    def test_each_key_and_value(self) -> None:
        result = classify_value('"${each.key}-${each.value}"')
        refs = result["references"]
        self.assertTrue(any(r["kind"] == "each" and r["property"] == "key" for r in refs))
        self.assertTrue(any(r["kind"] == "each" and r["property"] == "value" for r in refs))

    def test_count_index(self) -> None:
        result = classify_value('"instance-${count.index}"')
        refs = result["references"]
        self.assertTrue(any(r["kind"] == "count" and r["property"] == "index" for r in refs))

    def test_self_references(self) -> None:
        result = classify_value("self.private_ip")
        refs = result["references"]
        self.assertTrue(any(r["kind"] == "self" and r["attribute"] == "private_ip" for r in refs))

    def test_path_references(self) -> None:
        result = classify_value("path.module")
        refs = result["references"]
        self.assertTrue(any(r["kind"] == "path" and r["name"] == "module" for r in refs))

    def test_data_references(self) -> None:
        result = classify_value("data.aws_ami.ubuntu.id")
        refs = result["references"]
        self.assertTrue(any(r["kind"] == "data" and r["data_type"] == "aws_ami" for r in refs))

    def test_module_output_references(self) -> None:
        result = classify_value("module.vpc.vpc_id")
        refs = result["references"]
        self.assertTrue(any(r["kind"] == "module_output" and r["module"] == "vpc" for r in refs))


class TypeConstraintParserTest(unittest.TestCase):
    """Tests for type constraint parsing."""

    def test_primitive_types(self) -> None:
        from parse_hcl import parse_type_constraint

        self.assertEqual(parse_type_constraint("string")["base"], "string")
        self.assertEqual(parse_type_constraint("number")["base"], "number")
        self.assertEqual(parse_type_constraint("bool")["base"], "bool")
        self.assertEqual(parse_type_constraint("any")["base"], "any")

    def test_collection_types(self) -> None:
        from parse_hcl import parse_type_constraint

        list_result = parse_type_constraint("list(string)")
        self.assertEqual(list_result["base"], "list")
        self.assertEqual(list_result["element"]["base"], "string")

        map_result = parse_type_constraint("map(number)")
        self.assertEqual(map_result["base"], "map")
        self.assertEqual(map_result["element"]["base"], "number")

    def test_nested_collection_types(self) -> None:
        from parse_hcl import parse_type_constraint

        result = parse_type_constraint("list(map(string))")
        self.assertEqual(result["base"], "list")
        self.assertEqual(result["element"]["base"], "map")
        self.assertEqual(result["element"]["element"]["base"], "string")

    def test_object_types(self) -> None:
        from parse_hcl import parse_type_constraint

        result = parse_type_constraint("object({ name = string, age = number })")
        self.assertEqual(result["base"], "object")
        self.assertIn("name", result["attributes"])
        self.assertIn("age", result["attributes"])
        self.assertEqual(result["attributes"]["name"]["base"], "string")
        self.assertEqual(result["attributes"]["age"]["base"], "number")

    def test_optional_attributes(self) -> None:
        from parse_hcl import parse_type_constraint

        result = parse_type_constraint("object({ name = string, age = optional(number) })")
        self.assertTrue(result["attributes"]["age"].get("optional"))

    def test_tuple_types(self) -> None:
        from parse_hcl import parse_type_constraint

        result = parse_type_constraint("tuple([string, number, bool])")
        self.assertEqual(result["base"], "tuple")
        self.assertEqual(len(result["elements"]), 3)
        self.assertEqual(result["elements"][0]["base"], "string")
        self.assertEqual(result["elements"][1]["base"], "number")
        self.assertEqual(result["elements"][2]["base"], "bool")


if __name__ == "__main__":
    unittest.main()
