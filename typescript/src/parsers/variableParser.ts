/**
 * Parser for Terraform variable blocks.
 * Extracts variable declarations with type constraints, defaults, and validations.
 */

import { HclBlock, TypeConstraint, VariableBlock, VariableValidation } from '../types/blocks';
import { parseBlockBody } from '../utils/parser/bodyParser';
import { literalBoolean, literalString } from '../utils/common/valueHelpers';

/**
 * Parser for Terraform variable definition blocks.
 *
 * @example
 * ```hcl
 * variable "instance_type" {
 *   type        = string
 *   default     = "t2.micro"
 *   description = "EC2 instance type"
 *   sensitive   = false
 *
 *   validation {
 *     condition     = can(regex("^t[23]\\.", var.instance_type))
 *     error_message = "Must be a t2 or t3 instance type."
 *   }
 * }
 * ```
 */
export class VariableParser {
    /**
     * Parses a variable block into a structured VariableBlock.
     * @param block - The raw HCL block to parse
     * @returns Parsed VariableBlock with all extracted fields
     */
    parse(block: HclBlock): VariableBlock {
        const name = block.labels[0] || 'unknown';
        const parsed = parseBlockBody(block.body);

        const description = literalString(parsed.attributes.description) ?? parsed.attributes.description?.raw;
        const typeRaw = literalString(parsed.attributes.type) ?? parsed.attributes.type?.raw;
        const sensitive = literalBoolean(parsed.attributes.sensitive);
        const nullable = literalBoolean(parsed.attributes.nullable);
        const validation = this.extractValidation(parsed.blocks);

        // Parse type constraint if present
        const typeConstraint = typeRaw ? parseTypeConstraint(typeRaw) : undefined;

        return {
            name,
            description,
            type: typeRaw,
            typeConstraint,
            default: parsed.attributes.default,
            validation,
            sensitive,
            nullable,
            raw: block.raw,
            source: block.source
        };
    }

    /**
     * Extracts validation rules from nested validation blocks.
     * @param blocks - Nested blocks from the variable body
     * @returns VariableValidation if a validation block exists
     */
    private extractValidation(blocks: ReturnType<typeof parseBlockBody>['blocks']): VariableValidation | undefined {
        const validationBlock = blocks.find((child) => child.type === 'validation');
        if (!validationBlock) {
            return undefined;
        }

        const condition = validationBlock.attributes.condition;
        const errorMessage = validationBlock.attributes.error_message;

        if (!condition && !errorMessage) {
            return undefined;
        }

        return {
            condition,
            error_message: errorMessage
        };
    }
}

/**
 * Parses a Terraform type constraint expression into a structured TypeConstraint.
 *
 * Supports:
 * - Primitive types: string, number, bool, any
 * - Collection types: list(T), set(T), map(T)
 * - Structural types: object({ attr = type, ... }), tuple([type, ...])
 * - Optional attributes: optional(type)
 *
 * @param raw - The raw type expression string
 * @returns Parsed TypeConstraint
 *
 * @example
 * ```typescript
 * parseTypeConstraint('string')
 * // { base: 'string', raw: 'string' }
 *
 * parseTypeConstraint('list(string)')
 * // { base: 'list', element: { base: 'string', raw: 'string' }, raw: 'list(string)' }
 *
 * parseTypeConstraint('object({ name = string, age = optional(number) })')
 * // { base: 'object', attributes: { name: {...}, age: {...} }, raw: '...' }
 * ```
 */
export function parseTypeConstraint(raw: string): TypeConstraint {
    const trimmed = raw.trim();

    // Primitive types
    const primitives = ['string', 'number', 'bool', 'any'];
    if (primitives.includes(trimmed)) {
        return { base: trimmed, raw: trimmed };
    }

    // Check for collection types: list(T), set(T), map(T)
    const collectionMatch = matchWrappedKeyword(trimmed, ['list', 'set', 'map']);
    if (collectionMatch) {
        const { keyword: base, inner } = collectionMatch;
        return {
            base,
            element: parseTypeConstraint(inner),
            raw: trimmed
        };
    }

    // Check for optional(T)
    const optionalInner = extractWrappedType(trimmed, 'optional');
    if (optionalInner !== null) {
        const inner = parseTypeConstraint(optionalInner);
        return {
            ...inner,
            optional: true,
            raw: trimmed
        };
    }

    // Check for tuple([T1, T2, ...])
    const tupleMatch = trimmed.match(/^tuple\s*\(\s*\[([\s\S]*)\]\s*\)$/);
    if (tupleMatch) {
        const elements = parseTupleElements(tupleMatch[1]);
        const result: TypeConstraint = {
            base: 'tuple',
            raw: trimmed
        };
        if (elements.length > 0) {
            result.elements = elements;
        }
        return result;
    }

    // Check for object({ attr = type, ... })
    const objectMatch = trimmed.match(/^object\s*\(\s*\{([\s\S]*)\}\s*\)$/);
    if (objectMatch) {
        const attributes = parseObjectTypeAttributes(objectMatch[1]);
        return {
            base: 'object',
            attributes,
            raw: trimmed
        };
    }

    // Default: treat as unknown/complex type expression
    return { base: trimmed, raw: trimmed };
}

