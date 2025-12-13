import { TerraformDocument } from '../types/blocks';
import { toYaml } from './yaml';

export function toJson(document: TerraformDocument): string {
    return JSON.stringify(document, null, 2);
}

export function toYamlDocument(document: TerraformDocument): string {
    return toYaml(document);
}
