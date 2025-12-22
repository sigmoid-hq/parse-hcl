"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toJson = toJson;
exports.toJsonExport = toJsonExport;
exports.toExport = toExport;
exports.toYamlDocument = toYamlDocument;
const graphBuilder_1 = require("./graphBuilder");
const yaml_1 = require("./yaml");
function toJson(document, options) {
    const value = shouldPrune(options) && isTerraformDocument(document) ? pruneDocument(document) : document;
    return JSON.stringify(value, null, 2);
}
function toJsonExport(document, options) {
    return JSON.stringify(toExport(document, options), null, 2);
}
function toExport(document, options) {
    const exportPayload = (0, graphBuilder_1.createExport)(document);
    const prunedDocument = shouldPrune(options) ? pruneDocument(document) : document;
    return { ...exportPayload, document: prunedDocument };
}
function toYamlDocument(document, options) {
    const value = shouldPrune(options) && isTerraformDocument(document) ? pruneDocument(document) : document;
    return (0, yaml_1.toYaml)(value);
}
function shouldPrune(options) {
    return options?.pruneEmpty !== false;
}
function pruneDocument(document) {
    return pruneValue(document) ?? {};
}
function pruneValue(value) {
    if (value === null || value === undefined) {
        return undefined;
    }
    if (Array.isArray(value)) {
        const items = value
            .map((item) => pruneValue(item))
            .filter((item) => item !== undefined);
        return items.length > 0 ? items : undefined;
    }
    if (typeof value === 'object') {
        const entries = Object.entries(value);
        const pruned = {};
        for (const [key, val] of entries) {
            const next = pruneValue(val);
            if (next === undefined) {
                continue;
            }
            if (Array.isArray(next) && next.length === 0) {
                continue;
            }
            if (typeof next === 'object' && next !== null && Object.keys(next).length === 0) {
                continue;
            }
            pruned[key] = next;
        }
        return Object.keys(pruned).length > 0 ? pruned : undefined;
    }
    return value;
}
function isTerraformDocument(doc) {
    return Boolean(doc && typeof doc === 'object' && 'resource' in doc);
}
