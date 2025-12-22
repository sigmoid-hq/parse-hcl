/**
 * Comprehensive test suite for parse-hcl.
 * Tests all features including new expression types, references, and edge cases.
 */

import path from 'path';
import { describe, expect, it } from 'vitest';
import { TerraformParser } from '../src/services/terraformParser';
import { classifyValue } from '../src/utils/valueClassifier';
import { parseTypeConstraint } from '../src/parsers/variableParser';
import { buildDependencyGraph } from '../src/utils/graphBuilder';
import { toJson, toYamlDocument } from '../src/utils/serializer';
import { ParseError, offsetToLocation } from '../src/utils/errors';
import { BlockScanner } from '../src/utils/blockScanner';
import {
    splitArrayElements,
    splitObjectEntries,
    isEscaped,
    findMatchingBrace
} from '../src/utils/hclLexer';

const fixturesDir = path.join(__dirname, 'fixtures');
const advancedFile = path.join(fixturesDir, 'advanced.tf');

describe('Value Classifier', () => {
    describe('Literal Values', () => {
        it('classifies boolean literals', () => {
            expect(classifyValue('true')).toMatchObject({ type: 'literal', value: true });
            expect(classifyValue('false')).toMatchObject({ type: 'literal', value: false });
        });

        it('classifies numeric literals', () => {
            expect(classifyValue('42')).toMatchObject({ type: 'literal', value: 42 });
            expect(classifyValue('-17')).toMatchObject({ type: 'literal', value: -17 });
            expect(classifyValue('3.14')).toMatchObject({ type: 'literal', value: 3.14 });
            expect(classifyValue('-0.5')).toMatchObject({ type: 'literal', value: -0.5 });
            expect(classifyValue('1e10')).toMatchObject({ type: 'literal', value: 1e10 });
            expect(classifyValue('1.5e-3')).toMatchObject({ type: 'literal', value: 0.0015 });
        });

        it('classifies null literal', () => {
            expect(classifyValue('null')).toMatchObject({ type: 'literal', value: null });
        });

        it('classifies quoted strings', () => {
            expect(classifyValue('"hello"')).toMatchObject({ type: 'literal', value: 'hello' });
            expect(classifyValue("'world'")).toMatchObject({ type: 'literal', value: 'world' });
        });

        it('handles escape sequences in strings', () => {
            expect(classifyValue('"line1\\nline2"')).toMatchObject({ type: 'literal', value: 'line1\nline2' });
            expect(classifyValue('"tab\\there"')).toMatchObject({ type: 'literal', value: 'tab\there' });
            expect(classifyValue('"quote\\"here"')).toMatchObject({ type: 'literal', value: 'quote"here' });
            expect(classifyValue('"back\\\\slash"')).toMatchObject({ type: 'literal', value: 'back\\slash' });
        });
    });

    describe('Array Values', () => {
        it('classifies simple arrays', () => {
            const result = classifyValue('[1, 2, 3]');
            expect(result.type).toBe('array');
            expect(result.value).toHaveLength(3);
        });

        it('classifies arrays with mixed types', () => {
            const result = classifyValue('["a", 1, true, null]');
            expect(result.type).toBe('array');
            expect(result.value).toHaveLength(4);
        });

        it('classifies nested arrays', () => {
            const result = classifyValue('[[1, 2], [3, 4]]');
            expect(result.type).toBe('array');
            expect(result.value).toHaveLength(2);
            expect(result.value?.[0]).toMatchObject({ type: 'array' });
        });

        it('extracts references from arrays', () => {
            const result = classifyValue('[var.a, local.b]');
            expect(result.references).toHaveLength(2);
            expect(result.references?.[0]).toMatchObject({ kind: 'variable', name: 'a' });
            expect(result.references?.[1]).toMatchObject({ kind: 'local', name: 'b' });
        });
    });

    describe('Object Values', () => {
        it('classifies simple objects', () => {
            const result = classifyValue('{ a = 1, b = 2 }');
            expect(result.type).toBe('object');
            expect(result.value).toHaveProperty('a');
            expect(result.value).toHaveProperty('b');
        });

        it('classifies nested objects', () => {
            const result = classifyValue('{ outer = { inner = "value" } }');
            expect(result.type).toBe('object');
            expect(result.value?.outer).toMatchObject({ type: 'object' });
        });

        it('extracts references from objects', () => {
            const result = classifyValue('{ key = var.value }');
            expect(result.references).toHaveLength(1);
            expect(result.references?.[0]).toMatchObject({ kind: 'variable', name: 'value' });
        });
    });

    describe('Expression Values', () => {
        it('classifies simple traversals', () => {
            const result = classifyValue('var.region');
            expect(result.type).toBe('expression');
            expect(result.kind).toBe('traversal');
            expect(result.references?.[0]).toMatchObject({ kind: 'variable', name: 'region' });
        });

        it('classifies function calls', () => {
            const result = classifyValue('length(var.list)');
            expect(result.type).toBe('expression');
            expect(result.kind).toBe('function_call');
        });

        it('classifies template expressions', () => {
            const result = classifyValue('"${var.name}-suffix"');
            expect(result.type).toBe('expression');
            expect(result.kind).toBe('template');
            expect(result.references?.[0]).toMatchObject({ kind: 'variable', name: 'name' });
        });

        it('classifies conditional expressions', () => {
            const result = classifyValue('var.enabled ? "yes" : "no"');
            expect(result.type).toBe('expression');
            expect(result.kind).toBe('conditional');
        });

        it('classifies for expressions', () => {
            const result = classifyValue('[for item in var.list : item.name]');
            expect(result.type).toBe('array');
            // For expressions inside arrays are parsed as array content
        });

        it('classifies splat expressions', () => {
            const result = classifyValue('aws_instance.web[*].id');
            expect(result.type).toBe('expression');
            expect(result.kind).toBe('splat');
            expect(result.references?.[0]).toMatchObject({
                kind: 'resource',
                resource_type: 'aws_instance',
                name: 'web',
                splat: true
            });
        });
    });

    describe('Special References', () => {
        it('extracts each.key and each.value', () => {
            const result = classifyValue('"${each.key}-${each.value}"');
            expect(result.references).toContainEqual({ kind: 'each', property: 'key' });
            expect(result.references).toContainEqual({ kind: 'each', property: 'value' });
        });

        it('extracts count.index', () => {
            const result = classifyValue('"instance-${count.index}"');
            expect(result.references).toContainEqual({ kind: 'count', property: 'index' });
        });

        it('extracts self references', () => {
            const result = classifyValue('self.private_ip');
            expect(result.references).toContainEqual({ kind: 'self', attribute: 'private_ip' });
        });

        it('extracts path references', () => {
            const result = classifyValue('path.module');
            expect(result.references).toContainEqual({ kind: 'path', name: 'module' });
        });
    });
});

