"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OutputParser = void 0;
const bodyParser_1 = require("../utils/bodyParser");
const valueHelpers_1 = require("../utils/valueHelpers");
class OutputParser {
    parse(block) {
        const name = block.labels[0] || 'unknown';
        const parsed = (0, bodyParser_1.parseBlockBody)(block.body);
        const description = (0, valueHelpers_1.literalString)(parsed.attributes.description) ?? parsed.attributes.description?.raw;
        const value = parsed.attributes.value;
        const sensitive = (0, valueHelpers_1.literalBoolean)(parsed.attributes.sensitive);
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
exports.OutputParser = OutputParser;
