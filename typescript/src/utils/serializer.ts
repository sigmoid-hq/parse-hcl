import { TerraformDocument } from '../types/blocks';
import { TerraformExport } from '../types/artifacts';
import { createExport } from './graphBuilder';
import { toYaml } from './yaml';

export interface SerializeOptions {
    pruneEmpty?: boolean;
}

export function toJson(document: TerraformDocument | unknown, options?: SerializeOptions): string {
    const value = shouldPrune(options) && isTerraformDocument(document) ? pruneDocument(document) : document;
    return JSON.stringify(value, null, 2);
}

export function toJsonExport(document: TerraformDocument, options?: SerializeOptions): string {
    return JSON.stringify(toExport(document, options), null, 2);
}

export function toExport(document: TerraformDocument, options?: SerializeOptions): TerraformExport {
    const exportPayload = createExport(document);
    const prunedDocument = shouldPrune(options) ? pruneDocument(document) : document;
    return { ...exportPayload, document: prunedDocument };
}

export function toYamlDocument(document: TerraformDocument | unknown, options?: SerializeOptions): string {
    const value = shouldPrune(options) && isTerraformDocument(document) ? pruneDocument(document) : document;
    return toYaml(value);
}

function shouldPrune(options?: SerializeOptions): boolean {
    return options?.pruneEmpty !== false;
}

function pruneDocument(document: TerraformDocument): Partial<TerraformDocument> {
    return (pruneValue(document) as Partial<TerraformDocument>) ?? {};
}

function pruneValue(value: unknown): unknown {
    if (value === null || value === undefined) {
        return undefined;
    }

    if (Array.isArray(value)) {
        const items = value
            .map((item) => pruneValue(item))
            .filter((item) => item !== undefined) as unknown[];
        return items.length > 0 ? items : undefined;
    }

    if (typeof value === 'object') {
        const entries = Object.entries(value as Record<string, unknown>);
        const pruned: Record<string, unknown> = {};

        for (const [key, val] of entries) {
            const next = pruneValue(val);
            if (next === undefined) {
                continue;
            }

            if (Array.isArray(next) && next.length === 0) {
                continue;
            }
            if (typeof next === 'object' && next !== null && Object.keys(next as Record<string, unknown>).length === 0) {
                continue;
            }

            pruned[key] = next;
        }

        return Object.keys(pruned).length > 0 ? pruned : undefined;
    }

    return value;
}

function isTerraformDocument(doc: unknown): doc is TerraformDocument {
    return Boolean(doc && typeof doc === 'object' && 'resource' in (doc as Record<string, unknown>));
}