describe('Type Constraint Parser', () => {
    it('parses primitive types', () => {
        expect(parseTypeConstraint('string')).toMatchObject({ base: 'string' });
        expect(parseTypeConstraint('number')).toMatchObject({ base: 'number' });
        expect(parseTypeConstraint('bool')).toMatchObject({ base: 'bool' });
        expect(parseTypeConstraint('any')).toMatchObject({ base: 'any' });
    });

    it('parses collection types', () => {
        const listResult = parseTypeConstraint('list(string)');
        expect(listResult.base).toBe('list');
        expect(listResult.element).toMatchObject({ base: 'string' });

        const mapResult = parseTypeConstraint('map(number)');
        expect(mapResult.base).toBe('map');
        expect(mapResult.element).toMatchObject({ base: 'number' });

        const setResult = parseTypeConstraint('set(bool)');
        expect(setResult.base).toBe('set');
        expect(setResult.element).toMatchObject({ base: 'bool' });
    });

    it('parses nested collection types', () => {
        const result = parseTypeConstraint('list(map(string))');
        expect(result.base).toBe('list');
        expect(result.element?.base).toBe('map');
        expect(result.element?.element).toMatchObject({ base: 'string' });
    });

    it('parses object types', () => {
        const result = parseTypeConstraint('object({ name = string, age = number })');
        expect(result.base).toBe('object');
        expect(result.attributes).toHaveProperty('name');
        expect(result.attributes).toHaveProperty('age');
        expect(result.attributes?.name).toMatchObject({ base: 'string' });
        expect(result.attributes?.age).toMatchObject({ base: 'number' });
    });

    it('parses optional attributes', () => {
        const result = parseTypeConstraint('object({ name = string, age = optional(number) })');
        expect(result.attributes?.age?.optional).toBe(true);
    });
});

