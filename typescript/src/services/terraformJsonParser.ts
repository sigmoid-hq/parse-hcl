import { createEmptyDocument, TerraformDocument, Value } from '../types/blocks';
import { readJsonFile } from '../utils/fs';
import { classifyValue } from '../utils/valueClassifier';

type JsonConfig = Record<string, unknown>;

export class TerraformJsonParser {
    parseFile(filePath: string): TerraformDocument {
        const json = readJsonFile<JsonConfig>(filePath);
        return this.parse(json, filePath);
    }

    parse(json: JsonConfig, source = 'json-config'): TerraformDocument {
        const doc = createEmptyDocument();

        this.parseTerraform(json.terraform, doc, source);
        this.parseProviders(json.provider, doc, source);
        this.parseVariables(json.variable, doc, source);
        this.parseOutputs(json.output, doc, source);
        this.parseLocals(json.locals, doc, source);
        this.parseModules(json.module, doc, source);
        this.parseResources(json.resource, doc, source);
        this.parseData(json.data, doc, source);

        return doc;
    }

    private parseTerraform(value: unknown, doc: TerraformDocument, source: string): void {
        if (!Array.isArray(value)) return;
        for (const item of value) {
            if (item && typeof item === 'object') {
                doc.terraform.push({
                    properties: convertAttributes(item as Record<string, unknown>),
                    raw: JSON.stringify(item),
                    source
                });
            }
        }
    }

    private parseProviders(value: unknown, doc: TerraformDocument, source: string): void {
        if (!value || typeof value !== 'object') return;
        for (const [name, config] of Object.entries(value as Record<string, unknown>)) {
            const configs = Array.isArray(config) ? config : [config];

            for (const aliasCfg of configs) {
                if (!isRecord(aliasCfg)) continue;
                const alias = typeof aliasCfg.alias === 'string' ? aliasCfg.alias : undefined;
                doc.provider.push({
                    name,
                    alias,
                    properties: convertAttributes(aliasCfg),
                    raw: JSON.stringify(aliasCfg),
                    source
                });
            }
        }
    }

    private parseVariables(value: unknown, doc: TerraformDocument, source: string): void {
        if (!value || typeof value !== 'object') return;
        for (const [name, config] of Object.entries(value as Record<string, unknown>)) {
            const cfg = (config as Record<string, unknown>) || {};
            doc.variable.push({
                name,
                description: typeof cfg.description === 'string' ? cfg.description : undefined,
                type: typeof cfg.type === 'string' ? cfg.type : undefined,
                default: cfg.default as unknown,
                validation: undefined,
                sensitive: typeof cfg.sensitive === 'boolean' ? cfg.sensitive : undefined,
                raw: JSON.stringify(cfg),
                source
            });
        }
    }

    private parseOutputs(value: unknown, doc: TerraformDocument, source: string): void {
        if (!value || typeof value !== 'object') return;
        for (const [name, config] of Object.entries(value as Record<string, unknown>)) {
            const cfg = (config as Record<string, unknown>) || {};
            doc.output.push({
                name,
                description: typeof cfg.description === 'string' ? cfg.description : undefined,
                value: convertJsonValue(cfg.value),
                sensitive: typeof cfg.sensitive === 'boolean' ? cfg.sensitive : undefined,
                raw: JSON.stringify(cfg),
                source
            });
        }
    }

    private parseLocals(value: unknown, doc: TerraformDocument, source: string): void {
        if (!value || typeof value !== 'object') return;
        for (const [name, val] of Object.entries(value as Record<string, unknown>)) {
            const converted = convertJsonValue(val);
            doc.locals.push({
                name,
                type: converted.type,
                value: converted,
                raw: converted.raw,
                source
            });
        }
    }

    private parseModules(value: unknown, doc: TerraformDocument, source: string): void {
        if (!value || typeof value !== 'object') return;
        for (const [name, config] of Object.entries(value as Record<string, unknown>)) {
            const cfg = (config as Record<string, unknown>) || {};
            doc.module.push({
                name,
                properties: convertAttributes(cfg),
                raw: JSON.stringify(cfg),
                source
            });
        }
    }

    private parseResources(value: unknown, doc: TerraformDocument, source: string): void {
        if (!value || typeof value !== 'object') return;
        for (const [type, resourceByName] of Object.entries(value as Record<string, unknown>)) {
            if (!resourceByName || typeof resourceByName !== 'object') continue;
            for (const [name, configList] of Object.entries(resourceByName as Record<string, unknown>)) {
                const items = Array.isArray(configList) ? configList : [configList];
                for (const cfg of items) {
                    if (!cfg || typeof cfg !== 'object') continue;
                    const parsed = convertAttributes(cfg as Record<string, unknown>);
                    doc.resource.push({
                        type,
                        name,
                        properties: parsed,
                        blocks: [],
                        dynamic_blocks: [],
                        meta: {},
                        raw: JSON.stringify(cfg),
                        source
                    });
                }
            }
        }
    }

    private parseData(value: unknown, doc: TerraformDocument, source: string): void {
        if (!value || typeof value !== 'object') return;
        for (const [dataType, dataByName] of Object.entries(value as Record<string, unknown>)) {
            if (!dataByName || typeof dataByName !== 'object') continue;
            for (const [name, configList] of Object.entries(dataByName as Record<string, unknown>)) {
                const items = Array.isArray(configList) ? configList : [configList];
                for (const cfg of items) {
                    if (!cfg || typeof cfg !== 'object') continue;
                    const parsed = convertAttributes(cfg as Record<string, unknown>);
                    doc.data.push({
                        dataType,
                        name,
                        properties: parsed,
                        blocks: [],
                        raw: JSON.stringify(cfg),
                        source
                    });
                }
            }
        }
    }
}

function convertAttributes(obj: Record<string, unknown>): Record<string, Value> {
    const out: Record<string, Value> = {};
    for (const [key, val] of Object.entries(obj)) {
        if (key === 'alias') continue;
        out[key] = convertJsonValue(val);
    }
    return out;
}

export function convertJsonValue(input: unknown): Value {
    if (input === null) {
        return { type: 'literal', value: null, raw: 'null' };
    }
    if (typeof input === 'string') {
        if (looksLikeExpression(input)) {
            return classifyValue(input);
        }
        return { type: 'literal', value: input, raw: input };
    }
    if (typeof input === 'number' || typeof input === 'boolean') {
        return { type: 'literal', value: input, raw: String(input) };
    }
    if (Array.isArray(input)) {
        return {
            type: 'array',
            value: input.map((item) => convertJsonValue(item)),
            raw: JSON.stringify(input)
        };
    }
    if (typeof input === 'object') {
        const entries = Object.entries(input as Record<string, unknown>);
        const value: Record<string, Value> = {};
        for (const [key, val] of entries) {
            value[key] = convertJsonValue(val);
        }
        return { type: 'object', value, raw: JSON.stringify(input) };
    }

    return { type: 'literal', value: String(input), raw: String(input) };
}

function looksLikeExpression(value: string): boolean {
    return value.includes('${') || /^[\w.]+\(/.test(value) || /^[\w.]+$/.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
