import path from 'path';
import { describe, expect, it } from 'vitest';
import { TfPlanParser, TfStateParser, TfVarsParser } from '../src/services/artifactParsers';
import { TerraformParser } from '../src/services/terraformParser';
import { buildDependencyGraph } from '../src/utils/graphBuilder';

const fixturesDir = path.join(__dirname, 'fixtures');

describe('Terraform artifact parsers', () => {
    it('parses tfvars assignments', () => {
        const file = path.join(fixturesDir, 'sample.tfvars');
        const parsed = new TfVarsParser().parseFile(file);

        expect(parsed.assignments.project.type).toBe('literal');
        expect(parsed.assignments.env.type).toBe('literal');
        expect(parsed.assignments.cidrs.type).toBe('array');
    });

    it('parses terraform state', () => {
        const file = path.join(fixturesDir, 'terraform.tfstate');
        const parsed = new TfStateParser().parseFile(file);

        expect(parsed.version).toBe(4);
        expect(parsed.outputs.bucket_name.value).toBe('demo-bucket');
        expect(parsed.resources[0].type).toBe('aws_s3_bucket');
        expect(parsed.resources[0].instances[0].attributes?.bucket).toBe('demo-bucket');
    });

    it('parses terraform plan json', () => {
        const file = path.join(fixturesDir, 'plan.json');
        const parsed = new TfPlanParser().parseFile(file);

        expect(parsed.format_version).toBe('1.0');
        expect(parsed.resource_changes[0].change.actions).toContain('create');
        expect(parsed.planned_values?.root_module?.resources?.[0].values?.bucket).toBe('demo-bucket');
    });
});

describe('Dependency graph builder', () => {
    const mainFile = path.join(fixturesDir, 'main.tf');
    const dependsOnFile = path.join(fixturesDir, 'depends_on.tf');

    it('builds nodes and edges from parsed document', () => {
        const doc = new TerraformParser().parseFile(mainFile);
        const graph = buildDependencyGraph(doc);

        const resourceNodeId = 'resource.aws_s3_bucket.demo';
        const localNodeId = 'locals.name_prefix';
        const outputNodeId = 'output.bucket_name';

        expect(graph.nodes.some((node) => node.id === resourceNodeId)).toBe(true);
        expect(graph.nodes.some((node) => node.id === outputNodeId)).toBe(true);
        expect(graph.edges.some((edge) => edge.to === localNodeId && edge.from === resourceNodeId)).toBe(true);
        expect(graph.edges.some((edge) => edge.to === resourceNodeId && edge.from === outputNodeId)).toBe(true);
    });

    it('connects depends_on references', () => {
        const doc = new TerraformParser().parseFile(dependsOnFile);
        const graph = buildDependencyGraph(doc);

        const baseId = 'resource.aws_s3_bucket.base';
        const dependentId = 'resource.aws_s3_bucket.dependent';

        expect(graph.edges.some((edge) => edge.from === dependentId && edge.to === baseId)).toBe(true);
    });
});
