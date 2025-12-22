import { TerraformDocument } from '../types/blocks';
import { TerraformExport } from '../types/artifacts';
import { createExport } from './graphBuilder';
import { toYaml } from './yaml';

export function toJson(document: TerraformDocument): string {
    return JSON.stringify(pruneDocument(document), null, 2);
}

export function toJsonExport(document: TerraformDocument): string {
    return JSON.stringify(toExport(document), null, 2);
}

export function toExport(document: TerraformDocument): TerraformExport {
    const exportPayload = createExport(document);
    return { ...exportPayload, document: pruneDocument(document) };
}

export function toYamlDocument(document: TerraformDocument): string {
    return toYaml(pruneDocument(document));
}

function pruneDocument(document: TerraformDocument): Partial<TerraformDocument> {
    const entries = Object.entries(document) as [keyof TerraformDocument, unknown][];
    const pruned: Partial<TerraformDocument> = {};

    for (const [key, value] of entries) {
        if (Array.isArray(value) && value.length === 0) {
            continue;
        }
        (pruned as Record<string, unknown>)[key] = value;
    }

    return pruned;
}