/**
 * Attempts to extract the inner portion of a keyword-wrapped type expression (e.g., list(...)).
 * @param trimmed - The trimmed raw type string
 * @param keywords - Keywords to try matching against
 * @returns Matched keyword and inner content if found, otherwise null
 */
function matchWrappedKeyword(trimmed: string, keywords: string[]): { keyword: string; inner: string } | null {
    for (const keyword of keywords) {
        const inner = extractWrappedType(trimmed, keyword);
        if (inner !== null) {
            return { keyword, inner };
        }
    }

    return null;
}

/**
 * Extracts inner content from a keyword-wrapped expression while respecting nested parentheses.
 * Returns null if the pattern does not match exactly or parentheses are unbalanced.
 * @param trimmed - The trimmed raw type string
 * @param keyword - The keyword to match (e.g., "list")
 * @returns Inner content if matched, otherwise null
 */
function extractWrappedType(trimmed: string, keyword: string): string | null {
    if (!trimmed.startsWith(keyword)) {
        return null;
    }

    let index = keyword.length;

    while (index < trimmed.length && isWhitespace(trimmed[index])) {
        index++;
    }

    if (index >= trimmed.length || trimmed[index] !== '(') {
        return null;
    }

    index++;
    let depth = 1;
    const start = index;

    while (index < trimmed.length && depth > 0) {
        const char = trimmed[index];
        if (char === '(') {
            depth++;
        } else if (char === ')') {
            depth--;
        }
        index++;
    }

    if (depth !== 0) {
        return null;
    }

    const inner = trimmed.slice(start, index - 1).trim();
    const remainder = trimmed.slice(index).trim();

    if (remainder.length > 0) {
        return null;
    }

    return inner;
}

/**
 * Parses tuple element types from the inner content of a tuple type.
 * @param inner - The content inside tuple([ ... ])
 * @returns Array of TypeConstraints for each element
 */
function parseTupleElements(inner: string): TypeConstraint[] {
    const elements: TypeConstraint[] = [];
    const trimmed = inner.trim();

    if (!trimmed) {
        return elements;
    }

    // Split by commas, respecting nested structures
    let depth = 0;
    let current = '';
    const entries: string[] = [];

    for (let i = 0; i < trimmed.length; i++) {
        const char = trimmed[i];

        if (char === '(' || char === '{' || char === '[') {
            depth++;
            current += char;
        } else if (char === ')' || char === '}' || char === ']') {
            depth--;
            current += char;
        } else if (char === ',' && depth === 0) {
            const entry = current.trim();
            if (entry) {
                entries.push(entry);
            }
            current = '';
        } else {
            current += char;
        }
    }

    // Don't forget the last entry
    const final = current.trim();
    if (final) {
        entries.push(final);
    }

    // Parse each element type
    for (const entry of entries) {
        elements.push(parseTypeConstraint(entry));
    }

    return elements;
}

/**
 * Parses object type attributes from the inner content of an object type.
 * @param inner - The content inside object({ ... })
 * @returns Record of attribute names to their TypeConstraints
 */
function parseObjectTypeAttributes(inner: string): Record<string, TypeConstraint> {
    const attributes: Record<string, TypeConstraint> = {};
    const trimmed = inner.trim();

    if (!trimmed) {
        return attributes;
    }

    // Simple parsing: split by commas (handling nested parentheses)
    let depth = 0;
    let current = '';
    const entries: string[] = [];

    for (let i = 0; i < trimmed.length; i++) {
        const char = trimmed[i];

        if (char === '(' || char === '{' || char === '[') {
            depth++;
            current += char;
        } else if (char === ')' || char === '}' || char === ']') {
            depth--;
            current += char;
        } else if (char === ',' && depth === 0) {
            entries.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }

    if (current.trim()) {
        entries.push(current.trim());
    }

    // Parse each entry (format: "name = type" or "name = optional(type)")
    for (const entry of entries) {
        const equalsIndex = entry.indexOf('=');
        if (equalsIndex === -1) {
            continue;
        }

        const attrName = entry.slice(0, equalsIndex).trim();
        const attrType = entry.slice(equalsIndex + 1).trim();

        if (!/^\w+$/.test(attrName) || !attrType) {
            continue;
        }

        attributes[attrName] = parseTypeConstraint(attrType);
    }

    return attributes;
}

/**
 * Determines if a character is whitespace without regex backtracking.
 * @param char - The character to evaluate
 * @returns True if whitespace
 */
function isWhitespace(char: string): boolean {
    return char === ' ' || char === '\t' || char === '\n' || char === '\r' || char === '\f';
}
