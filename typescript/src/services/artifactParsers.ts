import {
    PlanModule,
    PlanResource,
    PlanResourceChange,
    TerraformPlanDocument,
    TerraformStateDocument,
    TerraformStateInstance,
    TerraformStateOutput,
    TerraformStateResource,
    TfVarsDocument
} from '../types/artifacts';
import { Value } from '../types/blocks';
import { parseBlockBody } from '../utils/bodyParser';
import { readJsonFile, readTextFile } from '../utils/fs';
import { convertJsonValue } from './terraformJsonParser';

export class TfVarsParser {
    parseFile(filePath: string): TfVarsDocument {
        if (filePath.endsWith('.json')) {
            const json = readJsonFile<Record<string, unknown>>(filePath);
            const assignments: Record<string, Value> = {};
            for (const [key, val] of Object.entries(json)) {
                assignments[key] = convertJsonValue(val);
            }
            return {
                source: filePath,
                raw: JSON.stringify(json),
                assignments
            };
        }

        const raw = readTextFile(filePath);
        const parsed = parseBlockBody(raw);

        return {
            source: filePath,
            raw,
            assignments: parsed.attributes
        };
    }
}

export class TfStateParser {
    parseFile(filePath: string): TerraformStateDocument {
        const raw = readJsonFile<unknown>(filePath);
        return this.parse(raw, filePath);
    }

    parse(raw: unknown, source = ''): TerraformStateDocument {
        const data = (raw as Record<string, unknown>) || {};
        const resources = Array.isArray(data.resources) ? data.resources.map(normalizeStateResource) : [];
        const outputs = normalizeStateOutputs((data.outputs as Record<string, unknown>) || {});

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

export class TfPlanParser {
    parseFile(filePath: string): TerraformPlanDocument {
        const raw = readJsonFile<unknown>(filePath);
        return this.parse(raw, filePath);
    }

    parse(raw: unknown, source = ''): TerraformPlanDocument {
        const data = (raw as Record<string, unknown>) || {};
        const plannedValues = data.planned_values as Record<string, unknown> | undefined;
        const resourceChanges = Array.isArray(data.resource_changes) ? data.resource_changes : [];

        return {
            format_version: typeof data.format_version === 'string' ? data.format_version : undefined,
            terraform_version: typeof data.terraform_version === 'string' ? data.terraform_version : undefined,
            planned_values: plannedValues
                ? { root_module: normalizePlanModule((plannedValues.root_module as Record<string, unknown>) || {}) }
                : undefined,
            resource_changes: resourceChanges.map(normalizePlanResourceChange),
            raw,
            source
        };
    }
}

function normalizeStateOutputs(outputs: Record<string, unknown>): Record<string, TerraformStateOutput> {
    const result: Record<string, TerraformStateOutput> = {};

    for (const [name, value] of Object.entries(outputs)) {
        const output = value as Record<string, unknown>;
        result[name] = {
            value: output.value ?? value,
            type: output.type as TerraformStateOutput['type'],
            sensitive: Boolean(output.sensitive)
        };
    }

    return result;
}

function normalizeStateResource(resource: unknown): TerraformStateResource {
    const data = (resource as Record<string, unknown>) || {};
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

function normalizeStateInstance(instance: unknown): TerraformStateInstance {
    const data = (instance as Record<string, unknown>) || {};
    return {
        index_key:
            typeof data.index_key === 'string' || typeof data.index_key === 'number'
                ? data.index_key
                : typeof data.index === 'string' || typeof data.index === 'number'
                  ? data.index
                  : undefined,
        attributes: (data.attributes as Record<string, unknown>) || (data.attributes_flat as Record<string, unknown>),
        status: typeof data.status === 'string' ? data.status : undefined
    };
}

function normalizePlanModule(module: Record<string, unknown>): PlanModule {
    const resourcesRaw = Array.isArray(module.resources) ? module.resources : [];
    const childrenRaw = Array.isArray(module.child_modules) ? module.child_modules : [];

    return {
        address: typeof module.address === 'string' ? module.address : undefined,
        resources: resourcesRaw.map(normalizePlanResource),
        child_modules: childrenRaw.map((child) => normalizePlanModule((child as Record<string, unknown>) || {}))
    };
}

function normalizePlanResource(resource: unknown): PlanResource {
    const data = (resource as Record<string, unknown>) || {};
    const address = typeof data.address === 'string' ? data.address : undefined;

    return {
        address: address ?? buildAddress(data),
        mode: data.mode === 'data' ? 'data' : 'managed',
        type: typeof data.type === 'string' ? data.type : 'unknown',
        name: typeof data.name === 'string' ? data.name : 'unknown',
        provider_name: typeof data.provider_name === 'string' ? data.provider_name : undefined,
        values: (data.values as Record<string, unknown>) || undefined
    };
}

function normalizePlanResourceChange(change: unknown): PlanResourceChange {
    const data = (change as Record<string, unknown>) || {};
    const changeData = (data.change as Record<string, unknown>) || {};

    return {
        address: typeof data.address === 'string' ? data.address : buildAddress(data),
        module_address: typeof data.module_address === 'string' ? data.module_address : undefined,
        mode: data.mode === 'data' ? 'data' : 'managed',
        type: typeof data.type === 'string' ? data.type : 'unknown',
        name: typeof data.name === 'string' ? data.name : 'unknown',
        provider_name: typeof data.provider_name === 'string' ? data.provider_name : undefined,
        change: {
            actions: Array.isArray(changeData.actions) ? (changeData.actions as string[]) : [],
            before: changeData.before,
            after: changeData.after,
            after_unknown: (changeData.after_unknown as Record<string, unknown>) || undefined,
            before_sensitive: (changeData.before_sensitive as Record<string, unknown>) || undefined,
            after_sensitive: (changeData.after_sensitive as Record<string, unknown>) || undefined
        }
    };
}

function buildAddress(data: Record<string, unknown>): string {
    const mode = data.mode === 'data' ? 'data' : 'resource';
    const type = typeof data.type === 'string' ? data.type : 'unknown';
    const name = typeof data.name === 'string' ? data.name : 'unknown';
    return `${mode}.${type}.${name}`;
}
