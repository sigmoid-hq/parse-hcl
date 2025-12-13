import { AttributeKind, AttributeValue } from '../types/blocks';

export function classifyValue(raw: string): AttributeValue {
    const trimmed = raw.trim();

    if (!trimmed) {
        return { kind: 'expression', raw: trimmed };
    }

    if (isQuoted(trimmed)) {
        return {
            kind: 'string',
            raw: trimmed,
            value: unquote(trimmed)
        };
    }

    if (trimmed === 'true' || trimmed === 'false') {
        return {
            kind: 'bool',
            raw: trimmed,
            value: trimmed === 'true'
        };
    }

    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
        return {
            kind: 'number',
            raw: trimmed,
            value: Number(trimmed)
        };
    }

    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        return {
            kind: 'array',
            raw: trimmed
        };
    }

    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        return {
            kind: 'object',
            raw: trimmed
        };
    }

    return {
        kind: 'expression',
        raw: trimmed
    };
}

function isQuoted(value: string): boolean {
    return (value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"));
}

function unquote(value: string): string {
    const quote = value[0];
    const inner = value.slice(1, -1);
    return inner.replace(new RegExp(`\\\\${quote}`, 'g'), quote);
}

export function mergeKind(primary: AttributeKind, fallback: AttributeKind): AttributeKind {
    return primary || fallback;
}
