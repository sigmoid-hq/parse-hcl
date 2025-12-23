#!/usr/bin/env node
import path from 'path';
import { TerraformDocument } from './types/blocks';
import { TerraformParser } from './services/terraformParser';
import { TfVarsParser, TfStateParser, TfPlanParser } from './services/artifactParsers';
import { toExport, toJson, toJsonExport, toYamlDocument } from './utils/serialization/serializer';

interface CliOptions {
    file?: string;
    dir?: string;
    format: 'json' | 'yaml';
    graph: boolean;
    prune: boolean;
}

function parseArgs(argv: string[]): CliOptions {
    const opts: CliOptions = { format: 'json', graph: false, prune: true };
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
        }
    }
    return opts;
}

function main(): void {
    const opts = parseArgs(process.argv.slice(2));
    const parser = new TerraformParser();

    if (!opts.file && !opts.dir) {
        console.error('Usage: parse-hcl --file <path> | --dir <path> [--format json|yaml] [--graph] [--no-prune]');
        process.exit(1);
    }

    if (opts.file) {
        const filePath = path.resolve(opts.file);
        const ext = path.extname(filePath);
        if (ext.includes('tfvars')) {
            emit(tfvarsParse(filePath), opts);
            return;
        }
        if (ext === '.tfstate') {
            emit(new TfStateParser().parseFile(filePath), opts);
            return;
        }
        if (ext === '.json' && filePath.endsWith('plan.json')) {
            emit(new TfPlanParser().parseFile(filePath), opts);
            return;
        }

        const doc = parser.parseFile(filePath);
        emit(doc, opts);
        return;
    }

    if (opts.dir) {
        const dirPath = path.resolve(opts.dir);
        const result = parser.parseDirectory(dirPath);
        const combined = result.combined ?? parser.combine(result.files.map((f) => f.document));
        emit(opts.graph ? toExport(combined, { pruneEmpty: opts.prune }) : result, opts);
    }
}

function tfvarsParse(filePath: string) {
    return new TfVarsParser().parseFile(filePath);
}

function emit(data: unknown, opts: CliOptions): void {
    if (opts.graph && !isTerraformDoc(data)) {
        console.warn('Graph export requested but input is not a Terraform document; emitting raw output.');
    }

    if (opts.format === 'yaml') {
        console.info(toYamlDocument(data, { pruneEmpty: opts.prune }));
        return;
    }

    if (opts.graph && isTerraformDoc(data)) {
        console.info(toJsonExport(data, { pruneEmpty: opts.prune }));
        return;
    }

    console.info(toJson(data, { pruneEmpty: opts.prune }));
}

function isTerraformDoc(data: unknown): data is TerraformDocument {
    return Boolean(data && typeof data === 'object' && 'resource' in (data as Record<string, unknown>));
}

if (require.main === module) {
    main();
}
