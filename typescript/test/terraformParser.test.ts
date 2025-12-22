import path from 'path';
import { describe, expect, it } from 'vitest';
import { TerraformParser } from '../src/services/terraformParser';
import { toJson, toYamlDocument } from '../src/utils/serializer';

const fixturesDir = path.join(__dirname, 'fixtures');
const mainFile = path.join(fixturesDir, 'main.tf');
const dataFile = path.join(fixturesDir, 'data.tf');
const dynamicFile = path.join(fixturesDir, 'dynamic.tf');

describe('TerraformParser', () => {
    const parser = new TerraformParser();

    it('parses core blocks from a single file', () => {
        const doc = parser.parseFile(mainFile);

        expect(doc.variable).toHaveLength(1);
        expect(doc.variable[0].name).toBe('region');
        expect(doc.provider[0].name).toBe('aws');
        expect(doc.locals).toHaveLength(1);
        expect(doc.locals[0].name).toBe('name_prefix');

        expect(doc.resource).toHaveLength(1);
        const bucket = doc.resource[0];
        expect(bucket.type).toBe('aws_s3_bucket');
        expect(bucket.name).toBe('demo');
        expect(bucket.meta.count?.type).toBe('literal');
        expect(bucket.meta.count?.raw).toBe('2');
        expect(bucket.properties.bucket?.type).toBe('expression');
        expect(bucket.properties.count).toBeUndefined();

        expect(doc.output).toHaveLength(1);
        expect(doc.output[0].value?.type).toBe('expression');
        expect(doc.output[0].value?.references?.[0]).toMatchObject({
            kind: 'resource',
            resource_type: 'aws_s3_bucket',
            name: 'demo'
        });
    });

    it('aggregates multiple files when parsing a directory', () => {
        const result = parser.parseDirectory(fixturesDir);

        expect(result.files.length).toBe(4);
        expect(result.combined?.data).toHaveLength(1);
        expect(result.combined?.resource).toHaveLength(3);
        expect(result.combined?.variable).toHaveLength(2);
    });

    it('omits empty top-level collections when serializing', () => {
        const doc = parser.parseFile(dataFile);
        const json = toJson(doc);

        expect(json.includes('"locals"')).toBe(false);
        expect(json.includes('"variable"')).toBe(false);
        expect(json.includes('"resource"')).toBe(false);
        expect(json.includes('"data"')).toBe(true);
    });

    it('normalizes raw block formatting', () => {
        const doc = parser.parseFile(mainFile);
        const raw = doc.variable[0].raw;

        expect(raw.startsWith('variable "region" {')).toBe(true);
        expect(raw.includes('\n  type        =')).toBe(false);
        expect(raw.includes('type = string')).toBe(true);
    });

    it('emits yaml with 2-space indentation', () => {
        const doc = parser.parseFile(mainFile);
        const yaml = toYamlDocument(doc);
        const lines = yaml.split('\n');

        // check list indentation and nested map indentation
        expect(lines.some((line) => line.startsWith('  - type: aws_s3_bucket'))).toBe(true);
        expect(lines.some((line) => line.startsWith('    name: demo'))).toBe(true);
    });

    it('omits empty nested arrays like blocks/dynamic_blocks', () => {
        const doc = parser.parseFile(mainFile);
        const json = toJson(doc);

        expect(json.includes('"blocks"')).toBe(false);
        expect(json.includes('dynamic_blocks')).toBe(false);
    });

    it('parses dynamic/import/moved/check blocks', () => {
        const doc = parser.parseFile(dynamicFile);

        expect(doc.resource[0].dynamic_blocks).toHaveLength(1);
        expect(doc.resource[0].dynamic_blocks[0].label).toBe('ingress');
        expect(doc.moved).toHaveLength(1);
        expect(doc.import).toHaveLength(1);
        expect(doc.check).toHaveLength(1);
    });
});
