import { HclBlock, VariableBlock } from '../types/blocks';
import { parseBlockBody } from '../utils/bodyParser';
import { literalBoolean, literalString } from '../utils/valueHelpers';

export class VariableParser {
    parse(block: HclBlock): VariableBlock {
        const name = block.labels[0] || 'unknown';
        const parsed = parseBlockBody(block.body);

        const description = literalString(parsed.attributes.description) ?? parsed.attributes.description?.raw;
        const type = literalString(parsed.attributes.type) ?? parsed.attributes.type?.raw;
        const defaultValue =
            parsed.attributes.default?.type === 'literal'
                ? parsed.attributes.default.value
                : parsed.attributes.default?.raw;
        const sensitive = literalBoolean(parsed.attributes.sensitive);
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
            literalString(validationBlock.attributes.condition) ?? validationBlock.attributes.condition?.raw;
        const errorMessage =
            literalString(validationBlock.attributes.error_message) ??
            validationBlock.attributes.error_message?.raw;

        if (!condition && !errorMessage) {
            return undefined;
        }

        return {
            condition,
            error_message: errorMessage
        };
    }
}
