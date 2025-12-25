/**
 * Value classifier for HCL expressions.
 * Classifies raw value strings into typed Value structures and extracts references.
 */

import {
    ArrayValue,
    ExpressionKind,
    ExpressionValue,
    LiteralValue,
    ObjectValue,
    Reference,
    Value
} from '../../types/blocks';
import { isEscaped, splitArrayElements, splitObjectEntries } from '../lexer/hclLexer';

/**
 * Pattern for matching traversal expressions (e.g., aws_instance.web.id).
 * Handles indexed access like resource[0].attr and splat expressions like resource[*].attr.
 */
const TRAVERSAL_PATTERN = /[A-Za-z_][\w-]*(?:\[(?:[^[\]]*|\*)])?(?:\.[A-Za-z_][\w-]*(?:\[(?:[^[\]]*|\*)])?)+/g;

/**
 * Pattern for matching splat expressions (e.g., aws_instance.web[*].id).
 */
const SPLAT_PATTERN = /\[\*]/g;

/**
 * Removes bracketed index notation (e.g., [0], ["key"], [*]) without using regex.
 * Falls back to returning the original string if brackets are unbalanced.
 */
function stripIndexNotation(part: string): string {
    const firstBracket = part.indexOf('[');
    if (firstBracket === -1) {
        return part;
    }

    let result = part.slice(0, firstBracket);
    let cursor = firstBracket;

    while (cursor < part.length) {
        const closingBracket = part.indexOf(']', cursor + 1);
        if (closingBracket === -1) {
            result += part.slice(cursor);
            break;
        }

        const nextBracket = part.indexOf('[', closingBracket + 1);
        if (nextBracket === -1) {
            result += part.slice(closingBracket + 1);
            break;
        }

        result += part.slice(closingBracket + 1, nextBracket);
        cursor = nextBracket;
    }

    return result;
}

/**
 * Classifies a raw HCL value string into a typed Value structure.
 * Supports literals, quoted strings, arrays, objects, and expressions.
 *
 * @param raw - The raw value string to classify
 * @returns The classified Value with type information and extracted references
 *
 * @example
 * ```typescript
 * classifyValue('true')           // LiteralValue { type: 'literal', value: true }
 * classifyValue('"hello"')        // LiteralValue { type: 'literal', value: 'hello' }
 * classifyValue('var.region')     // ExpressionValue with variable reference
 * classifyValue('[1, 2, 3]')      // ArrayValue with parsed elements
 * ```
 */
export function classifyValue(raw: string): Value {
    const trimmed = raw.trim();

    // Try literal classification first (booleans, numbers, null)
    const literal = classifyLiteral(trimmed);
    if (literal) {
        return literal;
    }

    // Handle quoted strings
    if (isQuotedString(trimmed)) {
        const inner = unquote(trimmed);
        if (inner.includes('${')) {
            return classifyExpression(inner, 'template');
        }
        return {
            type: 'literal',
            value: inner,
            raw: trimmed
        };
    }

    // Handle heredocs
    if (trimmed.startsWith('<<')) {
        return classifyExpression(trimmed, 'template');
    }

    // Handle arrays with recursive parsing
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        return classifyArray(trimmed);
    }

    // Handle objects with recursive parsing
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        return classifyObject(trimmed);
    }

    // Everything else is an expression
    return classifyExpression(trimmed);
}

/**
 * Classifies a raw value as a literal (boolean, number, or null).
 * @param raw - The trimmed raw value
 * @returns LiteralValue if it's a literal, null otherwise
 */
function classifyLiteral(raw: string): LiteralValue | null {
    // Boolean literals
    if (raw === 'true' || raw === 'false') {
        return {
            type: 'literal',
            value: raw === 'true',
            raw
        };
    }

    // Numeric literals (integer and float)
    if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(raw)) {
        return {
            type: 'literal',
            value: Number(raw),
            raw
        };
    }

    // Null literal
    if (raw === 'null') {
        return {
            type: 'literal',
            value: null,
            raw
        };
    }

    return null;
}