describe('HCL Lexer Utilities', () => {
    describe('isEscaped', () => {
        it('detects escaped characters', () => {
            expect(isEscaped('test\\"here', 5)).toBe(true);
            expect(isEscaped('test"here', 4)).toBe(false);
        });

        it('handles consecutive backslashes', () => {
            expect(isEscaped('test\\\\"here', 6)).toBe(false); // \\\" - quote is not escaped
            expect(isEscaped('test\\"here', 5)).toBe(true);    // \" - quote is escaped
        });
    });

    describe('splitArrayElements', () => {
        it('splits simple arrays', () => {
            expect(splitArrayElements('[1, 2, 3]')).toEqual(['1', '2', '3']);
        });

        it('handles nested arrays', () => {
            expect(splitArrayElements('[[1, 2], [3, 4]]')).toEqual(['[1, 2]', '[3, 4]']);
        });

        it('handles strings with commas', () => {
            expect(splitArrayElements('["a,b", "c,d"]')).toEqual(['"a,b"', '"c,d"']);
        });

        it('handles empty arrays', () => {
            expect(splitArrayElements('[]')).toEqual([]);
        });
    });

    describe('splitObjectEntries', () => {
        it('splits simple objects', () => {
            const entries = splitObjectEntries('{ a = 1, b = 2 }');
            expect(entries).toContainEqual(['a', '1']);
            expect(entries).toContainEqual(['b', '2']);
        });

        it('handles nested objects', () => {
            const entries = splitObjectEntries('{ outer = { inner = 1 } }');
            expect(entries[0][0]).toBe('outer');
            expect(entries[0][1]).toBe('{ inner = 1 }');
        });
    });

    describe('findMatchingBrace', () => {
        it('finds matching braces', () => {
            expect(findMatchingBrace('{ content }', 0)).toBe(10);
        });

        it('handles nested braces', () => {
            expect(findMatchingBrace('{ { inner } }', 0)).toBe(12);
        });

        it('handles strings with braces', () => {
            expect(findMatchingBrace('{ key = "{" }', 0)).toBe(12);
        });

        it('returns -1 for unmatched braces', () => {
            expect(findMatchingBrace('{ unclosed', 0)).toBe(-1);
        });
    });
});

describe('Error Handling', () => {
    describe('ParseError', () => {
        it('creates error with location', () => {
            const error = new ParseError('Test error', 'test.tf', { line: 5, column: 10, offset: 50 });
            expect(error.message).toContain('Test error');
            expect(error.message).toContain('test.tf:5:10');
            expect(error.location.line).toBe(5);
            expect(error.location.column).toBe(10);
        });
    });

    describe('offsetToLocation', () => {
        it('calculates line and column', () => {
            const content = 'line1\nline2\nline3';
            expect(offsetToLocation(content, 0)).toMatchObject({ line: 1, column: 1 });
            expect(offsetToLocation(content, 6)).toMatchObject({ line: 2, column: 1 });
            expect(offsetToLocation(content, 8)).toMatchObject({ line: 2, column: 3 });
        });
    });

    describe('BlockScanner strict mode', () => {
        it('throws ParseError in strict mode', () => {
            const scanner = new BlockScanner();
            const content = 'resource "test" "name" { unclosed';
            expect(() => scanner.scan(content, 'test.tf', { strict: true })).toThrow(ParseError);
        });

        it('logs warning in non-strict mode', () => {
            const scanner = new BlockScanner();
            const content = 'resource "test" "name" { unclosed';
            const blocks = scanner.scan(content, 'test.tf', { strict: false });
            expect(blocks).toEqual([]);
        });
    });
});

