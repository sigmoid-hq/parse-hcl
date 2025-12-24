"""Tests for HCL lexer utilities."""

import sys
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from parse_hcl.utils.lexer.hcl_lexer import (
    find_matching_brace,
    is_escaped,
    is_quote,
    read_identifier,
    read_quoted_string,
    skip_whitespace_and_comments,
    split_array_elements,
    split_object_entries,
)


class IsEscapedTest(unittest.TestCase):
    """Tests for is_escaped function."""

    def test_detects_escaped_characters(self) -> None:
        self.assertTrue(is_escaped('test\\"here', 5))
        self.assertFalse(is_escaped('test"here', 4))

    def test_handles_consecutive_backslashes(self) -> None:
        # \\\\" - quote is not escaped (even number of backslashes)
        self.assertFalse(is_escaped('test\\\\"here', 6))
        # \" - quote is escaped
        self.assertTrue(is_escaped('test\\"here', 5))

    def test_start_of_string(self) -> None:
        self.assertFalse(is_escaped('"test', 0))


class SplitArrayElementsTest(unittest.TestCase):
    """Tests for split_array_elements function."""

    def test_splits_simple_arrays(self) -> None:
        result = split_array_elements("[1, 2, 3]")
        self.assertEqual(result, ["1", "2", "3"])

    def test_handles_nested_arrays(self) -> None:
        result = split_array_elements("[[1, 2], [3, 4]]")
        self.assertEqual(result, ["[1, 2]", "[3, 4]"])

    def test_handles_strings_with_commas(self) -> None:
        result = split_array_elements('["a,b", "c,d"]')
        self.assertEqual(result, ['"a,b"', '"c,d"'])

    def test_handles_empty_arrays(self) -> None:
        result = split_array_elements("[]")
        self.assertEqual(result, [])

    def test_handles_mixed_types(self) -> None:
        result = split_array_elements('["a", 1, true, null]')
        self.assertEqual(len(result), 4)

    def test_handles_nested_objects(self) -> None:
        result = split_array_elements('[{a = 1}, {b = 2}]')
        self.assertEqual(len(result), 2)


class SplitObjectEntriesTest(unittest.TestCase):
    """Tests for split_object_entries function."""

    def test_splits_simple_objects(self) -> None:
        entries = split_object_entries("{ a = 1, b = 2 }")
        self.assertIn(("a", "1"), entries)
        self.assertIn(("b", "2"), entries)

    def test_handles_nested_objects(self) -> None:
        entries = split_object_entries("{ outer = { inner = 1 } }")
        self.assertEqual(entries[0][0], "outer")
        self.assertEqual(entries[0][1], "{ inner = 1 }")

    def test_handles_string_values(self) -> None:
        entries = split_object_entries('{ name = "test" }')
        self.assertEqual(entries[0][0], "name")
        self.assertEqual(entries[0][1], '"test"')

    def test_handles_empty_objects(self) -> None:
        entries = split_object_entries("{}")
        self.assertEqual(entries, [])


class FindMatchingBraceTest(unittest.TestCase):
    """Tests for find_matching_brace function."""

    def test_finds_matching_braces(self) -> None:
        self.assertEqual(find_matching_brace("{ content }", 0), 10)

    def test_handles_nested_braces(self) -> None:
        self.assertEqual(find_matching_brace("{ { inner } }", 0), 12)

    def test_handles_strings_with_braces(self) -> None:
        self.assertEqual(find_matching_brace('{ key = "{" }', 0), 12)

    def test_returns_minus_one_for_unmatched(self) -> None:
        self.assertEqual(find_matching_brace("{ unclosed", 0), -1)

    def test_handles_deeply_nested(self) -> None:
        result = find_matching_brace("{ a { b { c } } }", 0)
        self.assertEqual(result, 16)


class IsQuoteTest(unittest.TestCase):
    """Tests for is_quote function."""

    def test_double_quote(self) -> None:
        self.assertTrue(is_quote('"'))

    def test_single_quote(self) -> None:
        self.assertTrue(is_quote("'"))

    def test_non_quote(self) -> None:
        self.assertFalse(is_quote("a"))
        self.assertFalse(is_quote(""))


class ReadIdentifierTest(unittest.TestCase):
    """Tests for read_identifier function."""

    def test_reads_simple_identifier(self) -> None:
        result = read_identifier("resource", 0)
        self.assertEqual(result, "resource")

    def test_reads_identifier_with_underscore(self) -> None:
        result = read_identifier("my_resource", 0)
        self.assertEqual(result, "my_resource")

    def test_reads_identifier_from_offset(self) -> None:
        result = read_identifier("  variable", 2)
        self.assertEqual(result, "variable")

    def test_stops_at_non_identifier_char(self) -> None:
        result = read_identifier("resource {", 0)
        self.assertEqual(result, "resource")


class ReadQuotedStringTest(unittest.TestCase):
    """Tests for read_quoted_string function."""

    def test_reads_double_quoted(self) -> None:
        text, end = read_quoted_string('"hello"', 0)
        self.assertEqual(text, "hello")
        self.assertEqual(end, 7)

    def test_reads_single_quoted(self) -> None:
        text, end = read_quoted_string("'world'", 0)
        self.assertEqual(text, "world")
        self.assertEqual(end, 7)

    def test_handles_escaped_quotes(self) -> None:
        text, end = read_quoted_string('"say \\"hello\\""', 0)
        self.assertEqual(text, 'say "hello"')


class SkipWhitespaceAndCommentsTest(unittest.TestCase):
    """Tests for skip_whitespace_and_comments function."""

    def test_skips_spaces(self) -> None:
        result = skip_whitespace_and_comments("   content", 0)
        self.assertEqual(result, 3)

    def test_skips_line_comments(self) -> None:
        result = skip_whitespace_and_comments("# comment\ncontent", 0)
        self.assertEqual(result, 10)

    def test_skips_double_slash_comments(self) -> None:
        result = skip_whitespace_and_comments("// comment\ncontent", 0)
        self.assertEqual(result, 11)

    def test_skips_block_comments(self) -> None:
        result = skip_whitespace_and_comments("/* comment */content", 0)
        self.assertEqual(result, 13)

    def test_skips_mixed(self) -> None:
        result = skip_whitespace_and_comments("  # comment\n  content", 0)
        self.assertEqual(result, 14)


if __name__ == "__main__":
    unittest.main()
