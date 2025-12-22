import {
    DataBlock,
    GenericBlock,
    ModuleBlock,
    ProviderBlock,
    ResourceBlock,
    TerraformSettingsBlock
} from '../types/blocks';
import { HclBlock } from '../types/blocks';
import { parseBlockBody } from '../utils/bodyParser';
import { literalString } from '../utils/valueHelpers';

const META_KEYS = new Set(['count', 'for_each', 'provider', 'depends_on']);

export class TerraformSettingsParser {
    parse(block: HclBlock): TerraformSettingsBlock {
        const parsed = parseBlockBody(block.body);
        return {
            properties: parsed.attributes,
            raw: block.raw,
            source: block.source
        };
    }
}

export class ProviderParser {
    parse(block: HclBlock): ProviderBlock {
        const name = block.labels[0] || 'default';
        const parsed = parseBlockBody(block.body);

        return {
            name,
            alias: literalString(parsed.attributes.alias) ?? parsed.attributes.alias?.raw,
            properties: parsed.attributes,
            raw: block.raw,
            source: block.source
        };
    }
}

export class ModuleParser {
    parse(block: HclBlock): ModuleBlock {
        const name = block.labels[0] || 'unnamed';
        const parsed = parseBlockBody(block.body);

        return {
            name,
            properties: parsed.attributes,
            raw: block.raw,
            source: block.source
        };
    }
}

export class ResourceParser {
    parse(block: HclBlock): ResourceBlock {
        const [type, name] = block.labels;
        const parsed = parseBlockBody(block.body);
        const meta: ResourceBlock['meta'] = {};
        const properties: ResourceBlock['properties'] = {};

        for (const [key, value] of Object.entries(parsed.attributes)) {
            if (META_KEYS.has(key)) {
                meta[key] = value;
            } else {
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

    private extractDynamicBlocks(blocks: ReturnType<typeof parseBlockBody>['blocks']): ResourceBlock['dynamic_blocks'] {
        const dynamicBlocks: ResourceBlock['dynamic_blocks'] = [];

        for (const block of blocks) {
            if (block.type !== 'dynamic') {
                continue;
            }

            const label = block.labels[0] || 'dynamic';
            const for_each = block.attributes.for_each;
            const iterator = literalString(block.attributes.iterator);
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

export class DataParser {
    parse(block: HclBlock): DataBlock {
        const [dataType, name] = block.labels;
        const parsed = parseBlockBody(block.body);

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

export class GenericBlockParser {
    parse(block: HclBlock): GenericBlock {
        const parsed = parseBlockBody(block.body);
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
