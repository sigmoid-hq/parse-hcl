/**
 * Main Terraform configuration parser.
 * Parses .tf and .tf.json files into structured TerraformDocument objects.
 */

import {
    DirectoryParseOptions,
    DirectoryParseResult,
    FileParseResult,
    TerraformDocument,
    createEmptyDocument
} from '../types/blocks';
import { BlockScanner } from '../utils/lexer/blockScanner';
import { isDirectory, listTerraformFiles, pathExists, readTextFile } from '../utils/common/fs';
import { logger } from '../utils/common/logger';
import { LocalsParser } from '../parsers/localsParser';
import {
    ModuleParser,
    ProviderParser,
    ResourceParser,
    DataParser,
    TerraformSettingsParser,
    GenericBlockParser
} from '../parsers/genericParser';
import { OutputParser } from '../parsers/outputParser';
import { VariableParser } from '../parsers/variableParser';
import { TerraformJsonParser } from './terraformJsonParser';

/**
 * Main parser for Terraform configuration files.
 * Supports both HCL (.tf) and JSON (.tf.json) formats.
 *
 * @example
 * ```typescript
 * const parser = new TerraformParser();
 *
 * // Parse a single file
 * const doc = parser.parseFile('main.tf');
 * console.log(`Found ${doc.resource.length} resources`);
 *
 * // Parse a directory
 * const result = parser.parseDirectory('./terraform');
 * console.log(`Parsed ${result.files.length} files`);
 *
 * // Access parsed elements
 * for (const resource of doc.resource) {
 *   console.log(`${resource.type}.${resource.name}`);
 * }
 * ```
 */
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
    private readonly genericBlockParser = new GenericBlockParser();
    private readonly jsonParser = new TerraformJsonParser();

    /**
     * Parses a Terraform configuration file.
     * Automatically detects format (.tf vs .tf.json) and uses appropriate parser.
     *
     * @param filePath - Path to the Terraform file
     * @returns Parsed TerraformDocument containing all blocks
     * @throws {Error} If file cannot be read or parsed
     *
     * @example
     * ```typescript
     * const doc = parser.parseFile('main.tf');
     * console.log(doc.variable[0].name);
     * ```
     */
    parseFile(filePath: string): TerraformDocument {
        if (filePath.endsWith('.tf.json')) {
            logger.info(`Parsing Terraform JSON file: ${filePath}`);
            return this.jsonParser.parseFile(filePath);
        }

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

    /**
     * Parses all Terraform files in a directory (recursively).
     *
     * @param dirPath - Path to the directory
     * @param options - Parsing options
     * @returns DirectoryParseResult with combined document and per-file results
     * @throws {Error} If directory does not exist or is not accessible
     *
     * @example
     * ```typescript
     * // Parse with defaults (aggregate + per-file results)
     * const result = parser.parseDirectory('./terraform');
     *
     * // Parse without aggregation
     * const result = parser.parseDirectory('./terraform', { aggregate: false });
     *
     * // Parse without per-file results
     * const result = parser.parseDirectory('./terraform', { includePerFile: false });
     * ```
     */
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

    /**
     * Combines multiple TerraformDocuments into a single document.
     * Useful for aggregating configurations from multiple files.
     *
     * @param documents - Array of documents to combine
     * @returns A single TerraformDocument containing all blocks
     *
     * @example
     * ```typescript
     * const doc1 = parser.parseFile('main.tf');
     * const doc2 = parser.parseFile('variables.tf');
     * const combined = parser.combine([doc1, doc2]);
     * ```
     */
    combine(documents: TerraformDocument[]): TerraformDocument {
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
            combined.moved.push(...doc.moved);
            combined.import.push(...doc.import);
            combined.check.push(...doc.check);
            combined.terraform_data.push(...doc.terraform_data);
            combined.unknown.push(...doc.unknown);
        }

        return combined;
    }
}
