"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TerraformJsonParser = void 0;
exports.convertJsonValue = convertJsonValue;
const blocks_1 = require("../types/blocks");
const fs_1 = require("../utils/fs");
const valueClassifier_1 = require("../utils/valueClassifier");
class TerraformJsonParser {
    parseFile(filePath) {
        const json = (0, fs_1.readJsonFile)(filePath);
        return this.parse(json, filePath);
    }
    parse(json, source = 'json-config') {
        const doc = (0, blocks_1.createEmptyDocument)();
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
    parseTerraform(value, doc, source) {
        if (!Array.isArray(value))
            return;
        for (const item of value) {
            if (item && typeof item === 'object') {
                doc.terraform.push({
                    properties: convertAttributes(item),
                    raw: JSON.stringify(item),
                    source
                });
            }
        }
    }
    parseProviders(value, doc, source) {
        if (!value || typeof value !== 'object')
            return;
        for (const [name, config] of Object.entries(value)) {
            const configs = Array.isArray(config) ? config : [config];
            for (const aliasCfg of configs) {
                if (!isRecord(aliasCfg))
                    continue;
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
    parseVariables(value, doc, source) {
        if (!value || typeof value !== 'object')
            return;
        for (const [name, config] of Object.entries(value)) {
            const cfg = config || {};
            doc.variable.push({
                name,
                description: typeof cfg.description === 'string' ? cfg.description : undefined,
                type: typeof cfg.type === 'string' ? cfg.type : undefined,
                default: cfg.default,
                validation: undefined,
                sensitive: typeof cfg.sensitive === 'boolean' ? cfg.sensitive : undefined,
                raw: JSON.stringify(cfg),
                source
            });
        }
    }
    parseOutputs(value, doc, source) {
        if (!value || typeof value !== 'object')
            return;
        for (const [name, config] of Object.entries(value)) {
            const cfg = config || {};
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
    parseLocals(value, doc, source) {
        if (!value || typeof value !== 'object')
            return;
        for (const [name, val] of Object.entries(value)) {
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
    parseModules(value, doc, source) {
        if (!value || typeof value !== 'object')
            return;
        for (const [name, config] of Object.entries(value)) {
            const cfg = config || {};
            doc.module.push({
                name,
                properties: convertAttributes(cfg),
                raw: JSON.stringify(cfg),
                source
            });
        }
    }
    parseResources(value, doc, source) {
        if (!value || typeof value !== 'object')
            return;
        for (const [type, resourceByName] of Object.entries(value)) {
            if (!resourceByName || typeof resourceByName !== 'object')
                continue;
            for (const [name, configList] of Object.entries(resourceByName)) {
                const items = Array.isArray(configList) ? configList : [configList];
                for (const cfg of items) {
                    if (!cfg || typeof cfg !== 'object')
                        continue;
                    const parsed = convertAttributes(cfg);
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
    parseData(value, doc, source) {
        if (!value || typeof value !== 'object')
            return;
        for (const [dataType, dataByName] of Object.entries(value)) {
            if (!dataByName || typeof dataByName !== 'object')
                continue;
            for (const [name, configList] of Object.entries(dataByName)) {
                const items = Array.isArray(configList) ? configList : [configList];
                for (const cfg of items) {
                    if (!cfg || typeof cfg !== 'object')
                        continue;
                    const parsed = convertAttributes(cfg);
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
exports.TerraformJsonParser = TerraformJsonParser;
function convertAttributes(obj) {
    const out = {};
    for (const [key, val] of Object.entries(obj)) {
        if (key === 'alias')
            continue;
        out[key] = convertJsonValue(val);
    }
    return out;
}
function convertJsonValue(input) {
    if (input === null) {
        return { type: 'literal', value: null, raw: 'null' };
    }
    if (typeof input === 'string') {
        if (looksLikeExpression(input)) {
            return (0, valueClassifier_1.classifyValue)(input);
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
        const entries = Object.entries(input);
        const value = {};
        for (const [key, val] of entries) {
            value[key] = convertJsonValue(val);
        }
        return { type: 'object', value, raw: JSON.stringify(input) };
    }
    return { type: 'literal', value: String(input), raw: String(input) };
}
function looksLikeExpression(value) {
    return value.includes('${') || /^[\w.]+\(/.test(value) || /^[\w.]+$/.test(value);
}
function isRecord(value) {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
