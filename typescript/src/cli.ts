#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { FileParseResult, TerraformDocument } from './types/blocks';
import { TerraformParser } from './services/terraformParser';
import { TfVarsParser, TfStateParser, TfPlanParser } from './services/artifactParsers';
import { toJson, toJsonExport, toYamlDocument } from './utils/serialization/serializer';
import { annotateOutputMetadata } from './utils/outputMetadata';

interface CliOptions {
    file?: string;
    dir?: string;
    format: 'json' | 'yaml';
    graph: boolean;
    prune: boolean;
    out?: string;
    outDir?: string;
    split: boolean;
    stdout: boolean;
}

const DEFAULT_SINGLE_BASENAME = 'parse-hcl-output';
const DEFAULT_COMBINED_BASENAME = 'parse-hcl-output.combined';
const DEFAULT_PER_FILE_DIR = 'parse-hcl-output/files';

function parseArgs(argv: string[]): CliOptions {
    const opts: CliOptions = { format: 'json', graph: false, prune: true, split: true, stdout: false };
    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === '--file' && argv[i + 1]) {
            opts.file = argv[++i];
        } else if (arg === '--dir' && argv[i + 1]) {
            opts.dir = argv[++i];
        } else if (arg === '--format' && argv[i + 1]) {
            const fmt = argv[++i];
            if (fmt === 'json' || fmt === 'yaml') {
                opts.format = fmt;
            }
        } else if (arg === '--graph') {
            opts.graph = true;
        } else if (arg === '--no-prune') {
            opts.prune = false;
        } else if (arg === '--out' && argv[i + 1]) {
            opts.out = argv[++i];
        } else if (arg === '--out-dir' && argv[i + 1]) {
            opts.outDir = argv[++i];
        } else if (arg === '--split') {
            opts.split = true;
        } else if (arg === '--no-split') {
            opts.split = false;
        } else if (arg === '--stdout') {
            opts.stdout = true;
        } else if (arg === '--no-stdout') {
            opts.stdout = false;
        }
    }
    return opts;
}

function main(): void {
    const opts = parseArgs(process.argv.slice(2));
    const parser = new TerraformParser();

    if (!opts.file && !opts.dir) {
        console.error('Usage: parse-hcl --file <path> | --dir <path> [--format json|yaml] [--graph] [--no-prune] [--out <path>] [--out-dir <dir>] [--stdout]');
        process.exit(1);
    }

    if (opts.file) {
        const filePath = path.resolve(opts.file);
        const ext = path.extname(filePath);
        if (ext.includes('tfvars')) {
            const data = tfvarsParse(filePath);
            emitSingle(filePath, data, opts);
            return;
        }
        if (ext === '.tfstate') {
            const data = new TfStateParser().parseFile(filePath);
            emitSingle(filePath, data, opts);
            return;
        }
        if (ext === '.json' && filePath.endsWith('plan.json')) {
            const data = new TfPlanParser().parseFile(filePath);
            emitSingle(filePath, data, opts);
            return;
        }

        const doc = parser.parseFile(filePath);
        emitSingle(filePath, doc, opts);
        return;
    }

    if (opts.dir) {
        const dirPath = path.resolve(opts.dir);
        const result = parser.parseDirectory(dirPath);
        const combinedDoc = result.combined ?? parser.combine(result.files.map((f) => f.document));
        emitDirectory(dirPath, result.files, combinedDoc, opts);
    }
}

function tfvarsParse(filePath: string) {
    return new TfVarsParser().parseFile(filePath);
}

function emitSingle(filePath: string, data: unknown, opts: CliOptions): void {
    const rendered = render(data, opts);
    const ext = getExt(opts.format);
    const defaultName = `${DEFAULT_SINGLE_BASENAME}${ext}`;
    const targetPath = resolveOutPath(opts.out, defaultName, opts.format);

    writeFile(targetPath, rendered);
    if (opts.stdout) {
        console.info(rendered);
    }
}

function emitDirectory(
    dirPath: string,
    files: FileParseResult[],
    combinedDoc: TerraformDocument,
    opts: CliOptions
): void {
    const ext = getExt(opts.format);
    const perFileBase = opts.split ? resolvePerFileBase(opts) : undefined;

    annotateOutputMetadata({
        dirPath,
        files,
        perFileBase,
        ext,
        cwd: process.cwd()
    });

    const combinedData = opts.graph ? combinedDoc : { combined: combinedDoc, files: opts.split ? files : [] };
    const combinedRendered = render(combinedData, opts);
    const combinedDefaultName = `${DEFAULT_COMBINED_BASENAME}${ext}`;
    const combinedTarget = resolveOutPath(opts.out, combinedDefaultName, opts.format, true);

    writeFile(combinedTarget, combinedRendered);

    if (opts.split && perFileBase) {
        files.forEach((file) => {
            const relPath = file.relative_path ?? path.relative(dirPath, path.resolve(file.path));
            const perFileTarget = path.join(perFileBase, `${relPath}${ext}`);
            const rendered = render(file.document, opts);
            writeFile(perFileTarget, rendered);
        });
    }

    if (opts.stdout) {
        console.info(combinedRendered);
    }
}

function render(data: unknown, opts: CliOptions): string {
    if (opts.graph && !isTerraformDoc(data)) {
        console.warn('Graph export requested but input is not a Terraform document; emitting raw output.');
    }

    if (opts.format === 'yaml') {
        return toYamlDocument(data, { pruneEmpty: opts.prune });
    }

    if (opts.graph && isTerraformDoc(data)) {
        return toJsonExport(data, { pruneEmpty: opts.prune });
    }

    return toJson(data, { pruneEmpty: opts.prune });
}

function resolveOutPath(out: string | undefined, defaultName: string, format: 'json' | 'yaml', isDirMode = false): string {
    const resolvedDefault = path.resolve(defaultName);
    if (!out) {
        return resolvedDefault;
    }

    const resolvedOut = path.resolve(out);
    if (fs.existsSync(resolvedOut) && fs.statSync(resolvedOut).isDirectory()) {
        const name = isDirMode ? `combined${getExt(format)}` : `output${getExt(format)}`;
        return path.join(resolvedOut, name);
    }

    if (!path.extname(resolvedOut)) {
        return `${resolvedOut}${getExt(format)}`;
    }

    return resolvedOut;
}

function resolvePerFileBase(opts: CliOptions): string {
    if (opts.outDir) {
        return path.resolve(opts.outDir);
    }

    if (opts.out) {
        const resolvedOut = path.resolve(opts.out);
        if (fs.existsSync(resolvedOut) && fs.statSync(resolvedOut).isDirectory()) {
            return path.join(resolvedOut, 'per-file');
        }
        return path.join(path.dirname(resolvedOut), 'per-file');
    }

    return path.resolve(DEFAULT_PER_FILE_DIR);
}

function writeFile(targetPath: string, contents: string): void {
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, contents, 'utf-8');
}

function getExt(format: 'json' | 'yaml'): '.json' | '.yaml' {
    return format === 'yaml' ? '.yaml' : '.json';
}

function isTerraformDoc(data: unknown): data is TerraformDocument {
    return Boolean(data && typeof data === 'object' && 'resource' in (data as Record<string, unknown>));
}

if (require.main === module) {
    main();
}