/**
 * Classifies and parses an array value with recursive element parsing.
 * @param raw - The raw array string including brackets
 * @returns ArrayValue with parsed elements and extracted references
 */
function classifyArray(raw: string): ArrayValue {
    const elements = splitArrayElements(raw);
    const parsedElements: Value[] = elements.map((elem) => classifyValue(elem));
    const references = collectReferences(parsedElements);

    return {
        type: 'array',
        value: parsedElements.length > 0 ? parsedElements : undefined,
        raw,
        references: references.length > 0 ? references : undefined
    };
}

/**
 * Classifies and parses an object value with recursive entry parsing.
 * @param raw - The raw object string including braces
 * @returns ObjectValue with parsed entries and extracted references
 */
function classifyObject(raw: string): ObjectValue {
    const entries = splitObjectEntries(raw);
    const parsedEntries: Record<string, Value> = {};

    for (const [key, value] of entries) {
        parsedEntries[key] = classifyValue(value);
    }

    const references = collectReferences(Object.values(parsedEntries));

    return {
        type: 'object',
        value: Object.keys(parsedEntries).length > 0 ? parsedEntries : undefined,
        raw,
        references: references.length > 0 ? references : undefined
    };
}

/**
 * Collects all references from an array of values.
 * @param values - Array of Value objects
 * @returns Deduplicated array of references
 */
function collectReferences(values: Value[]): Reference[] {
    const refs: Reference[] = [];

    for (const value of values) {
        if (value.type === 'expression' || value.type === 'array' || value.type === 'object') {
            if ((value as { references?: Reference[] }).references) {
                refs.push(...(value as { references: Reference[] }).references);
            }
        }

        // Recursively collect from nested structures
        if (value.type === 'array' && value.value) {
            refs.push(...collectReferences(value.value));
        }
        if (value.type === 'object' && value.value) {
            refs.push(...collectReferences(Object.values(value.value)));
        }
    }

    return uniqueReferences(refs);
}

/**
 * Classifies an expression and extracts its references.
 * @param raw - The raw expression string
 * @param forcedKind - Optional forced expression kind
 * @returns ExpressionValue with kind and references
 */
function classifyExpression(raw: string, forcedKind?: ExpressionKind): ExpressionValue {
    const kind = forcedKind || detectExpressionKind(raw);
    const references = extractExpressionReferences(raw, kind);

    return {
        type: 'expression',
        kind,
        raw,
        references: references.length > 0 ? references : undefined
    };
}

/**
 * Detects the kind of an expression based on its syntax.
 * @param raw - The raw expression string
 * @returns The detected ExpressionKind
 */
function detectExpressionKind(raw: string): ExpressionKind {
    // Template interpolation
    if (raw.includes('${')) {
        return 'template';
    }

    // Conditional (ternary) expression
    if (hasConditionalOperator(raw)) {
        return 'conditional';
    }

    // Function call
    if (/^[\w.-]+\(/.test(raw)) {
        return 'function_call';
    }

    // For expression (list or map comprehension)
    if (looksLikeForExpression(raw)) {
        return 'for_expr';
    }

    // Splat expression
    if (SPLAT_PATTERN.test(raw)) {
        return 'splat';
    }

    // Simple traversal (e.g., var.name, local.value)
    if (/^[\w.-]+(\[[^\]]*])?$/.test(raw)) {
        return 'traversal';
    }

    return 'unknown';
}

/**
 * Checks if an expression contains a conditional (ternary) operator.
 * Handles nested expressions and strings correctly.
 * @param raw - The raw expression string
 * @returns True if the expression is a conditional
 */
