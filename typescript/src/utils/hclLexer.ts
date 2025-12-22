/**
 * Shared lexer utilities for HCL parsing.
 * Provides common functions for tokenization and string handling.
 */

/**
 * Result of reading a quoted string from source.
 */
export interface QuotedStringResult {
    /** The unquoted string content */
    text: string;
    /** The index after the closing quote */
    end: number;
}

/**
 * Result of reading a raw value from source.
 */
export interface ValueReadResult {
    /** The raw value text (trimmed) */
    raw: string;
    /** The index after the value */
    end: number;
}

/**
 * Checks if a character is a quote character (single or double).
 * @param char - The character to check
 * @returns True if the character is a quote
 */
export function isQuote(char: string | undefined): boolean {
    return char === '"' || char === "'";
}

/**
 * Checks if a character at a given position is escaped by counting preceding backslashes.
 * Handles consecutive backslashes correctly (e.g., \\\\ is two escaped backslashes).
 * @param text - The source text
 * @param index - The index of the character to check
 * @returns True if the character is escaped
 */
export function isEscaped(text: string, index: number): boolean {
    let backslashCount = 0;
    let pos = index - 1;
    while (pos >= 0 && text[pos] === '\\') {
        backslashCount++;
        pos--;
    }
    return backslashCount % 2 === 1;
}

/**
 * Skips whitespace and comments (line and block comments).
 * Handles //, /* *​/, and # style comments.
 * @param text - The source text
 * @param start - The starting index
 * @returns The index of the next non-whitespace, non-comment character
 */
export function skipWhitespaceAndComments(text: string, start: number): number {
    let index = start;
    const length = text.length;

    while (index < length) {
        const char = text[index];
        const next = text[index + 1];

        // Skip whitespace
        if (/\s/.test(char)) {
            index++;
            continue;
        }

        // Skip block comments /* ... */
        if (char === '/' && next === '*') {
            const end = text.indexOf('*/', index + 2);
            index = end === -1 ? length : end + 2;
            continue;
        }

        // Skip line comments // ...
        if (char === '/' && next === '/') {
            const end = text.indexOf('\n', index + 2);
            index = end === -1 ? length : end + 1;
            continue;
        }

        // Skip hash comments # ...
        if (char === '#') {
            const end = text.indexOf('\n', index + 1);
            index = end === -1 ? length : end + 1;
            continue;
        }

        break;
    }

    return index;
}

/**
 * Skips a quoted string, handling escape sequences correctly.
 * @param text - The source text
 * @param start - The index of the opening quote
 * @returns The index after the closing quote
 */
export function skipString(text: string, start: number): number {
    const quote = text[start];
    let index = start + 1;
    const length = text.length;

    while (index < length) {
        const char = text[index];
        if (char === quote && !isEscaped(text, index)) {
            return index + 1;
        }
        index++;
    }

    return length;
}

/**
 * Skips a heredoc string (<<EOF or <<-EOF style).
 * @param text - The source text
 * @param start - The index of the first '<'
 * @returns The index after the heredoc terminator
 */
export function skipHeredoc(text: string, start: number): number {
    const markerMatch = text.slice(start).match(/^<<-?\s*"?([A-Za-z0-9_]+)"?/);
    if (!markerMatch) {
        return start + 2;
    }

    const marker = markerMatch[1];
    const afterMarker = start + markerMatch[0].length;
    const terminatorIndex = text.indexOf(`\n${marker}`, afterMarker);

    if (terminatorIndex === -1) {
        return text.length;
    }

    const endOfTerminator = text.indexOf('\n', terminatorIndex + marker.length + 1);
    return endOfTerminator === -1 ? text.length : endOfTerminator + 1;
}

/**
 * Finds the matching closing brace for an opening brace.
 * Handles nested braces, strings, comments, and heredocs.
 * @param content - The source text
 * @param startIndex - The index of the opening brace
 * @returns The index of the matching closing brace, or -1 if not found
 */
export function findMatchingBrace(content: string, startIndex: number): number {
    let depth = 0;
    let index = startIndex;
    const length = content.length;

    while (index < length) {
        const char = content[index];
        const next = content[index + 1];

        // Skip quoted strings
        if (isQuote(char)) {
            index = skipString(content, index);
            continue;
        }

        // Skip block comments
        if (char === '/' && next === '*') {
            const end = content.indexOf('*/', index + 2);
            index = end === -1 ? length : end + 2;
            continue;
        }

        // Skip line comments
        if (char === '/' && next === '/') {
            const end = content.indexOf('\n', index + 2);
            index = end === -1 ? length : end + 1;
            continue;
        }

        // Skip hash comments
        if (char === '#') {
            const end = content.indexOf('\n', index + 1);
            index = end === -1 ? length : end + 1;
            continue;
        }

        // Skip heredocs
        if (char === '<' && next === '<') {
            index = skipHeredoc(content, index);
            continue;
        }

        // Track brace depth
        if (char === '{') {
            depth++;
        } else if (char === '}') {
            depth--;
            if (depth === 0) {
                return index;
            }
        }

        index++;
    }

    return -1;
}

