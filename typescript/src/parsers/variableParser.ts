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
    const collectionMatch = trimmed.match(/^(list|set|map)\s*\(\s*([\s\S]*)\s*\)$/);
    if (collectionMatch) {
        const [, base, inner] = collectionMatch;
        return {
            base,
            element: parseTypeConstraint(inner),
            raw: trimmed
        };
    }

    // Check for optional(T)
    const optionalMatch = trimmed.match(/^optional\s*\(\s*([\s\S]*)\s*\)$/);
    if (optionalMatch) {
        const inner = parseTypeConstraint(optionalMatch[1]);
        return {
            ...inner,
            optional: true,
            raw: trimmed
        };
    }

    // Check for tuple([T1, T2, ...])
    const tupleMatch = trimmed.match(/^tuple\s*\(\s*\[([\s\S]*)\]\s*\)$/);
    if (tupleMatch) {
        // For tuples, we store element types as a special structure
        // Using 'element' to store the first type for simplicity
        return {
            base: 'tuple',
            raw: trimmed
        };
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
        const match = entry.match(/^(\w+)\s*=\s*([\s\S]+)$/);
        if (match) {
            const [, attrName, attrType] = match;
            attributes[attrName] = parseTypeConstraint(attrType);
        }
    }

    return attributes;
}
