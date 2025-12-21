import fs from 'fs';
import path from 'path';

export function readTextFile(filePath: string): string {
    return fs.readFileSync(filePath, 'utf-8');
}

export function readJsonFile<T = unknown>(filePath: string): T {
    return JSON.parse(readTextFile(filePath)) as T;
}

export function listTerraformFiles(dirPath: string): string[] {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    return entries
        .filter((entry) => entry.isFile() && entry.name.endsWith('.tf'))
        .map((entry) => path.join(dirPath, entry.name));
}

export function pathExists(targetPath: string): boolean {
    return fs.existsSync(targetPath);
}

export function isDirectory(targetPath: string): boolean {
    return fs.existsSync(targetPath) && fs.statSync(targetPath).isDirectory();
}
