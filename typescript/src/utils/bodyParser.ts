/**
 * Parser for HCL block bodies.
 * Extracts attributes (key = value pairs) and nested blocks from block content.
 */

import { NestedBlock, ParsedBody, Value } from '../types/blocks';
import { classifyValue } from './valueClassifier';
import {
    findMatchingBrace,
    isQuote,
    readDottedIdentifier,
    readQuotedString,
    readValue,
    skipWhitespaceAndComments
} from './hclLexer';

/**
 * Parses an HCL block body into structured attributes and nested blocks.
 *
 * @param body - The raw block body content (without outer braces)
 * @returns ParsedBody containing attributes and nested blocks
 *
 * @example
 * ```typescript
 * const body = `
 *   name = "example"
 *   count = 5
 *   tags {
 *     env = "prod"
 *   }
 * `;
 * const parsed = parseBlockBody(body);
 * // parsed.attributes: { name: Value, count: Value }
 * // parsed.blocks: [{ type: 'tags', ... }]
 * ```
 */
export function parseBlockBody(body: string): ParsedBody {
    const attributes: Record<string, Value> = {};
    const blocks: NestedBlock[] = [];

    let index = 0;
    const length = body.length;

    while (index < length) {
        index = skipWhitespaceAndComments(body, index);

        if (index >= length) break;

        const identifierStart = index;
        const identifier = readDottedIdentifier(body, index);

        if (!identifier) {
            index++;
            continue;
        }

        index += identifier.length;
        index = skipWhitespaceAndComments(body, index);

        // Check for attribute assignment (key = value)
        if (body[index] === '=') {
            const { raw, end } = readValue(body, index + 1);
            attributes[identifier] = classifyValue(raw);
            index = end;
            continue;
        }

        // Check for nested block with labels
        const labels: string[] = [];
        while (isQuote(body[index])) {
            const { text, end } = readQuotedString(body, index);
            labels.push(text);
            index = skipWhitespaceAndComments(body, end);
        }

        // Check for nested block opening brace
        if (body[index] === '{') {
            const closeIndex = findMatchingBrace(body, index);
            const innerBody = body.slice(index + 1, closeIndex);
            const parsed = parseBlockBody(innerBody);
            const raw = body.slice(identifierStart, closeIndex + 1);

            blocks.push({
                type: identifier,
                labels,
                attributes: parsed.attributes,
                blocks: parsed.blocks,
                raw
            });

            index = closeIndex + 1;
            continue;
        }

        // Not recognized, skip character and continue
        index++;
    }

    return { attributes, blocks };
}