/**
 * Finds the matching closing bracket for an opening bracket.
 * Handles nested brackets of all types [], {}, ().
 * @param content - The source text
 * @param startIndex - The index of the opening bracket
 * @param openChar - The opening bracket character
 * @param closeChar - The closing bracket character
 * @returns The index of the matching closing bracket, or -1 if not found
 */
export function findMatchingBracket(
    content: string,
    startIndex: number,
    openChar: string,
    closeChar: string
): number {
    let depth = 0;
    let index = startIndex;
    const length = content.length;

    while (index < length) {
        const char = content[index];
        const next = content[index + 1];

        // Skip quoted strings
        if (isQuote(char)) {
            index = skipString(content, index);
            continue;
        }

        // Skip block comments
        if (char === '/' && next === '*') {
            const end = content.indexOf('*/', index + 2);
            index = end === -1 ? length : end + 2;
            continue;
        }

        // Skip line comments
        if (char === '/' && next === '/') {
            const end = content.indexOf('\n', index + 2);
            index = end === -1 ? length : end + 1;
            continue;
        }

        // Skip hash comments
        if (char === '#') {
            const end = content.indexOf('\n', index + 1);
            index = end === -1 ? length : end + 1;
            continue;
        }

        // Track bracket depth
        if (char === openChar) {
            depth++;
        } else if (char === closeChar) {
            depth--;
            if (depth === 0) {
                return index;
            }
        }

        index++;
    }

    return -1;
}

/**
 * Reads an identifier from the source text.
 * Identifiers start with a letter or underscore, followed by letters, digits, underscores, or hyphens.
 * @param text - The source text
 * @param start - The starting index
 * @returns The identifier string, or empty string if no identifier found
 */
export function readIdentifier(text: string, start: number): string {
    const match = text.slice(start).match(/^[A-Za-z_][\w-]*/);
    return match ? match[0] : '';
}

/**
 * Reads an identifier that may contain dots (for attribute access).
 * @param text - The source text
 * @param start - The starting index
 * @returns The identifier string, or empty string if no identifier found
 */
export function readDottedIdentifier(text: string, start: number): string {
    const match = text.slice(start).match(/^[\w.-]+/);
    return match ? match[0] : '';
}

/**
 * Reads a quoted string and returns its unescaped content.
 * @param text - The source text
 * @param start - The index of the opening quote
 * @returns The unquoted string and the index after the closing quote
 */
export function readQuotedString(text: string, start: number): QuotedStringResult {
    const quote = text[start];
    let index = start + 1;
    let value = '';
    const length = text.length;

    while (index < length) {
        const char = text[index];

        if (char === quote && !isEscaped(text, index)) {
            return { text: value, end: index + 1 };
        }

        // Handle escape sequences
        if (char === '\\' && index + 1 < length) {
            const nextChar = text[index + 1];
            if (nextChar === quote || nextChar === '\\' || nextChar === 'n' || nextChar === 't' || nextChar === 'r') {
                switch (nextChar) {
                    case 'n':
                        value += '\n';
                        break;
                    case 't':
                        value += '\t';
                        break;
                    case 'r':
                        value += '\r';
                        break;
                    default:
                        value += nextChar;
                }
                index += 2;
                continue;
            }
        }

        value += char;
        index++;
    }

    return { text: value, end: length };
}

/**
 * Reads a value from HCL source (handles multiline values in brackets).
 * @param text - The source text
 * @param start - The starting index (after the '=' sign)
 * @returns The raw value text and the index after the value
 */
