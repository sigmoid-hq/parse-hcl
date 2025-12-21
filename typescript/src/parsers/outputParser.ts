import { HclBlock, OutputBlock } from '../types/blocks';
import { parseBlockBody } from '../utils/bodyParser';
import { literalBoolean, literalString } from '../utils/valueHelpers';

export class OutputParser {
    parse(block: HclBlock): OutputBlock {
        const name = block.labels[0] || 'unknown';
        const parsed = parseBlockBody(block.body);

        const description = literalString(parsed.attributes.description) ?? parsed.attributes.description?.raw;
        const value = parsed.attributes.value;
        const sensitive = literalBoolean(parsed.attributes.sensitive);

        return {
            name,
            description,
            value,
            sensitive,
            raw: block.raw,
            source: block.source
        };
    }
}
