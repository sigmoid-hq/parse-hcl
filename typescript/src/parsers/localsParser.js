"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalsParser = void 0;
const bodyParser_1 = require("../utils/bodyParser");
class LocalsParser {
    parse(block) {
        const parsed = (0, bodyParser_1.parseBlockBody)(block.body);
        return Object.entries(parsed.attributes).map(([name, value]) => ({
            name,
            type: value.type,
            value,
            raw: value.raw,
            source: block.source
        }));
    }
}
exports.LocalsParser = LocalsParser;
