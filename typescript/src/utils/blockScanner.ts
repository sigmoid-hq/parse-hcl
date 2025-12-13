import { BlockKind, HclBlock } from '../types/blocks';
import { logger } from './logger';

const BLOCK_HEADER =
    /(terraform|locals|provider|variable|output|module|resource|data)\s*(?:"([^"]+)")?(?:\s*"([^"]+)")?\s*\{/g;

export class BlockScanner {
    scan(content: string, source: string): HclBlock[] {
        BLOCK_HEADER.lastIndex = 0;
        const blocks: HclBlock[] = [];
        let match: RegExpExecArray | null;

        while ((match = BLOCK_HEADER.exec(content)) !== null) {
            const kind = match[1] as BlockKind;
            const labels = [match[2], match[3]].filter(Boolean) as string[];
            const braceIndex = content.indexOf('{', match.index);

            if (braceIndex < 0) {
                logger.warn(`'${kind}' block in ${source} is missing '{'`);
                continue;
            }

            const endIndex = findMatchingBrace(content, braceIndex);
            const raw = content.slice(match.index, endIndex + 1);
            const body = content.slice(braceIndex + 1, endIndex);

            blocks.push({
                kind,
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

function findMatchingBrace(content: string, startIndex: number): number {
    let depth = 0;
    let inString = false;
    let stringChar: string | null = null;

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
            } else if (char === '}') {
                depth -= 1;
                if (depth === 0) {
                    return i;
                }
            }
        } else if (char === stringChar && prev !== '\\') {
            inString = false;
            stringChar = null;
        }
    }

    return content.length - 1;
}