export function readValue(text: string, start: number): ValueReadResult {
    let index = skipWhitespaceAndComments(text, start);
    const valueStart = index;
    const length = text.length;

    // Handle heredocs
    if (text.slice(index, index + 2) === '<<') {
        const newlineIndex = text.indexOf('\n', index);
        const firstLine = newlineIndex === -1 ? text.slice(index) : text.slice(index, newlineIndex);
        const markerMatch = firstLine.match(/^<<-?\s*"?([A-Za-z0-9_]+)"?/);

        if (markerMatch) {
            const marker = markerMatch[1];
            const terminatorIndex = text.indexOf(`\n${marker}`, newlineIndex);
            if (terminatorIndex !== -1) {
                const endOfTerminator = text.indexOf('\n', terminatorIndex + marker.length + 1);
                const endIndex = endOfTerminator === -1 ? length : endOfTerminator;
                return { raw: text.slice(valueStart, endIndex).trim(), end: endIndex };
            }
        }
    }

    // Track bracket depth for multiline values
    let depth = 0;
    let inString = false;
    let stringChar: string | null = null;

    while (index < length) {
        const char = text[index];
        const next = text[index + 1];

        if (!inString) {
            // Enter string
            if (isQuote(char)) {
                inString = true;
                stringChar = char;
                index++;
                continue;
            }

            // Skip block comments
            if (char === '/' && next === '*') {
                const end = text.indexOf('*/', index + 2);
                index = end === -1 ? length : end + 2;
                continue;
            }

            // Skip line comments
            if (char === '/' && next === '/') {
                const end = text.indexOf('\n', index + 2);
                index = end === -1 ? length : end + 1;
                continue;
            }

            // Track brackets
            if (char === '{' || char === '[' || char === '(') {
                depth++;
            } else if (char === '}' || char === ']' || char === ')') {
                depth = Math.max(depth - 1, 0);
            }

            // End of value (newline at depth 0)
            if ((char === '\n' || char === '\r') && depth === 0) {
                break;
            }
        } else {
            // Exit string
            if (char === stringChar && !isEscaped(text, index)) {
                inString = false;
                stringChar = null;
            }
        }

        index++;
    }

    return { raw: text.slice(valueStart, index).trim(), end: index };
}

/**
 * Splits an array literal into its elements.
 * Handles nested arrays, objects, and strings correctly.
 * @param raw - The raw array string including brackets
 * @returns Array of raw element strings
 */
export function splitArrayElements(raw: string): string[] {
    const inner = raw.slice(1, -1).trim();
    if (!inner) {
        return [];
    }

    const elements: string[] = [];
    let current = '';
    let depth = 0;
    let inString = false;
    let stringChar: string | null = null;

    for (let i = 0; i < inner.length; i++) {
        const char = inner[i];

        if (!inString) {
            if (isQuote(char)) {
                inString = true;
                stringChar = char;
                current += char;
                continue;
            }

            if (char === '{' || char === '[' || char === '(') {
                depth++;
                current += char;
                continue;
            }

            if (char === '}' || char === ']' || char === ')') {
                depth--;
                current += char;
                continue;
            }

            if (char === ',' && depth === 0) {
                const trimmed = current.trim();
                if (trimmed) {
                    elements.push(trimmed);
                }
                current = '';
                continue;
            }

            current += char;
        } else {
            current += char;
            if (char === stringChar && !isEscaped(inner, i)) {
                inString = false;
                stringChar = null;
            }
        }
    }

    const trimmed = current.trim();
    if (trimmed) {
        elements.push(trimmed);
    }

    return elements;
}

/**
 * Splits an object literal into key-value pairs.
 * Handles nested objects, arrays, and strings correctly.
 * @param raw - The raw object string including braces
 * @returns Array of [key, value] tuples
 */
export function splitObjectEntries(raw: string): Array<[string, string]> {
    const inner = raw.slice(1, -1).trim();
    if (!inner) {
        return [];
    }

    const entries: Array<[string, string]> = [];
    let index = 0;
    const length = inner.length;

    while (index < length) {
        index = skipWhitespaceAndComments(inner, index);
        if (index >= length) break;

        // Read key (can be identifier or quoted string)
        let key: string;
        if (isQuote(inner[index])) {
            const result = readQuotedString(inner, index);
            key = result.text;
            index = result.end;
        } else {
            key = readDottedIdentifier(inner, index);
            index += key.length;
        }

        if (!key) {
            index++;
            continue;
        }

        index = skipWhitespaceAndComments(inner, index);

        // Expect = or :
        if (inner[index] === '=' || inner[index] === ':') {
            index++;
        }

        // Read value
        const valueResult = readObjectValue(inner, index);
        entries.push([key, valueResult.raw]);
        index = valueResult.end;

        // Skip comma if present
        index = skipWhitespaceAndComments(inner, index);
        if (inner[index] === ',') {
            index++;
        }
    }

    return entries;
}

/**
 * Reads a value within an object (stops at comma or closing brace).
 */
function readObjectValue(text: string, start: number): ValueReadResult {
    let index = skipWhitespaceAndComments(text, start);
    const valueStart = index;
    const length = text.length;

    let depth = 0;
    let inString = false;
    let stringChar: string | null = null;

    while (index < length) {
        const char = text[index];

        if (!inString) {
            if (isQuote(char)) {
                inString = true;
                stringChar = char;
                index++;
                continue;
            }

            if (char === '{' || char === '[' || char === '(') {
                depth++;
                index++;
                continue;
            }

            if (char === '}' || char === ']' || char === ')') {
                if (depth === 0) {
                    break;
                }
                depth--;
                index++;
                continue;
            }

            if ((char === ',' || char === '\n') && depth === 0) {
                break;
            }

            index++;
        } else {
            if (char === stringChar && !isEscaped(text, index)) {
                inString = false;
                stringChar = null;
            }
            index++;
        }
    }

    return { raw: text.slice(valueStart, index).trim(), end: index };
}
