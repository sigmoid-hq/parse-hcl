import {
    DirectoryParseOptions,
    DirectoryParseResult,
    FileParseResult,
    TerraformDocument,
    createEmptyDocument
} from '../types/blocks';
import { BlockScanner } from '../utils/blockScanner';
import { isDirectory, listTerraformFiles, pathExists, readTextFile } from '../utils/fs';
import { logger } from '../utils/logger';
import { LocalsParser } from '../parsers/localsParser';
import { ModuleParser, ProviderParser, ResourceParser, DataParser, TerraformSettingsParser } from '../parsers/genericParser';
import { OutputParser } from '../parsers/outputParser';
import { VariableParser } from '../parsers/variableParser';

export class TerraformParser {
    private readonly scanner = new BlockScanner();
    private readonly variableParser = new VariableParser();
    private readonly outputParser = new OutputParser();
    private readonly localsParser = new LocalsParser();
    private readonly moduleParser = new ModuleParser();
    private readonly providerParser = new ProviderParser();
    private readonly resourceParser = new ResourceParser();
    private readonly dataParser = new DataParser();
    private readonly terraformSettingsParser = new TerraformSettingsParser();

    parseFile(filePath: string): TerraformDocument {
        logger.info(`Parsing Terraform file: ${filePath}`);
        const content = readTextFile(filePath);
        const blocks = this.scanner.scan(content, filePath);
        const document = createEmptyDocument();

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
                default:
                    logger.warn(`Unhandled block kind: ${block.kind}`);
            }
        }

        return document;
    }

    parseDirectory(dirPath: string, options?: DirectoryParseOptions): DirectoryParseResult {
        if (!pathExists(dirPath) || !isDirectory(dirPath)) {
            throw new Error(`Invalid directory path: ${dirPath}`);
        }

        const aggregate = options?.aggregate !== false;
        const includePerFile = options?.includePerFile !== false;

        const files = listTerraformFiles(dirPath);
        const parsedFiles: FileParseResult[] = files.map((filePath) => ({
            path: filePath,
            document: this.parseFile(filePath)
        }));

        const combined = aggregate ? this.combine(parsedFiles.map((item) => item.document)) : undefined;

        return {
            combined,
            files: includePerFile ? parsedFiles : []
        };
    }

    private combine(documents: TerraformDocument[]): TerraformDocument {
        const combined = createEmptyDocument();

        for (const doc of documents) {
            combined.terraform.push(...doc.terraform);
            combined.provider.push(...doc.provider);
            combined.variable.push(...doc.variable);
            combined.output.push(...doc.output);
            combined.module.push(...doc.module);
            combined.resource.push(...doc.resource);
            combined.data.push(...doc.data);
            combined.locals.push(...doc.locals);
        }

        return combined;
    }
}
