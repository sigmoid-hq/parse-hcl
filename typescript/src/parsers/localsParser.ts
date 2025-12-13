import { HclBlock, LocalValue } from '../types/blocks';
import { parseBlockBody } from '../utils/bodyParser';

export class LocalsParser {
    parse(block: HclBlock): LocalValue[] {
        const parsed = parseBlockBody(block.body);

        return Object.entries(parsed.attributes).map<LocalValue>(([name, value]) => ({
            name,
            value,
            raw: value.raw,
            source: block.source
        }));
    }
}
