function indent(level: number): string {
    return '  '.repeat(level);
}

export function toYaml(value: unknown, level = 0): string {
    if (value === null || value === undefined) {
        return 'null';
    }

    if (typeof value === 'string') {
        if (/[:{}\[\],&*#?|<>=%@`]/.test(value) || value.includes('"') || value.includes("'") || value.includes('\n')) {
            return JSON.stringify(value);
        }
        return value;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
    }

    if (Array.isArray(value)) {
        if (value.length === 0) {
            return '[]';
        }
        return value
            .map((item) => `${indent(level)}- ${toYaml(item, level + 1)}`)
            .join('\n');
    }

    if (typeof value === 'object') {
        const entries = Object.entries(value as Record<string, unknown>);
        if (entries.length === 0) {
            return '{}';
        }

        return entries
            .map(([key, val]) => {
                const rendered = toYaml(val, level + 1);
                const needsBlock = rendered.includes('\n');
                if (needsBlock) {
                    return `${indent(level)}${key}:\n${indent(level + 1)}${rendered.replace(
                        /\n/g,
                        `\n${indent(level + 1)}`
                    )}`;
                }
                return `${indent(level)}${key}: ${rendered}`;
            })
            .join('\n');
    }

    return JSON.stringify(value);
}
