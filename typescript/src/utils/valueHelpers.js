"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.literalString = literalString;
exports.literalBoolean = literalBoolean;
exports.literalNumber = literalNumber;
function literalString(value) {
    if (value?.type === 'literal' && typeof value.value === 'string') {
        return value.value;
    }
    return undefined;
}
function literalBoolean(value) {
    if (value?.type === 'literal' && typeof value.value === 'boolean') {
        return value.value;
    }
    return undefined;
}
function literalNumber(value) {
    if (value?.type === 'literal' && typeof value.value === 'number') {
        return value.value;
    }
    return undefined;
}
