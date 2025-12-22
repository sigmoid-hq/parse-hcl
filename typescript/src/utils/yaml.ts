const PAD = '  ';

export function toYaml(value: unknown): string {
    return render(value, 0);
}

function render(value: unknown, level: number): string {
    if (isScalar(value)) {
        return formatScalar(value);
    }

    if (Array.isArray(value)) {
        if (value.length === 0) {
            return `${indent(level)}[]`;
        }

        return value
            .map((item) => {
                if (isScalar(item)) {
                    return `${indent(level)}- ${formatScalar(item)}`;
                }

                const rendered = render(item, level + 1);
                const lines = rendered.split('\n');
                const first = lines[0].startsWith(indent(level + 1))
                    ? lines[0].slice(indent(level + 1).length)
                    : lines[0];
                const head = `${indent(level)}- ${first}`;
                const tail =
                    lines.length > 1
                        ? lines
                              .slice(1)
                              .map((line) => line)
                              .join('\n')
                        : '';
                return tail ? `${head}\n${tail}` : head;
            })
            .join('\n');
    }

    if (isPlainObject(value)) {
        const entries = Object.entries(value as Record<string, unknown>);
        if (entries.length === 0) {
            return `${indent(level)}{}`;
        }

        return entries
            .map(([key, val]) => {
                if (isScalar(val)) {
                    return `${indent(level)}${key}: ${formatScalar(val)}`;
                }
                const rendered = render(val, level + 1);
                return `${indent(level)}${key}:\n${rendered}`;
            })
            .join('\n');
    }

    return `${indent(level)}${JSON.stringify(value)}`;
}

function formatScalar(value: unknown): string {
    if (value === null || value === undefined) {
        return 'null';
    }
    if (typeof value === 'string') {
        return needsQuoting(value) ? JSON.stringify(value) : value;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
    }
    return JSON.stringify(value);
}

function indent(level: number): string {
    return PAD.repeat(level);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isScalar(value: unknown): boolean {
    return (
        value === null ||
        value === undefined ||
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
    );
}

function needsQuoting(value: string): boolean {
    return /[:{}\[\],&*#?|<>=%@`]/.test(value) || value.includes('"') || value.includes("'") || value.includes('\n');
}
