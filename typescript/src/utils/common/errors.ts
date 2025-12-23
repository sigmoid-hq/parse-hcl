/**
 * Represents a location in source code with line, column, and absolute offset.
 */
export interface SourceLocation {
    /** 1-based line number */
    line: number;
    /** 1-based column number */
    column: number;
    /** 0-based character offset from start of content */
    offset: number;
}

/**
 * Represents a range in source code from start to end positions.
 */
export interface SourceRange {
    start: SourceLocation;
    end: SourceLocation;
}

/**
 * Error thrown when HCL parsing fails.
 * Contains location information for debugging.
 */
export class ParseError extends Error {
    /** The source file path where the error occurred */
    public readonly source: string;
    /** The location in the source where the error occurred */
    public readonly location: SourceLocation;
    /** Optional end location for range-based errors */
    public readonly endLocation?: SourceLocation;

    constructor(message: string, source: string, location: SourceLocation, endLocation?: SourceLocation) {
        const locationStr = `${source}:${location.line}:${location.column}`;
        super(`${message} at ${locationStr}`);
        this.name = 'ParseError';
        this.source = source;
        this.location = location;
        this.endLocation = endLocation;
    }
}

/**
 * Calculates line and column numbers from a character offset.
 * @param content - The full source content
 * @param offset - The 0-based character offset
 * @returns The source location with line, column, and offset
 */
export function offsetToLocation(content: string, offset: number): SourceLocation {
    let line = 1;
    let column = 1;
    const safeOffset = Math.min(offset, content.length);

    for (let i = 0; i < safeOffset; i++) {
        if (content[i] === '\n') {
            line++;
            column = 1;
        } else {
            column++;
        }
    }

    return { line, column, offset: safeOffset };
}

/**
 * Creates a SourceRange from start and end offsets.
 * @param content - The full source content
 * @param startOffset - The 0-based start offset
 * @param endOffset - The 0-based end offset
 * @returns The source range
 */
export function offsetsToRange(content: string, startOffset: number, endOffset: number): SourceRange {
    return {
        start: offsetToLocation(content, startOffset),
        end: offsetToLocation(content, endOffset)
    };
}
