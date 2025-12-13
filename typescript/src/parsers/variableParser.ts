import { HclBlock, VariableBlock } from '../types/blocks';
import { parseBlockBody } from '../utils/bodyParser';

export class VariableParser {
    parse(block: HclBlock): VariableBlock {
        const name = block.labels[0] || 'unknown';
        const parsed = parseBlockBody(block.body);

        const description = parsed.attributes.description?.value as string | undefined;
        const type = parsed.attributes.type?.raw;
        const defaultValue = parsed.attributes.default?.value ?? parsed.attributes.default?.raw;
        const sensitive = parsed.attributes.sensitive?.value === true;
        const validation = this.extractValidation(parsed.blocks);

        return {
            name,
            description,
            type,
            default: defaultValue,
            validation,
            sensitive,
            raw: block.raw,
            source: block.source
        };
    }

    private extractValidation(blocks: ReturnType<typeof parseBlockBody>['blocks']): VariableBlock['validation'] {
        const validationBlock = blocks.find((child) => child.type === 'validation');
        if (!validationBlock) {
            return undefined;
        }

        const condition =
            (validationBlock.attributes.condition?.raw ?? validationBlock.attributes.condition?.value) as
                | string
                | undefined;
        const errorMessage =
            (validationBlock.attributes.error_message?.value ??
                validationBlock.attributes.error_message?.raw) as string | undefined;

        if (!condition && !errorMessage) {
            return undefined;
        }

        return {
            condition,
            errorMessage
        };
    }
}
