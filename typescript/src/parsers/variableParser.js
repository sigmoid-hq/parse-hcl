"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VariableParser = void 0;
const bodyParser_1 = require("../utils/bodyParser");
const valueHelpers_1 = require("../utils/valueHelpers");
class VariableParser {
    parse(block) {
        const name = block.labels[0] || 'unknown';
        const parsed = (0, bodyParser_1.parseBlockBody)(block.body);
        const description = (0, valueHelpers_1.literalString)(parsed.attributes.description) ?? parsed.attributes.description?.raw;
        const type = (0, valueHelpers_1.literalString)(parsed.attributes.type) ?? parsed.attributes.type?.raw;
        const defaultValue = parsed.attributes.default?.type === 'literal'
            ? parsed.attributes.default.value
            : parsed.attributes.default?.raw;
        const sensitive = (0, valueHelpers_1.literalBoolean)(parsed.attributes.sensitive);
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
    extractValidation(blocks) {
        const validationBlock = blocks.find((child) => child.type === 'validation');
        if (!validationBlock) {
            return undefined;
        }
        const condition = (0, valueHelpers_1.literalString)(validationBlock.attributes.condition) ?? validationBlock.attributes.condition?.raw;
        const errorMessage = (0, valueHelpers_1.literalString)(validationBlock.attributes.error_message) ??
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
exports.VariableParser = VariableParser;
