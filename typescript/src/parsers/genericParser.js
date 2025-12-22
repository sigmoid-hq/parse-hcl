"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GenericBlockParser = exports.DataParser = exports.ResourceParser = exports.ModuleParser = exports.ProviderParser = exports.TerraformSettingsParser = void 0;
const bodyParser_1 = require("../utils/bodyParser");
const valueHelpers_1 = require("../utils/valueHelpers");
const META_KEYS = new Set(['count', 'for_each', 'provider', 'depends_on']);
class TerraformSettingsParser {
    parse(block) {
        const parsed = (0, bodyParser_1.parseBlockBody)(block.body);
        return {
            properties: parsed.attributes,
            raw: block.raw,
            source: block.source
        };
    }
}
exports.TerraformSettingsParser = TerraformSettingsParser;
class ProviderParser {
    parse(block) {
        const name = block.labels[0] || 'default';
        const parsed = (0, bodyParser_1.parseBlockBody)(block.body);
        return {
            name,
            alias: (0, valueHelpers_1.literalString)(parsed.attributes.alias) ?? parsed.attributes.alias?.raw,
            properties: parsed.attributes,
            raw: block.raw,
            source: block.source
        };
    }
}
exports.ProviderParser = ProviderParser;
class ModuleParser {
    parse(block) {
        const name = block.labels[0] || 'unnamed';
        const parsed = (0, bodyParser_1.parseBlockBody)(block.body);
        return {
            name,
            properties: parsed.attributes,
            raw: block.raw,
            source: block.source
        };
    }
}
exports.ModuleParser = ModuleParser;
class ResourceParser {
    parse(block) {
        const [type, name] = block.labels;
        const parsed = (0, bodyParser_1.parseBlockBody)(block.body);
        const meta = {};
        const properties = {};
        for (const [key, value] of Object.entries(parsed.attributes)) {
            if (META_KEYS.has(key)) {
                meta[key] = value;
            }
            else {
                properties[key] = value;
            }
        }
        return {
            type: type || 'unknown',
            name: name || 'unnamed',
            properties,
            blocks: parsed.blocks.filter((child) => child.type !== 'dynamic'),
            dynamic_blocks: this.extractDynamicBlocks(parsed.blocks),
            meta,
            raw: block.raw,
            source: block.source
        };
    }
    extractDynamicBlocks(blocks) {
        const dynamicBlocks = [];
        for (const block of blocks) {
            if (block.type !== 'dynamic') {
                continue;
            }
            const label = block.labels[0] || 'dynamic';
            const for_each = block.attributes.for_each;
            const iterator = (0, valueHelpers_1.literalString)(block.attributes.iterator);
            const contentBlock = block.blocks.find((child) => child.type === 'content');
            dynamicBlocks.push({
                label,
                for_each,
                iterator,
                content: contentBlock?.attributes || {},
                raw: block.raw
            });
        }
        return dynamicBlocks;
    }
}
exports.ResourceParser = ResourceParser;
class DataParser {
    parse(block) {
        const [dataType, name] = block.labels;
        const parsed = (0, bodyParser_1.parseBlockBody)(block.body);
        return {
            dataType: dataType || 'unknown',
            name: name || 'unnamed',
            properties: parsed.attributes,
            blocks: parsed.blocks,
            raw: block.raw,
            source: block.source
        };
    }
}
exports.DataParser = DataParser;
class GenericBlockParser {
    parse(block) {
        const parsed = (0, bodyParser_1.parseBlockBody)(block.body);
        return {
            type: block.keyword,
            labels: block.labels,
            properties: parsed.attributes,
            blocks: parsed.blocks,
            raw: block.raw,
            source: block.source
        };
    }
}
exports.GenericBlockParser = GenericBlockParser;
