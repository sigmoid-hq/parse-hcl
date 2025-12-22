"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlockScanner = void 0;
const logger_1 = require("./logger");
const KNOWN_BLOCKS = new Set([
    'terraform',
    'locals',
    'provider',
    'variable',
    'output',
    'module',
    'resource',
    'data',
    'moved',
    'import',
    'check',
    'terraform_data'
]);
const BLOCK_HEADER = /([A-Za-z_][\w-]*)\s*(?:"([^"]+)")?(?:\s*"([^"]+)")?\s*\{/g;
class BlockScanner {
    scan(content, source) {
        BLOCK_HEADER.lastIndex = 0;
        const blocks = [];
        let match;
        while ((match = BLOCK_HEADER.exec(content)) !== null) {
            const keyword = match[1];
            const kind = (KNOWN_BLOCKS.has(keyword) ? keyword : 'unknown');
            const labels = [match[2], match[3]].filter(Boolean);
            const braceIndex = content.indexOf('{', match.index);
            if (braceIndex < 0) {
                logger_1.logger.warn(`'${kind}' block in ${source} is missing '{'`);
                continue;
            }
            const endIndex = findMatchingBrace(content, braceIndex);
            const raw = normalizeRaw(content.slice(match.index, endIndex + 1));
            const body = content.slice(braceIndex + 1, endIndex);
            blocks.push({
                kind,
                keyword,
                labels,
                body: body.trim(),
                raw,
                source
            });
            BLOCK_HEADER.lastIndex = endIndex + 1;
        }
        return blocks;
    }
}
exports.BlockScanner = BlockScanner;
function findMatchingBrace(content, startIndex) {
    let depth = 0;
    let inString = false;
    let stringChar = null;
    for (let i = startIndex; i < content.length; i += 1) {
        const char = content[i];
        const next = content[i + 1];
        const prev = content[i - 1];
        if (!inString) {
            if (char === '"' || char === "'") {
                inString = true;
                stringChar = char;
                continue;
            }
            if (char === '/' && next === '*') {
                const end = content.indexOf('*/', i + 2);
                if (end === -1) {
                    return content.length - 1;
                }
                i = end + 1;
                continue;
            }
            if (char === '/' && next === '/') {
                const end = content.indexOf('\n', i + 2);
                i = end === -1 ? content.length : end;
                continue;
            }
            if (char === '#') {
                const end = content.indexOf('\n', i + 1);
                i = end === -1 ? content.length : end;
                continue;
            }
            if (char === '{') {
                depth += 1;
            }
            else if (char === '}') {
                depth -= 1;
                if (depth === 0) {
                    return i;
                }
            }
        }
        else if (char === stringChar && prev !== '\\') {
            inString = false;
            stringChar = null;
        }
    }
    return content.length - 1;
}
function normalizeRaw(raw) {
    const trimmed = raw.trim();
    const lines = trimmed.split(/\r?\n/);
    if (lines.length === 1) {
        return lines[0];
    }
    const indents = lines
        .slice(1)
        .filter((line) => line.trim().length > 0)
        .map((line) => (line.match(/^(\s*)/)?.[1].length ?? 0));
    const minIndent = indents.length ? Math.min(...indents) : 0;
    const normalizeAlignment = (line) => line
        .replace(/\s{2,}=\s*/g, ' = ')
        .replace(/\s*=\s{2,}/g, ' = ')
        .trimEnd();
    const normalized = lines.map((line, index) => {
        const withoutIndent = index === 0 ? line.trimStart() : line.slice(Math.min(minIndent, line.length));
        return normalizeAlignment(withoutIndent);
    });
    return normalized.join('\n');
}
