import {
    DataBlock,
    ModuleBlock,
    ProviderBlock,
    ResourceBlock,
    TerraformSettingsBlock
} from '../types/blocks';
import { HclBlock } from '../types/blocks';
import { parseBlockBody } from '../utils/bodyParser';

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
            alias: parsed.attributes.alias?.value as string | undefined,
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
        const { source, ...variables } = parsed.attributes;

        return {
            name,
            source,
            variables,
            raw: block.raw,
            sourceFile: block.source
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
            blocks: parsed.blocks,
            meta,
            raw: block.raw,
            source: block.source
        };
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
