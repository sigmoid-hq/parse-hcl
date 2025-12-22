import { ArrayValue, ExpressionKind, ExpressionValue, LiteralValue, ObjectValue, Reference, Value } from '../types/blocks';

export function classifyValue(raw: string): Value {
    const trimmed = raw.trim();

    const literal = classifyLiteral(trimmed);
    if (literal) {
        return literal;
    }

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

    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        return classifyArray(trimmed);
    }

    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        return classifyObject(trimmed);
    }

    return classifyExpression(trimmed);
}

function classifyLiteral(raw: string): LiteralValue | null {
    if (raw === 'true' || raw === 'false') {
        return {
            type: 'literal',
            value: raw === 'true',
            raw
        };
    }

    if (/^-?\d+(\.\d+)?$/.test(raw)) {
        return {
            type: 'literal',
            value: Number(raw),
            raw
        };
    }

    if (raw === 'null') {
        return {
            type: 'literal',
            value: null,
            raw
        };
    }

    return null;
}

function classifyArray(raw: string): ArrayValue {
    return {
        type: 'array',
        raw,
        references: parseTraversalReferences(raw)
    };
}

function classifyObject(raw: string): ObjectValue {
    return {
        type: 'object',
        raw,
        references: parseTraversalReferences(raw)
    };
}

function classifyExpression(raw: string, forcedKind?: ExpressionKind): ExpressionValue {
    const kind = forcedKind || detectExpressionKind(raw);
    const references = extractReferences(raw, kind);

    return {
        type: 'expression',
        kind,
        raw,
        references: references.length > 0 ? references : undefined
    };
}

function detectExpressionKind(raw: string): ExpressionKind {
    if (raw.includes('${')) {
        return 'template';
    }

    if (/^[\w.]+\(/.test(raw)) {
        return 'function_call';
    }

    if (/^\[\s*for\s+.+\s+in\s+.+:\s+/.test(raw) || /^\{\s*for\s+.+\s+in\s+.+:\s+/.test(raw)) {
        return 'for_expr';
    }

    if (/^[\w.]+$/.test(raw)) {
        return 'traversal';
    }

    return 'unknown';
}

function extractReferences(raw: string, kind: ExpressionKind): Reference[] {
    if (kind === 'template') {
        const inner = raw.match(/\${([^}]+)}/g);
        if (!inner) {
            return parseTraversalReferences(raw);
        }
        return inner.flatMap((expr) => parseTraversalReferences(expr.replace(/^\${|}$/g, '')));
    }

    if (kind === 'traversal' || kind === 'function_call' || kind === 'for_expr' || kind === 'unknown') {
        return parseTraversalReferences(raw);
    }

    return [];
}

function parseTraversalReferences(raw: string): Reference[] {
    const sanitized = raw.replace(/\[[^\]]*]/g, '');
    const matches = sanitized.match(/[A-Za-z_][\w]*(?:\.[A-Za-z_][\w]*)+/g) || [];
    const refs: Reference[] = [];

    for (const match of matches) {
        const parts = match.split('.');
        if (parts[0] === 'var' && parts[1]) {
            refs.push({ kind: 'variable', name: parts[1] });
            continue;
        }
        if (parts[0] === 'local' && parts[1]) {
            refs.push({ kind: 'local', name: parts[1] });
            continue;
        }
        if (parts[0] === 'module' && parts[1]) {
            const attribute = parts.slice(2).join('.') || undefined;
            refs.push({ kind: 'module_output', module: parts[1], name: attribute || parts[1] });
            continue;
        }
        if (parts[0] === 'data' && parts[1] && parts[2]) {
            const attribute = parts.slice(3).join('.') || parts[2];
            refs.push({ kind: 'data', data_type: parts[1], name: parts[2], attribute });
            continue;
        }
        if (parts[0] === 'path' && parts[1]) {
            refs.push({ kind: 'path', name: parts[1] });
            continue;
        }
        if (parts.length >= 2) {
            const [resourceType, resourceName, ...rest] = parts;
            const attribute = rest.length ? rest.join('.') : undefined;
            refs.push({ kind: 'resource', resource_type: resourceType, name: resourceName, attribute });
        }
    }

    return uniqueReferences(refs);
}

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

function isQuotedString(value: string): boolean {
    return (value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"));
}

function unquote(value: string): string {
    const quote = value[0];
    const inner = value.slice(1, -1);
    return inner.replace(new RegExp(`\\\\${quote}`, 'g'), quote);
}
