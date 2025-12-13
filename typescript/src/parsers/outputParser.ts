import { HclBlock, OutputBlock } from '../types/blocks';
import { parseBlockBody } from '../utils/bodyParser';

export class OutputParser {
    parse(block: HclBlock): OutputBlock {
        const name = block.labels[0] || 'unknown';
        const parsed = parseBlockBody(block.body);

        const description = parsed.attributes.description?.value as string | undefined;
        const value = parsed.attributes.value;
        const sensitive = parsed.attributes.sensitive?.value === true;

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