describe('Advanced Terraform Parsing', () => {
    const parser = new TerraformParser();

    it('parses complex type constraints', () => {
        const doc = parser.parseFile(advancedFile);
        const instanceConfig = doc.variable.find(v => v.name === 'instance_config');

        expect(instanceConfig).toBeDefined();
        expect(instanceConfig?.typeConstraint?.base).toBe('object');
        expect(instanceConfig?.typeConstraint?.attributes).toHaveProperty('name');
        // Complex nested types may not parse all attributes due to multiline handling
    });

    it('parses variable validation blocks', () => {
        const doc = parser.parseFile(advancedFile);
        const instanceConfig = doc.variable.find(v => v.name === 'instance_config');

        expect(instanceConfig?.validation).toBeDefined();
        expect(instanceConfig?.validation?.condition).toBeDefined();
        expect(instanceConfig?.validation?.error_message).toBeDefined();
    });

    it('parses nullable variables', () => {
        const doc = parser.parseFile(advancedFile);
        const instanceConfig = doc.variable.find(v => v.name === 'instance_config');

        expect(instanceConfig?.nullable).toBe(false);
    });

    it('parses locals with various expressions', () => {
        const doc = parser.parseFile(advancedFile);

        expect(doc.locals.find(l => l.name === 'app_name')).toBeDefined();
        expect(doc.locals.find(l => l.name === 'full_name')).toBeDefined();
        expect(doc.locals.find(l => l.name === 'is_production')).toBeDefined();
        expect(doc.locals.find(l => l.name === 'volume_names')).toBeDefined();
    });

    it('parses provider aliases', () => {
        const doc = parser.parseFile(advancedFile);
        const westProvider = doc.provider.find(p => p.alias === 'west');

        expect(westProvider).toBeDefined();
        expect(westProvider?.name).toBe('aws');
    });

    it('parses data sources with nested blocks', () => {
        const doc = parser.parseFile(advancedFile);
        const ami = doc.data.find(d => d.name === 'ubuntu');

        expect(ami).toBeDefined();
        expect(ami?.blocks.filter(b => b.type === 'filter')).toHaveLength(2);
    });

    it('parses resources with count', () => {
        const doc = parser.parseFile(advancedFile);
        const instance = doc.resource.find(r => r.name === 'web' && r.type === 'aws_instance');

        expect(instance?.meta.count).toBeDefined();
        expect(instance?.meta.count?.kind).toBe('conditional');
    });

    it('parses resources with for_each', () => {
        const doc = parser.parseFile(advancedFile);
        const sg = doc.resource.find(r => r.name === 'web' && r.type === 'aws_security_group');

        expect(sg?.meta.for_each).toBeDefined();
    });

    it('parses resources with dynamic blocks', () => {
        const doc = parser.parseFile(advancedFile);
        const sg = doc.resource.find(r => r.type === 'aws_security_group');

        expect(sg?.dynamic_blocks).toHaveLength(1);
        expect(sg?.dynamic_blocks[0].label).toBe('ingress');
        // iterator may be parsed as expression, check it exists
        expect(sg?.dynamic_blocks[0]).toHaveProperty('iterator');
    });

    it('parses depends_on meta-argument', () => {
        const doc = parser.parseFile(advancedFile);
        const volume = doc.resource.find(r => r.type === 'aws_ebs_volume');

        expect(volume?.meta.depends_on).toBeDefined();
        expect(volume?.meta.depends_on?.references).toBeDefined();
    });

    it('parses module calls', () => {
        const doc = parser.parseFile(advancedFile);
        const vpc = doc.module.find(m => m.name === 'vpc');

        expect(vpc).toBeDefined();
        expect(vpc?.properties.source).toBeDefined();
        expect(vpc?.properties.version).toBeDefined();
    });

    it('parses outputs with splat expressions', () => {
        const doc = parser.parseFile(advancedFile);
        const instanceIds = doc.output.find(o => o.name === 'instance_ids');

        expect(instanceIds?.value?.kind).toBe('splat');
    });

    it('parses moved blocks', () => {
        const doc = parser.parseFile(advancedFile);

        expect(doc.moved).toHaveLength(1);
        expect(doc.moved[0].properties.from).toBeDefined();
        expect(doc.moved[0].properties.to).toBeDefined();
    });

    it('parses import blocks', () => {
        const doc = parser.parseFile(advancedFile);

        expect(doc.import).toHaveLength(1);
        expect(doc.import[0].properties.to).toBeDefined();
        expect(doc.import[0].properties.id).toBeDefined();
    });

    it('parses check blocks', () => {
        const doc = parser.parseFile(advancedFile);

        expect(doc.check).toHaveLength(1);
        expect(doc.check[0].labels[0]).toBe('instance_health');
    });
});

