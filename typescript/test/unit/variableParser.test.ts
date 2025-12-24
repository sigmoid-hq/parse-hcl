import { describe, expect, it } from 'vitest';
import { parseTypeConstraint } from '../../src/parsers/variableParser';

describe('parseTypeConstraint', () => {
    describe('primitive types', () => {
        it('parses string type', () => {
            const result = parseTypeConstraint('string');
            expect(result).toEqual({ base: 'string', raw: 'string' });
        });

        it('parses number type', () => {
            const result = parseTypeConstraint('number');
            expect(result).toEqual({ base: 'number', raw: 'number' });
        });

        it('parses bool type', () => {
            const result = parseTypeConstraint('bool');
            expect(result).toEqual({ base: 'bool', raw: 'bool' });
        });

        it('parses any type', () => {
            const result = parseTypeConstraint('any');
            expect(result).toEqual({ base: 'any', raw: 'any' });
        });
    });

    describe('collection types', () => {
        it('parses list(string)', () => {
            const result = parseTypeConstraint('list(string)');
            expect(result.base).toBe('list');
            expect(result.element).toEqual({ base: 'string', raw: 'string' });
            expect(result.raw).toBe('list(string)');
        });

        it('parses set(number)', () => {
            const result = parseTypeConstraint('set(number)');
            expect(result.base).toBe('set');
            expect(result.element).toEqual({ base: 'number', raw: 'number' });
        });

        it('parses map(string)', () => {
            const result = parseTypeConstraint('map(string)');
            expect(result.base).toBe('map');
            expect(result.element).toEqual({ base: 'string', raw: 'string' });
        });

        it('handles whitespace in collection types', () => {
            const result = parseTypeConstraint('list ( string )');
            expect(result.base).toBe('list');
            expect(result.element?.base).toBe('string');
        });

        it('parses nested collection types', () => {
            const result = parseTypeConstraint('list(list(string))');
            expect(result.base).toBe('list');
            expect(result.element?.base).toBe('list');
            expect(result.element?.element?.base).toBe('string');
        });
    });

    describe('tuple types', () => {
        it('parses tuple with single element', () => {
            const result = parseTypeConstraint('tuple([string])');
            expect(result.base).toBe('tuple');
            expect(result.elements).toHaveLength(1);
            expect(result.elements?.[0].base).toBe('string');
        });

        it('parses tuple with multiple elements', () => {
            const result = parseTypeConstraint('tuple([string, number, bool])');
            expect(result.base).toBe('tuple');
            expect(result.elements).toHaveLength(3);
            expect(result.elements?.[0].base).toBe('string');
            expect(result.elements?.[1].base).toBe('number');
            expect(result.elements?.[2].base).toBe('bool');
        });

        it('parses tuple with nested types', () => {
            const result = parseTypeConstraint('tuple([string, list(number)])');
            expect(result.base).toBe('tuple');
            expect(result.elements).toHaveLength(2);
            expect(result.elements?.[0].base).toBe('string');
            expect(result.elements?.[1].base).toBe('list');
            expect(result.elements?.[1].element?.base).toBe('number');
        });

        it('parses empty tuple', () => {
            const result = parseTypeConstraint('tuple([])');
            expect(result.base).toBe('tuple');
            expect(result.elements).toBeUndefined();
        });

        it('handles whitespace in tuple', () => {
            const result = parseTypeConstraint('tuple( [ string , number ] )');
            expect(result.base).toBe('tuple');
            expect(result.elements).toHaveLength(2);
        });
    });

    describe('object types', () => {
        it('parses simple object type', () => {
            const result = parseTypeConstraint('object({ name = string })');
            expect(result.base).toBe('object');
            expect(result.attributes?.name).toEqual({ base: 'string', raw: 'string' });
        });

        it('parses object with multiple attributes', () => {
            const result = parseTypeConstraint('object({ name = string, age = number })');
            expect(result.base).toBe('object');
            expect(result.attributes?.name.base).toBe('string');
            expect(result.attributes?.age.base).toBe('number');
        });

        it('parses object with nested types', () => {
            const result = parseTypeConstraint('object({ tags = map(string) })');
            expect(result.base).toBe('object');
            expect(result.attributes?.tags.base).toBe('map');
            expect(result.attributes?.tags.element?.base).toBe('string');
        });

        it('parses empty object', () => {
            const result = parseTypeConstraint('object({})');
            expect(result.base).toBe('object');
            expect(result.attributes).toEqual({});
        });
    });

    describe('optional types', () => {
        it('parses optional(string)', () => {
            const result = parseTypeConstraint('optional(string)');
            expect(result.base).toBe('string');
            expect(result.optional).toBe(true);
        });

        it('parses optional with nested type', () => {
            const result = parseTypeConstraint('optional(list(string))');
            expect(result.base).toBe('list');
            expect(result.optional).toBe(true);
            expect(result.element?.base).toBe('string');
        });
    });

    describe('complex types', () => {
        it('parses object with optional attributes', () => {
            const result = parseTypeConstraint('object({ name = string, age = optional(number) })');
            expect(result.base).toBe('object');
            expect(result.attributes?.name.base).toBe('string');
            expect(result.attributes?.name.optional).toBeUndefined();
            expect(result.attributes?.age.base).toBe('number');
            expect(result.attributes?.age.optional).toBe(true);
        });

        it('parses deeply nested structure', () => {
            const result = parseTypeConstraint('map(object({ items = list(string) }))');
            expect(result.base).toBe('map');
            expect(result.element?.base).toBe('object');
            expect(result.element?.attributes?.items.base).toBe('list');
            expect(result.element?.attributes?.items.element?.base).toBe('string');
        });
    });
});
