"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TerraformParser = void 0;
const blocks_1 = require("../types/blocks");
const blockScanner_1 = require("../utils/blockScanner");
const fs_1 = require("../utils/fs");
const logger_1 = require("../utils/logger");
const localsParser_1 = require("../parsers/localsParser");
const genericParser_1 = require("../parsers/genericParser");
const outputParser_1 = require("../parsers/outputParser");
const variableParser_1 = require("../parsers/variableParser");
const terraformJsonParser_1 = require("./terraformJsonParser");
class TerraformParser {
    constructor() {
        this.scanner = new blockScanner_1.BlockScanner();
        this.variableParser = new variableParser_1.VariableParser();
        this.outputParser = new outputParser_1.OutputParser();
        this.localsParser = new localsParser_1.LocalsParser();
        this.moduleParser = new genericParser_1.ModuleParser();
        this.providerParser = new genericParser_1.ProviderParser();
        this.resourceParser = new genericParser_1.ResourceParser();
        this.dataParser = new genericParser_1.DataParser();
        this.terraformSettingsParser = new genericParser_1.TerraformSettingsParser();
        this.genericBlockParser = new genericParser_1.GenericBlockParser();
        this.jsonParser = new terraformJsonParser_1.TerraformJsonParser();
    }
    parseFile(filePath) {
        if (filePath.endsWith('.tf.json')) {
            logger_1.logger.info(`Parsing Terraform JSON file: ${filePath}`);
            return this.jsonParser.parseFile(filePath);
        }
        logger_1.logger.info(`Parsing Terraform file: ${filePath}`);
        const content = (0, fs_1.readTextFile)(filePath);
        const blocks = this.scanner.scan(content, filePath);
        const document = (0, blocks_1.createEmptyDocument)();
        for (const block of blocks) {
            switch (block.kind) {
                case 'variable':
                    document.variable.push(this.variableParser.parse(block));
                    break;
                case 'output':
                    document.output.push(this.outputParser.parse(block));
                    break;
                case 'locals':
                    document.locals.push(...this.localsParser.parse(block));
                    break;
                case 'module':
                    document.module.push(this.moduleParser.parse(block));
                    break;
                case 'provider':
                    document.provider.push(this.providerParser.parse(block));
                    break;
                case 'resource':
                    document.resource.push(this.resourceParser.parse(block));
                    break;
                case 'data':
                    document.data.push(this.dataParser.parse(block));
                    break;
                case 'terraform':
                    document.terraform.push(this.terraformSettingsParser.parse(block));
                    break;
                case 'moved':
                    document.moved.push(this.genericBlockParser.parse(block));
                    break;
                case 'import':
                    document.import.push(this.genericBlockParser.parse(block));
                    break;
                case 'check':
                    document.check.push(this.genericBlockParser.parse(block));
                    break;
                case 'terraform_data':
                    document.terraform_data.push(this.genericBlockParser.parse(block));
                    break;
                default:
                    document.unknown.push(this.genericBlockParser.parse(block));
            }
        }
        return document;
    }
    parseDirectory(dirPath, options) {
        if (!(0, fs_1.pathExists)(dirPath) || !(0, fs_1.isDirectory)(dirPath)) {
            throw new Error(`Invalid directory path: ${dirPath}`);
        }
        const aggregate = options?.aggregate !== false;
        const includePerFile = options?.includePerFile !== false;
        const files = (0, fs_1.listTerraformFiles)(dirPath);
        const parsedFiles = files.map((filePath) => ({
            path: filePath,
            document: this.parseFile(filePath)
        }));
        const combined = aggregate ? this.combine(parsedFiles.map((item) => item.document)) : undefined;
        return {
            combined,
            files: includePerFile ? parsedFiles : []
        };
    }
    combine(documents) {
        const combined = (0, blocks_1.createEmptyDocument)();
        for (const doc of documents) {
            combined.terraform.push(...doc.terraform);
            combined.provider.push(...doc.provider);
            combined.variable.push(...doc.variable);
            combined.output.push(...doc.output);
            combined.module.push(...doc.module);
            combined.resource.push(...doc.resource);
            combined.data.push(...doc.data);
            combined.locals.push(...doc.locals);
            combined.moved.push(...doc.moved);
            combined.import.push(...doc.import);
            combined.check.push(...doc.check);
            combined.terraform_data.push(...doc.terraform_data);
            combined.unknown.push(...doc.unknown);
        }
        return combined;
    }
}
exports.TerraformParser = TerraformParser;
