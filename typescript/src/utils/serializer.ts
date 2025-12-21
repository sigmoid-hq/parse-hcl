import { TerraformDocument } from '../types/blocks';
import { TerraformExport } from '../types/artifacts';
import { createExport } from './graphBuilder';
import { toYaml } from './yaml';

export function toJson(document: TerraformDocument): string {
    return JSON.stringify(document, null, 2);
}

export function toJsonExport(document: TerraformDocument): string {
    return JSON.stringify(createExport(document), null, 2);
}

export function toExport(document: TerraformDocument): TerraformExport {
    return createExport(document);
}

export function toYamlDocument(document: TerraformDocument): string {
    return toYaml(document);
}
