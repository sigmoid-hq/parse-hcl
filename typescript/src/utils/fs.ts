import fs from 'fs';
import path from 'path';

const IGNORED_DIRS = new Set(['.terraform', '.git', 'node_modules']);

export function readTextFile(filePath: string): string {
    return fs.readFileSync(filePath, 'utf-8');
}

export function readJsonFile<T = unknown>(filePath: string): T {
    return JSON.parse(readTextFile(filePath)) as T;
}

export function listTerraformFiles(dirPath: string): string[] {
    const files: string[] = [];
    const stack: string[] = [dirPath];

    while (stack.length > 0) {
        const current = stack.pop() as string;
        const entries = fs.readdirSync(current, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(current, entry.name);
            if (entry.isDirectory()) {
                if (IGNORED_DIRS.has(entry.name)) {
                    continue;
                }
                stack.push(fullPath);
                continue;
            }

            if (
                entry.isFile() &&
                (entry.name.endsWith('.tf') || entry.name.endsWith('.tf.json'))
            ) {
                files.push(fullPath);
            }
        }
    }

    return files.sort();
}

export function pathExists(targetPath: string): boolean {
    return fs.existsSync(targetPath);
}

export function isDirectory(targetPath: string): boolean {
    return fs.existsSync(targetPath) && fs.statSync(targetPath).isDirectory();
}