function hasConditionalOperator(raw: string): boolean {
    let depth = 0;
    let inString = false;
    let stringChar: string | null = null;
    let questionMarkFound = false;
    let questionMarkDepth = -1;

    for (let i = 0; i < raw.length; i++) {
        const char = raw[i];

        if (!inString) {
            if (char === '"' || char === "'") {
                inString = true;
                stringChar = char;
                continue;
            }

            if (char === '(' || char === '[' || char === '{') {
                depth++;
                continue;
            }

            if (char === ')' || char === ']' || char === '}') {
                depth--;
                continue;
            }

            // Look for ? at depth 0
            if (char === '?' && depth === 0) {
                questionMarkFound = true;
                questionMarkDepth = depth;
                continue;
            }

            // Look for : after ? at the same depth
            if (char === ':' && questionMarkFound && depth === questionMarkDepth) {
                return true;
            }
        } else {
            if (char === stringChar && !isEscaped(raw, i)) {
                inString = false;
                stringChar = null;
            }
        }
    }

    return false;
}

/**
 * Detects whether an expression resembles a list or map comprehension without using
 * potentially expensive regular expressions.
 * @param raw - The raw expression string
 * @returns True if the expression looks like a for-expression
 */
function looksLikeForExpression(raw: string): boolean {
    if (!(raw.startsWith('[') || raw.startsWith('{'))) {
        return false;
    }

    // Quick fail if there is no colon separator
    if (!raw.includes(':')) {
        return false;
    }

    const inner = raw.slice(1).trimStart();
    if (!inner.startsWith('for')) {
        return false;
    }

    let rest = inner.slice(3).trimStart();
    if (!rest) {
        return false;
    }

    const inMatch = rest.match(/\s+in\s+/);
    if (!inMatch || inMatch.index === undefined) {
        return false;
    }

    const afterIn = rest.slice(inMatch.index + inMatch[0].length);
    if (!afterIn.includes(':')) {
        return false;
    }

    const afterColon = afterIn.slice(afterIn.indexOf(':') + 1).trimStart();
    return afterColon.length > 0;
}

/**
 * Extracts references from an expression.
 * @param raw - The raw expression string
 * @param kind - The expression kind
 * @returns Array of extracted references
 */
function extractExpressionReferences(raw: string, kind: ExpressionKind): Reference[] {
    const baseRefs = extractReferencesFromText(raw);

    // For templates, also extract from interpolated expressions
    if (kind === 'template') {
        const interpolationMatches = extractInterpolations(raw);
        const innerRefs = interpolationMatches.flatMap((expr) => extractReferencesFromText(stripInterpolation(expr)));
        return uniqueReferences([...baseRefs, ...innerRefs]);
    }

    return baseRefs;
}

/**
 * Extracts all references from a text string.
 * Supports: var.*, local.*, module.*, data.*, resource references,
 * path.*, each.*, count.*, self.*
 *
 * @param raw - The raw text to extract references from
 * @returns Array of extracted references
 */
function extractReferencesFromText(raw: string): Reference[] {
    const refs: Reference[] = [];

    // Extract special references first (each, count, self)
    const specialRefs = extractSpecialReferences(raw);
    refs.push(...specialRefs);

    // Extract traversal-based references
    const matches = raw.match(TRAVERSAL_PATTERN) || [];

    for (const match of matches) {
        // Remove index notation for parsing, but track if it has splat
        const hasSplat = match.includes('[*]');
        const parts = match.split('.').map((part) => stripIndexNotation(part));

        // var.name
        if (parts[0] === 'var' && parts[1]) {
            refs.push({ kind: 'variable', name: parts[1] });
            continue;
        }

        // local.name
        if (parts[0] === 'local' && parts[1]) {
            refs.push({ kind: 'local', name: parts[1] });
            continue;
        }

        // module.name.output
        if (parts[0] === 'module' && parts[1]) {
            const attribute = parts.slice(2).join('.') || parts[1];
            refs.push({ kind: 'module_output', module: parts[1], name: attribute });
            continue;
        }

        // data.type.name
        if (parts[0] === 'data' && parts[1] && parts[2]) {
            const attribute = parts.slice(3).join('.') || undefined;
            refs.push({
                kind: 'data',
                data_type: parts[1],
                name: parts[2],
                attribute,
                splat: hasSplat || undefined
            });
            continue;
        }

        // path.module, path.root, path.cwd
        if (parts[0] === 'path' && parts[1]) {
            refs.push({ kind: 'path', name: parts[1] });
            continue;
        }

        // Skip special references (handled separately)
        if (parts[0] === 'each' || parts[0] === 'count' || parts[0] === 'self') {
            continue;
        }

        // resource.type.name (e.g., aws_instance.web.id)
        if (parts.length >= 2) {
            const [resourceType, resourceName, ...rest] = parts;
            const attribute = rest.length ? rest.join('.') : undefined;
            refs.push({
                kind: 'resource',
                resource_type: resourceType,
                name: resourceName,
                attribute,
                splat: hasSplat || undefined
            });
        }
    }

    return uniqueReferences(refs);
}

