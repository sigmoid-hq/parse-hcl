/**
 * Scanner for identifying top-level HCL blocks in Terraform configuration files.
 * Handles block detection, label extraction, and body isolation.
 */

import { BlockKind, HclBlock } from '../../types/blocks';
import { ParseError, offsetToLocation } from '../common/errors';
import {
    findMatchingBrace,
    isQuote,
    readIdentifier,
    readQuotedString,
    skipString,
    skipWhitespaceAndComments
} from './hclLexer';
import { logger } from '../common/logger';

/**
 * Set of known Terraform block types.
 * Unknown block types are categorized as 'unknown'.
 */
const KNOWN_BLOCKS = new Set([
    'terraform',
    'locals',
    'provider',
    'variable',
    'output',
    'module',
    'resource',
    'data',
    'moved',
    'import',
    'check',
    'terraform_data'
]);

/**
 * Options for block scanning.
 */
export interface ScanOptions {
    /** Whether to throw ParseError on syntax errors (default: false, logs warning instead) */
    strict?: boolean;
}

/**
 * Scanner for extracting top-level HCL blocks from Terraform files.
 *
 * @example
 * ```typescript
 * const scanner = new BlockScanner();
 * const blocks = scanner.scan(hclContent, 'main.tf');
 * for (const block of blocks) {
 *   console.log(`Found ${block.kind} block: ${block.labels.join('.')}`);
 * }
 * ```
 */
export class BlockScanner {
    /**
     * Scans HCL content and extracts all top-level blocks.
     *
     * @param content - The HCL source content to scan
     * @param source - The source file path (for error reporting)
     * @param options - Scanning options
     * @returns Array of parsed HCL blocks
     * @throws {ParseError} If strict mode is enabled and syntax errors are found
     */
    scan(content: string, source: string, options?: ScanOptions): HclBlock[] {
        const blocks: HclBlock[] = [];
        const length = content.length;
        let index = 0;
        const strict = options?.strict ?? false;

        while (index < length) {
            index = skipWhitespaceAndComments(content, index);

            // Skip standalone strings (not part of block headers)
            if (isQuote(content[index])) {
                index = skipString(content, index);
                continue;
            }

            const identifierStart = index;
            const keyword = readIdentifier(content, index);

            if (!keyword) {
                index++;
                continue;
            }

            index += keyword.length;
            index = skipWhitespaceAndComments(content, index);

            // Read block labels (quoted strings)
            const labels: string[] = [];
            while (isQuote(content[index])) {
                const { text, end } = readQuotedString(content, index);
                labels.push(text);
                index = skipWhitespaceAndComments(content, end);
            }

            // Check for opening brace
            if (content[index] !== '{') {
                // Not a block header, continue searching
                index = identifierStart + keyword.length;
                continue;
            }

            const braceIndex = index;
            const endIndex = findMatchingBrace(content, braceIndex);

            if (endIndex === -1) {
                const location = offsetToLocation(content, braceIndex);
                const message = `Unclosed block '${keyword}': missing closing '}'`;

                if (strict) {
                    throw new ParseError(message, source, location);
                }

                logger.warn(`${message} in ${source}:${location.line}:${location.column}`);
                break;
            }

            const raw = normalizeRaw(content.slice(identifierStart, endIndex + 1));
            const body = content.slice(braceIndex + 1, endIndex);
            const kind = (KNOWN_BLOCKS.has(keyword) ? keyword : 'unknown') as BlockKind;

            blocks.push({
                kind,
                keyword,
                labels,
                body: body.trim(),
                raw,
                source
            });

            index = endIndex + 1;
        }

        return blocks;
    }
}

/**
 * Normalizes raw block content for consistent formatting.
 * - Removes common leading indentation
 * - Normalizes whitespace around '=' operators
 * - Trims trailing whitespace from lines
 *
 * @param raw - The raw block content
 * @returns Normalized block content
 */
function normalizeRaw(raw: string): string {
    const trimmed = raw.trim();
    const lines = trimmed.split(/\r?\n/);

    if (lines.length === 1) {
        return lines[0];
    }

    // Calculate minimum indentation (excluding first line and empty lines)
    const indents = lines
        .slice(1)
        .filter((line) => line.trim().length > 0)
        .map((line) => (line.match(/^(\s*)/)?.[1].length ?? 0));
    const minIndent = indents.length ? Math.min(...indents) : 0;

    // Normalize alignment around '=' operators
    const normalizeAlignment = (line: string): string =>
        line
            .replace(/\s{2,}=\s*/g, ' = ')
            .replace(/\s*=\s{2,}/g, ' = ')
            .trimEnd();

    const normalized = lines.map((line, index) => {
        const withoutIndent = index === 0 ? line.trimStart() : line.slice(Math.min(minIndent, line.length));
        return normalizeAlignment(withoutIndent);
    });

    return normalized.join('\n');
}
