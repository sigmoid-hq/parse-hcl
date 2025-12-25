import fs from 'fs';
import path from 'path';
import { FileParseResult } from '../types/blocks';
import { Value } from '../types/blocks';
import { literalString } from './common/valueHelpers';

type FileWithMetadata = FileParseResult & {
    relative_path?: string;
    output_path?: string;
    output_dir?: string;
};

interface MetadataOptions {
    dirPath: string;
    files: FileWithMetadata[];
    perFileBase?: string;
    ext: '.json' | '.yaml';
    cwd?: string;
}

/**
 * Attaches relative path metadata to per-file results and module blocks.
 * - Adds relative paths for files and their output targets (when split outputs are enabled).
 * - Adds `source_output_dir` to module blocks that point to local directories within the parsed tree.
 */
export function annotateOutputMetadata(options: MetadataOptions): void {
    const root = path.resolve(options.dirPath);
    const cwd = options.cwd ? path.resolve(options.cwd) : process.cwd();
    const perFileBase = options.perFileBase ? path.resolve(options.perFileBase) : undefined;

    for (const file of options.files) {
        const absPath = path.resolve(file.path);
        const relPath = path.relative(root, absPath);
        file.relative_path = relPath;

        if (perFileBase) {
            const perFileTarget = path.join(perFileBase, `${relPath}${options.ext}`);
            const outputPath = normalizeRelative(cwd, perFileTarget);
            file.output_path = outputPath;
            file.output_dir = path.dirname(outputPath);
        }
    }

    for (const file of options.files) {
        const fileDir = path.dirname(path.resolve(file.path));
        for (const mod of file.document.module) {
            const sourceRaw = getRawSource(mod.properties.source);
            if (sourceRaw) {
                mod.source_raw = sourceRaw;
            }

            if (!perFileBase) {
                continue;
            }

            const sourceLiteral = literalString(mod.properties.source);
            if (!sourceLiteral || !isLocalPath(sourceLiteral)) {
                continue;
            }

            const resolvedSource = path.resolve(fileDir, sourceLiteral);
            if (!fs.existsSync(resolvedSource) || !fs.statSync(resolvedSource).isDirectory()) {
                continue;
            }

            const relToRoot = path.relative(root, resolvedSource);
            if (relToRoot.startsWith('..') || path.isAbsolute(relToRoot)) {
                continue;
            }

            const outputDir = path.join(perFileBase, relToRoot);
            mod.source_output_dir = normalizeRelative(cwd, outputDir);
        }
    }
}

function isLocalPath(source: string): boolean {
    if (source.includes('://') || source.includes('::')) {
        return false;
    }
    return source.startsWith('.') || path.isAbsolute(source);
}

function normalizeRelative(from: string, to: string): string {
    const rel = path.relative(from, to);
    return rel || '.';
}

function getRawSource(value: Value | undefined): string | undefined {
    if (!value) {
        return undefined;
    }
    if (value.type === 'literal' && typeof value.value === 'string') {
        return value.value;
    }
    if ('raw' in value && typeof value.raw === 'string') {
        return value.raw;
    }
    return undefined;
}
