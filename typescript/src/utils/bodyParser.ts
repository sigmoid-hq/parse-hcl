import { NestedBlock, ParsedBody, Value } from '../types/blocks';
import { classifyValue } from './valueClassifier';

export function parseBlockBody(body: string): ParsedBody {
    const attributes: Record<string, Value> = {};
    const blocks: NestedBlock[] = [];

    let index = 0;
    const length = body.length;

    while (index < length) {
        index = skipWhitespaceAndComments(body, index);
        const identifierStart = index;
        const identifier = readIdentifier(body, index);

        if (!identifier) {
            index += 1;
            continue;
        }

        index += identifier.length;
        index = skipWhitespaceAndComments(body, index);

        if (body[index] === '=') {
            const { raw, end } = readValue(body, index + 1);
            attributes[identifier] = classifyValue(raw);
            index = end;
            continue;
        }

        const labels: string[] = [];
        while (body[index] === '"' || body[index] === "'") {
            const { text, end } = readQuotedString(body, index);
            labels.push(text);
            index = skipWhitespaceAndComments(body, end);
        }

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

        index += 1;
    }

    return { attributes, blocks };
}

function skipWhitespaceAndComments(text: string, start: number): number {
    let index = start;
    while (index < text.length) {
        const char = text[index];
        const next = text[index + 1];

        if (/\s/.test(char)) {
            index += 1;
            continue;
        }

        if (char === '/' && next === '*') {
            const end = text.indexOf('*/', index + 2);
            index = end === -1 ? text.length : end + 2;
            continue;
        }

        if (char === '/' && next === '/') {
            const end = text.indexOf('\n', index + 2);
            index = end === -1 ? text.length : end + 1;
            continue;
        }

        if (char === '#') {
            const end = text.indexOf('\n', index + 1);
            index = end === -1 ? text.length : end + 1;
            continue;
        }

        break;
    }

    return index;
}

function readIdentifier(text: string, start: number): string {
    const match = text.slice(start).match(/^[\w.-]+/);
    return match ? match[0] : '';
}

function readQuotedString(text: string, start: number): { text: string; end: number } {
    const quote = text[start];
    let index = start + 1;
    let value = '';

    while (index < text.length) {
        const char = text[index];
        const prev = text[index - 1];
        if (char === quote && prev !== '\\') {
            return { text: value, end: index + 1 };
        }
        value += char;
        index += 1;
    }

    return { text: value, end: text.length };
}

function readValue(text: string, start: number): { raw: string; end: number } {
    let index = skipWhitespaceAndComments(text, start);
    const valueStart = index;

    if (text.slice(index, index + 2) === '<<') {
        const newlineIndex = text.indexOf('\n', index);
        const firstLine = newlineIndex === -1 ? text.slice(index) : text.slice(index, newlineIndex);
        const markerMatch = firstLine.match(/^<<-?\s*"?([A-Za-z0-9_]+)"?/);

        if (markerMatch) {
            const marker = markerMatch[1];
            const terminatorIndex = text.indexOf(`\n${marker}`, newlineIndex);
            if (terminatorIndex !== -1) {
                const endOfTerminator = text.indexOf('\n', terminatorIndex + marker.length + 1);
                const endIndex = endOfTerminator === -1 ? text.length : endOfTerminator;
                const rawValue = text.slice(valueStart, endIndex);
                return { raw: rawValue.trim(), end: endIndex };
            }
        }
    }

    let depth = 0;
    let inString = false;
    let stringChar: string | null = null;

    while (index < text.length) {
        const char = text[index];
        const next = text[index + 1];
        const prev = text[index - 1];

        if (!inString) {
            if (char === '"' || char === "'") {
                inString = true;
                stringChar = char;
                index += 1;
                continue;
            }

            if (char === '/' && next === '*') {
                const end = text.indexOf('*/', index + 2);
                index = end === -1 ? text.length : end + 2;
                continue;
            }

            if (char === '/' && next === '/') {
                const end = text.indexOf('\n', index + 2);
                index = end === -1 ? text.length : end + 1;
                continue;
            }

            if (char === '{' || char === '[' || char === '(') {
                depth += 1;
            } else if (char === '}' || char === ']' || char === ')') {
                depth = Math.max(depth - 1, 0);
            }

            if ((char === '\n' || char === '\r') && depth === 0) {
                break;
            }
        } else if (char === stringChar && prev !== '\\') {
            inString = false;
            stringChar = null;
        }

        index += 1;
    }

    const raw = text.slice(valueStart, index).trim();
    return { raw, end: index };
}

function findMatchingBrace(content: string, startIndex: number): number {
    let depth = 0;
    let inString = false;
    let stringChar: string | null = null;

    for (let i = startIndex; i < content.length; i += 1) {
        const char = content[i];
        const next = content[i + 1];
        const prev = content[i - 1];

        if (!inString) {
            if (char === '"' || char === "'") {
                inString = true;
                stringChar = char;
                continue;
            }

            if (char === '/' && next === '*') {
                const end = content.indexOf('*/', i + 2);
                if (end === -1) {
                    return content.length - 1;
                }
                i = end + 1;
                continue;
            }

            if (char === '/' && next === '/') {
                const end = content.indexOf('\n', i + 2);
                i = end === -1 ? content.length : end;
                continue;
            }

            if (char === '#') {
                const end = content.indexOf('\n', i + 1);
                i = end === -1 ? content.length : end;
                continue;
            }

            if (char === '{') {
                depth += 1;
            } else if (char === '}') {
                depth -= 1;
                if (depth === 0) {
                    return i;
                }
            }
        } else if (char === stringChar && prev !== '\\') {
            inString = false;
            stringChar = null;
        }
    }

    return content.length - 1;
}
