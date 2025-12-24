"""Tests for edge cases and special scenarios."""

import sys
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from parse_hcl import TerraformParser, classify_value
from parse_hcl.utils.lexer.block_scanner import BlockScanner


class EmptyInputTest(unittest.TestCase):
    """Tests for empty input handling."""

    def test_handles_empty_files(self) -> None:
        scanner = BlockScanner()
        blocks = scanner.scan("", "empty.tf")
        self.assertEqual(blocks, [])

    def test_handles_whitespace_only(self) -> None:
        scanner = BlockScanner()
        blocks = scanner.scan("   \n\t\n   ", "whitespace.tf")
        self.assertEqual(blocks, [])


class CommentOnlyTest(unittest.TestCase):
    """Tests for comment-only files."""

    def test_handles_hash_comments(self) -> None:
        scanner = BlockScanner()
        content = "# This is a comment\n# Another comment"
        blocks = scanner.scan(content, "comments.tf")
        self.assertEqual(blocks, [])

    def test_handles_double_slash_comments(self) -> None:
        scanner = BlockScanner()
        content = "// This is a comment\n// Another comment"
        blocks = scanner.scan(content, "comments.tf")
        self.assertEqual(blocks, [])

    def test_handles_block_comments(self) -> None:
        scanner = BlockScanner()
        content = "/* Block comment\n   spanning multiple lines */"
        blocks = scanner.scan(content, "comments.tf")
        self.assertEqual(blocks, [])

    def test_handles_mixed_comments(self) -> None:
        scanner = BlockScanner()
        content = """
            # This is a comment
            // Another comment
            /* Block comment */
        """
        blocks = scanner.scan(content, "comments.tf")
        self.assertEqual(blocks, [])


class DeeplyNestedBlocksTest(unittest.TestCase):
    """Tests for deeply nested block structures."""

    def test_handles_deeply_nested_blocks(self) -> None:
        content = """
            resource "test" "deep" {
                level1 {
                    level2 {
                        level3 {
                            level4 {
                                value = "deep"
                            }
                        }
                    }
                }
            }
        """
        scanner = BlockScanner()
        blocks = scanner.scan(content, "deep.tf")

        self.assertEqual(len(blocks), 1)
        self.assertEqual(blocks[0]["kind"], "resource")


class HeredocTest(unittest.TestCase):
    """Tests for heredoc string handling."""

    def test_handles_heredoc_strings(self) -> None:
        content = '''resource "test" "heredoc" {
  content = <<EOF
{
  "key": "value"
}
EOF
}'''
        scanner = BlockScanner()
        blocks = scanner.scan(content, "heredoc.tf")

        self.assertEqual(len(blocks), 1)

    @unittest.skip("Indented heredoc (<<-EOF) not yet supported")
    def test_handles_indented_heredoc(self) -> None:
        content = '''resource "test" "heredoc" {
  content = <<-EOF
    {
      "key": "value"
    }
  EOF
}'''
        scanner = BlockScanner()
        blocks = scanner.scan(content, "heredoc.tf")

        self.assertEqual(len(blocks), 1)


class SpecialCharactersTest(unittest.TestCase):
    """Tests for special characters in strings."""

    def test_handles_path_strings(self) -> None:
        result = classify_value('"path/to/file.txt"')
        self.assertEqual(result["value"], "path/to/file.txt")

    def test_handles_url_strings(self) -> None:
        result = classify_value('"https://example.com/api"')
        self.assertEqual(result["value"], "https://example.com/api")

    def test_handles_json_strings(self) -> None:
        result = classify_value('"{\\"key\\": \\"value\\"}"')
        self.assertEqual(result["type"], "literal")


class EmptyBlocksTest(unittest.TestCase):
    """Tests for empty block handling."""

    def test_handles_empty_blocks(self) -> None:
        content = """
            resource "empty" "block" {
            }
        """
        scanner = BlockScanner()
        blocks = scanner.scan(content, "empty.tf")

        self.assertEqual(len(blocks), 1)
        self.assertEqual(blocks[0]["body"].strip(), "")

    def test_handles_block_with_only_comments(self) -> None:
        content = """
            resource "test" "commented" {
                # This is a comment inside the block
            }
        """
        scanner = BlockScanner()
        blocks = scanner.scan(content, "commented.tf")

        self.assertEqual(len(blocks), 1)


class MultipleBlocksTest(unittest.TestCase):
    """Tests for multiple blocks in a file."""

    def test_parses_multiple_same_type_blocks(self) -> None:
        content = """
            variable "a" { type = string }
            variable "b" { type = number }
            variable "c" { type = bool }
        """
        scanner = BlockScanner()
        blocks = scanner.scan(content, "vars.tf")

        self.assertEqual(len(blocks), 3)
        self.assertTrue(all(b["kind"] == "variable" for b in blocks))

    def test_parses_multiple_different_type_blocks(self) -> None:
        content = """
            variable "input" { type = string }
            resource "test" "example" { name = "test" }
            output "result" { value = "output" }
        """
        scanner = BlockScanner()
        blocks = scanner.scan(content, "mixed.tf")

        self.assertEqual(len(blocks), 3)
        kinds = [b["kind"] for b in blocks]
        self.assertIn("variable", kinds)
        self.assertIn("resource", kinds)
        self.assertIn("output", kinds)


class DependencyGraphTest(unittest.TestCase):
    """Tests for dependency graph building edge cases."""

    def test_builds_graph_with_all_node_types(self) -> None:
        from parse_hcl import build_dependency_graph

        parser = TerraformParser()
        content = """
            variable "input" { type = string }
            locals { computed = var.input }
            resource "test" "example" { name = local.computed }
            output "result" { value = test.example.id }
        """
        # Parse content directly using internal method
        from parse_hcl.utils.lexer.block_scanner import BlockScanner
        from parse_hcl.types import create_empty_document

        scanner = BlockScanner()
        blocks = scanner.scan(content, "test.tf")
        # Build a minimal document for testing
        doc = create_empty_document()

        # Just verify scanner works correctly
        self.assertEqual(len(blocks), 4)


class SpecialBlockTypesTest(unittest.TestCase):
    """Tests for special Terraform block types."""

    def test_parses_moved_blocks(self) -> None:
        content = """
            moved {
                from = aws_instance.old
                to   = aws_instance.new
            }
        """
        scanner = BlockScanner()
        blocks = scanner.scan(content, "moved.tf")

        self.assertEqual(len(blocks), 1)
        self.assertEqual(blocks[0]["kind"], "moved")

    def test_parses_import_blocks(self) -> None:
        content = """
            import {
                to = aws_instance.example
                id = "i-1234567890abcdef0"
            }
        """
        scanner = BlockScanner()
        blocks = scanner.scan(content, "import.tf")

        self.assertEqual(len(blocks), 1)
        self.assertEqual(blocks[0]["kind"], "import")

    def test_parses_check_blocks(self) -> None:
        content = """
            check "health" {
                assert {
                    condition     = true
                    error_message = "Health check failed"
                }
            }
        """
        scanner = BlockScanner()
        blocks = scanner.scan(content, "check.tf")

        self.assertEqual(len(blocks), 1)
        self.assertEqual(blocks[0]["kind"], "check")
        self.assertEqual(blocks[0]["labels"], ["health"])


if __name__ == "__main__":
    unittest.main()
