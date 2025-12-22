import path from 'path';
import { describe, expect, it } from 'vitest';
import { TerraformParser } from '../src/services/terraformParser';
import { TfVarsParser } from '../src/services/artifactParsers';
import { toJson } from '../src/utils/serializer';

const fixturesDir = path.join(__dirname, 'fixtures');
const tfJsonFile = path.join(fixturesDir, 'config.tf.json');
const tfvarsJsonFile = path.join(fixturesDir, 'vars.auto.tfvars.json');

describe('Terraform JSON parser', () => {
    const parser = new TerraformParser();

    it('parses .tf.json configs', () => {
        const doc = parser.parseFile(tfJsonFile);

        expect(doc.provider[0].name).toBe('aws');
        expect(doc.locals[0].name).toBe('name_prefix');
        expect(doc.resource[0].type).toBe('aws_s3_bucket');
        expect(doc.output[0].value?.references?.[0]).toMatchObject({
            kind: 'resource',
            resource_type: 'aws_s3_bucket'
        });
    });
});

describe('tfvars json parser', () => {
    it('parses assignments from tfvars json', () => {
        const parsed = new TfVarsParser().parseFile(tfvarsJsonFile);
        expect(parsed.assignments.project.type).toBe('literal');
        expect(parsed.assignments.cidrs.type).toBe('array');
    });

    it('respects prune toggle on serialization', () => {
        const parser = new TerraformParser();
        const doc = parser.parseFile(tfJsonFile);
        const full = toJson(doc, { pruneEmpty: false });
        expect(full.includes('unknown')).toBe(true);
        const pruned = toJson(doc);
        expect(pruned.includes('unknown')).toBe(false);
    });
});