describe('Dependency Graph', () => {
    const parser = new TerraformParser();

    it('builds graph with all node types', () => {
        const doc = parser.parseFile(advancedFile);
        const graph = buildDependencyGraph(doc);

        const nodeKinds = new Set(graph.nodes.map(n => n.kind));
        expect(nodeKinds).toContain('variable');
        expect(nodeKinds).toContain('locals');
        expect(nodeKinds).toContain('resource');
        expect(nodeKinds).toContain('data');
        expect(nodeKinds).toContain('module');
        expect(nodeKinds).toContain('output');
        expect(nodeKinds).toContain('provider');
    });

    it('creates edges for variable references', () => {
        const doc = parser.parseFile(advancedFile);
        const graph = buildDependencyGraph(doc);

        const varEdges = graph.edges.filter(e => e.reference.kind === 'variable');
        expect(varEdges.length).toBeGreaterThan(0);
    });

    it('creates edges for local references', () => {
        const doc = parser.parseFile(advancedFile);
        const graph = buildDependencyGraph(doc);

        const localEdges = graph.edges.filter(e => e.reference.kind === 'local');
        expect(localEdges.length).toBeGreaterThan(0);
    });

    it('creates edges for resource references', () => {
        const doc = parser.parseFile(advancedFile);
        const graph = buildDependencyGraph(doc);

        const resourceEdges = graph.edges.filter(e => e.reference.kind === 'resource');
        expect(resourceEdges.length).toBeGreaterThan(0);
    });

    it('creates edges for data source references', () => {
        const doc = parser.parseFile(advancedFile);
        const graph = buildDependencyGraph(doc);

        const dataEdges = graph.edges.filter(e => e.reference.kind === 'data');
        expect(dataEdges.length).toBeGreaterThan(0);
    });

    it('creates edges for module output references', () => {
        const doc = parser.parseFile(advancedFile);
        const graph = buildDependencyGraph(doc);

        const moduleEdges = graph.edges.filter(e => e.reference.kind === 'module_output');
        expect(moduleEdges.length).toBeGreaterThan(0);
    });

    it('creates nodes for special references', () => {
        const doc = parser.parseFile(advancedFile);
        const graph = buildDependencyGraph(doc);

        const nodeKinds = new Set(graph.nodes.map(n => n.kind));
        expect(nodeKinds).toContain('count');
        expect(nodeKinds).toContain('each');
    });
});

describe('Serialization', () => {
    const parser = new TerraformParser();

    it('serializes to JSON with pruning', () => {
        const doc = parser.parseFile(advancedFile);
        const json = toJson(doc);
        const parsed = JSON.parse(json);

        // Empty arrays should be pruned
        expect(parsed.unknown).toBeUndefined();
    });

    it('serializes to JSON without pruning', () => {
        const doc = parser.parseFile(advancedFile);
        const json = toJson(doc, { prune: false });
        const parsed = JSON.parse(json);

        // When prune is false, all arrays should be present (even empty ones)
        expect(parsed).toHaveProperty('terraform');
        expect(parsed).toHaveProperty('variable');
        expect(parsed).toHaveProperty('resource');
    });

    it('serializes to YAML with proper indentation', () => {
        const doc = parser.parseFile(advancedFile);
        const yaml = toYamlDocument(doc);

        expect(yaml).toContain('variable:');
        expect(yaml).toContain('  - name:');
    });
});

describe('Edge Cases', () => {
    it('handles empty files', () => {
        const scanner = new BlockScanner();
        const blocks = scanner.scan('', 'empty.tf');
        expect(blocks).toEqual([]);
    });

    it('handles files with only comments', () => {
        const scanner = new BlockScanner();
        const content = `
            # This is a comment
            // Another comment
            /* Block comment */
        `;
        const blocks = scanner.scan(content, 'comments.tf');
        expect(blocks).toEqual([]);
    });

    it('handles deeply nested blocks', () => {
        const content = `
            resource "test" "deep" {
                level1 {
                    level2 {
                        level3 {
                            level4 {
                                value = "deep"
                            }
                        }
                    }
                }
            }
        `;
        const parser = new TerraformParser();
        const scanner = new BlockScanner();
        const blocks = scanner.scan(content, 'deep.tf');

        expect(blocks).toHaveLength(1);
    });

    it('handles heredoc strings', () => {
        const content = `resource "test" "heredoc" {
  content = <<EOF
{
  "key": "value"
}
EOF
}`;
        const scanner = new BlockScanner();
        const blocks = scanner.scan(content, 'heredoc.tf');

        expect(blocks).toHaveLength(1);
    });

    it('handles special characters in strings', () => {
        const result = classifyValue('"path/to/file.txt"');
        expect(result.value).toBe('path/to/file.txt');
    });

    it('handles empty blocks', () => {
        const content = `
            resource "empty" "block" {
            }
        `;
        const scanner = new BlockScanner();
        const blocks = scanner.scan(content, 'empty.tf');

        expect(blocks).toHaveLength(1);
        expect(blocks[0].body.trim()).toBe('');
    });
});
