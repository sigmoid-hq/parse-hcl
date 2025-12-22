"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEmptyDocument = createEmptyDocument;
function createEmptyDocument() {
    return {
        terraform: [],
        provider: [],
        variable: [],
        output: [],
        module: [],
        resource: [],
        data: [],
        locals: [],
        moved: [],
        import: [],
        check: [],
        terraform_data: [],
        unknown: []
    };
}
