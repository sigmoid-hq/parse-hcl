import path from 'path';
import { describe, expect, it } from 'vitest';
import { TerraformParser } from '../src/services/terraformParser';
import { toJson } from '../src/utils/serializer';

const fixturesDir = path.join(__dirname, 'fixtures');
const mainFile = path.join(fixturesDir, 'main.tf');
const dataFile = path.join(fixturesDir, 'data.tf');

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
    });

    it('aggregates multiple files when parsing a directory', () => {
        const result = parser.parseDirectory(fixturesDir);

        expect(result.files.length).toBe(2);
        expect(result.combined?.data).toHaveLength(1);
        expect(result.combined?.resource).toHaveLength(1);
        expect(result.combined?.variable).toHaveLength(1);
    });

    it('omits empty top-level collections when serializing', () => {
        const doc = parser.parseFile(dataFile);
        const json = toJson(doc);

        expect(json.includes('"locals"')).toBe(false);
        expect(json.includes('"variable"')).toBe(false);
        expect(json.includes('"resource"')).toBe(false);
        expect(json.includes('"data"')).toBe(true);
    });
});