/**
 * Extracts special references: each.key, each.value, count.index, self.*
 * @param raw - The raw text to extract from
 * @returns Array of special references
 */
function extractSpecialReferences(raw: string): Reference[] {
    const refs: Reference[] = [];

    // each.key and each.value
    const eachMatches = raw.match(/\beach\.(key|value)\b/g) || [];
    for (const match of eachMatches) {
        const property = match.split('.')[1] as 'key' | 'value';
        refs.push({ kind: 'each', property });
    }

    // count.index
    if (/\bcount\.index\b/.test(raw)) {
        refs.push({ kind: 'count', property: 'index' });
    }

    // self.* (in provisioners)
    const selfMatches = raw.match(/\bself\.[\w-]+/g) || [];
    for (const match of selfMatches) {
        const attribute = match.split('.')[1];
        refs.push({ kind: 'self', attribute });
    }

    return refs;
}

/**
 * Extracts raw interpolation strings (e.g., ${foo.bar}) using simple scanning to
 * avoid backtracking risks from regular expressions.
 * @param raw - The raw template string
 * @returns Array of interpolation substrings including delimiters
 */
function extractInterpolations(raw: string): string[] {
    const matches: string[] = [];
    let searchIndex = 0;

    while (searchIndex < raw.length) {
        const start = raw.indexOf('${', searchIndex);
        if (start === -1) {
            break;
        }

        const end = raw.indexOf('}', start + 2);
        if (end === -1) {
            break;
        }

        matches.push(raw.slice(start, end + 1));
        searchIndex = end + 1;
    }

    return matches;
}

/**
 * Removes interpolation delimiters from a matched interpolation.
 * @param expr - The interpolation substring (e.g., ${foo})
 * @returns The inner expression without delimiters
 */
function stripInterpolation(expr: string): string {
    if (expr.startsWith('${') && expr.endsWith('}')) {
        return expr.slice(2, -1);
    }
    return expr;
}

/**
 * Removes duplicate references based on their JSON representation.
 * @param refs - Array of references (may contain duplicates)
 * @returns Deduplicated array of references
 */
function uniqueReferences(refs: Reference[]): Reference[] {
    const seen = new Set<string>();
    return refs.filter((ref) => {
        const key = JSON.stringify(ref);
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
}

/**
 * Checks if a value is a quoted string (single or double quotes).
 * @param value - The value to check
 * @returns True if the value is a quoted string
 */
function isQuotedString(value: string): boolean {
    return (value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"));
}

/**
 * Removes quotes from a quoted string and handles escape sequences.
 * @param value - The quoted string
 * @returns The unquoted string with escape sequences processed
 */
function unquote(value: string): string {
    const quote = value[0];
    const inner = value.slice(1, -1);

    // Process escape sequences
    let result = '';
    let i = 0;
    while (i < inner.length) {
        if (inner[i] === '\\' && i + 1 < inner.length) {
            const next = inner[i + 1];
            switch (next) {
                case 'n':
                    result += '\n';
                    i += 2;
                    continue;
                case 't':
                    result += '\t';
                    i += 2;
                    continue;
                case 'r':
                    result += '\r';
                    i += 2;
                    continue;
                case '\\':
                    result += '\\';
                    i += 2;
                    continue;
                case quote:
                    result += quote;
                    i += 2;
                    continue;
                default:
                    result += inner[i];
                    i++;
                    continue;
            }
        }
        result += inner[i];
        i++;
    }

    return result;
}
