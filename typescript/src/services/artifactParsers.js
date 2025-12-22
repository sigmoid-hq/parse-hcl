"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TfPlanParser = exports.TfStateParser = exports.TfVarsParser = void 0;
const bodyParser_1 = require("../utils/bodyParser");
const fs_1 = require("../utils/fs");
const terraformJsonParser_1 = require("./terraformJsonParser");
class TfVarsParser {
    parseFile(filePath) {
        if (filePath.endsWith('.json')) {
            const json = (0, fs_1.readJsonFile)(filePath);
            const assignments = {};
            for (const [key, val] of Object.entries(json)) {
                assignments[key] = (0, terraformJsonParser_1.convertJsonValue)(val);
            }
            return {
                source: filePath,
                raw: JSON.stringify(json),
                assignments
            };
        }
        const raw = (0, fs_1.readTextFile)(filePath);
        const parsed = (0, bodyParser_1.parseBlockBody)(raw);
        return {
            source: filePath,
            raw,
            assignments: parsed.attributes
        };
    }
}
exports.TfVarsParser = TfVarsParser;
class TfStateParser {
    parseFile(filePath) {
        const raw = (0, fs_1.readJsonFile)(filePath);
        return this.parse(raw, filePath);
    }
    parse(raw, source = '') {
        const data = raw || {};
        const resources = Array.isArray(data.resources) ? data.resources.map(normalizeStateResource) : [];
        const outputs = normalizeStateOutputs(data.outputs || {});
        return {
            version: typeof data.version === 'number' ? data.version : Number(data.version) || 0,
            terraform_version: typeof data.terraform_version === 'string' ? data.terraform_version : undefined,
            serial: typeof data.serial === 'number' ? data.serial : undefined,
            lineage: typeof data.lineage === 'string' ? data.lineage : undefined,
            outputs,
            resources,
            raw,
            source
        };
    }
}
exports.TfStateParser = TfStateParser;
class TfPlanParser {
    parseFile(filePath) {
        const raw = (0, fs_1.readJsonFile)(filePath);
        return this.parse(raw, filePath);
    }
    parse(raw, source = '') {
        const data = raw || {};
        const plannedValues = data.planned_values;
        const resourceChanges = Array.isArray(data.resource_changes) ? data.resource_changes : [];
        return {
            format_version: typeof data.format_version === 'string' ? data.format_version : undefined,
            terraform_version: typeof data.terraform_version === 'string' ? data.terraform_version : undefined,
            planned_values: plannedValues
                ? { root_module: normalizePlanModule(plannedValues.root_module || {}) }
                : undefined,
            resource_changes: resourceChanges.map(normalizePlanResourceChange),
            raw,
            source
        };
    }
}
exports.TfPlanParser = TfPlanParser;
function normalizeStateOutputs(outputs) {
    const result = {};
    for (const [name, value] of Object.entries(outputs)) {
        const output = value;
        result[name] = {
            value: output.value ?? value,
            type: output.type,
            sensitive: Boolean(output.sensitive)
        };
    }
    return result;
}
function normalizeStateResource(resource) {
    const data = resource || {};
    const instancesRaw = Array.isArray(data.instances) ? data.instances : [];
    return {
        module: typeof data.module === 'string' ? data.module : undefined,
        mode: data.mode === 'data' ? 'data' : 'managed',
        type: typeof data.type === 'string' ? data.type : 'unknown',
        name: typeof data.name === 'string' ? data.name : 'unknown',
        provider: typeof data.provider === 'string' ? data.provider : undefined,
        instances: instancesRaw.map(normalizeStateInstance)
    };
}
function normalizeStateInstance(instance) {
    const data = instance || {};
    return {
        index_key: typeof data.index_key === 'string' || typeof data.index_key === 'number'
            ? data.index_key
            : typeof data.index === 'string' || typeof data.index === 'number'
                ? data.index
                : undefined,
        attributes: data.attributes || data.attributes_flat,
        status: typeof data.status === 'string' ? data.status : undefined
    };
}
function normalizePlanModule(module) {
    const resourcesRaw = Array.isArray(module.resources) ? module.resources : [];
    const childrenRaw = Array.isArray(module.child_modules) ? module.child_modules : [];
    return {
        address: typeof module.address === 'string' ? module.address : undefined,
        resources: resourcesRaw.map(normalizePlanResource),
        child_modules: childrenRaw.map((child) => normalizePlanModule(child || {}))
    };
}
function normalizePlanResource(resource) {
    const data = resource || {};
    const address = typeof data.address === 'string' ? data.address : undefined;
    return {
        address: address ?? buildAddress(data),
        mode: data.mode === 'data' ? 'data' : 'managed',
        type: typeof data.type === 'string' ? data.type : 'unknown',
        name: typeof data.name === 'string' ? data.name : 'unknown',
        provider_name: typeof data.provider_name === 'string' ? data.provider_name : undefined,
        values: data.values || undefined
    };
}
function normalizePlanResourceChange(change) {
    const data = change || {};
    const changeData = data.change || {};
    return {
        address: typeof data.address === 'string' ? data.address : buildAddress(data),
        module_address: typeof data.module_address === 'string' ? data.module_address : undefined,
        mode: data.mode === 'data' ? 'data' : 'managed',
        type: typeof data.type === 'string' ? data.type : 'unknown',
        name: typeof data.name === 'string' ? data.name : 'unknown',
        provider_name: typeof data.provider_name === 'string' ? data.provider_name : undefined,
        change: {
            actions: Array.isArray(changeData.actions) ? changeData.actions : [],
            before: changeData.before,
            after: changeData.after,
            after_unknown: changeData.after_unknown || undefined,
            before_sensitive: changeData.before_sensitive || undefined,
            after_sensitive: changeData.after_sensitive || undefined
        }
    };
}
function buildAddress(data) {
    const mode = data.mode === 'data' ? 'data' : 'resource';
    const type = typeof data.type === 'string' ? data.type : 'unknown';
    const name = typeof data.name === 'string' ? data.name : 'unknown';
    return `${mode}.${type}.${name}`;
}
