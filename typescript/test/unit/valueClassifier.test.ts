import { describe, expect, it } from 'vitest';
import { classifyValue } from '../../src/utils/parser/valueClassifier';

describe('valueClassifier references', () => {
    it('extracts references inside arrays such as depends_on', () => {
        const value = classifyValue('[aws_s3_bucket.demo, module.mod.output]');

        expect(value.type).toBe('array');
        expect(value.references).toEqual(
            expect.arrayContaining([
                { kind: 'resource', resource_type: 'aws_s3_bucket', name: 'demo', attribute: undefined },
                { kind: 'module_output', module: 'mod', name: 'output' }
            ])
        );
    });

    it('handles indexed traversals and keeps attribute', () => {
        const value = classifyValue('aws_s3_bucket.demo[0].bucket');

        expect(value.type).toBe('expression');
        expect(value.references).toEqual(
            expect.arrayContaining([
                {
                    kind: 'resource',
                    resource_type: 'aws_s3_bucket',
                    name: 'demo',
                    attribute: 'bucket'
                }
            ])
        );
    });
});
