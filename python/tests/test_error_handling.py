"""Tests for error handling utilities."""

import sys
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from parse_hcl import ParseError, SourceLocation, SourceRange, offset_to_location, offsets_to_range
from parse_hcl.utils.lexer.block_scanner import BlockScanner


class ParseErrorTest(unittest.TestCase):
    """Tests for ParseError class."""

    def test_creates_error_with_location(self) -> None:
        location = SourceLocation(line=5, column=10, offset=50)
        error = ParseError("Test error", "test.tf", location)

        self.assertIn("Test error", str(error))
        self.assertIn("test.tf:5:10", str(error))
        self.assertEqual(error.location.line, 5)
        self.assertEqual(error.location.column, 10)

    def test_error_message_format(self) -> None:
        location = SourceLocation(line=1, column=1, offset=0)
        error = ParseError("Syntax error", "main.tf", location)

        message = str(error)
        self.assertIn("Syntax error", message)
        self.assertIn("main.tf", message)


class OffsetToLocationTest(unittest.TestCase):
    """Tests for offset_to_location function."""

    def test_calculates_line_and_column(self) -> None:
        content = "line1\nline2\nline3"

        # Start of file
        loc0 = offset_to_location(content, 0)
        self.assertEqual(loc0.line, 1)
        self.assertEqual(loc0.column, 1)

        # Start of second line
        loc6 = offset_to_location(content, 6)
        self.assertEqual(loc6.line, 2)
        self.assertEqual(loc6.column, 1)

        # Middle of second line
        loc8 = offset_to_location(content, 8)
        self.assertEqual(loc8.line, 2)
        self.assertEqual(loc8.column, 3)

    def test_handles_empty_string(self) -> None:
        loc = offset_to_location("", 0)
        self.assertEqual(loc.line, 1)
        self.assertEqual(loc.column, 1)

    def test_handles_single_line(self) -> None:
        content = "hello world"
        loc = offset_to_location(content, 6)
        self.assertEqual(loc.line, 1)
        self.assertEqual(loc.column, 7)


class OffsetsToRangeTest(unittest.TestCase):
    """Tests for offsets_to_range function."""

    def test_calculates_range(self) -> None:
        content = "line1\nline2\nline3"
        range_obj = offsets_to_range(content, 0, 10)

        self.assertEqual(range_obj.start.line, 1)
        self.assertEqual(range_obj.end.line, 2)


class BlockScannerStrictModeTest(unittest.TestCase):
    """Tests for BlockScanner strict mode."""

    def test_throws_parse_error_in_strict_mode(self) -> None:
        scanner = BlockScanner()
        content = 'resource "test" "name" { unclosed'

        with self.assertRaises(ParseError):
            scanner.scan(content, "test.tf", strict=True)

    def test_returns_empty_in_non_strict_mode(self) -> None:
        scanner = BlockScanner()
        content = 'resource "test" "name" { unclosed'

        blocks = scanner.scan(content, "test.tf", strict=False)
        self.assertEqual(blocks, [])

    def test_default_is_non_strict(self) -> None:
        scanner = BlockScanner()
        content = 'resource "test" "name" { unclosed'

        # Should not raise
        blocks = scanner.scan(content, "test.tf")
        self.assertEqual(blocks, [])


if __name__ == "__main__":
    unittest.main()
