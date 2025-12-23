import { Value } from '../../types/blocks';

export function literalString(value?: Value): string | undefined {
    if (value?.type === 'literal' && typeof value.value === 'string') {
        return value.value;
    }
    return undefined;
}

export function literalBoolean(value?: Value): boolean | undefined {
    if (value?.type === 'literal' && typeof value.value === 'boolean') {
        return value.value;
    }
    return undefined;
}

export function literalNumber(value?: Value): number | undefined {
    if (value?.type === 'literal' && typeof value.value === 'number') {
        return value.value;
    }
    return undefined;
}
