import path from 'path';
import fs from 'fs';
import { TfPlanParser, TfStateParser, TfVarsParser, TerraformParser, toJson, toJsonExport } from '..';

const exampleDir = path.resolve(__dirname, '../../examples/terraform');
const tfvarsFile = path.join(exampleDir, 'vars.auto.tfvars');
const tfvarsJsonFile = path.join(exampleDir, 'vars.auto.tfvars.json');
const tfJsonFile = path.join(exampleDir, 'config.tf.json');
const planFile = path.resolve(__dirname, '../../test/fixtures/plan.json');
const stateFile = path.resolve(__dirname, '../../test/fixtures/terraform.tfstate');

function maybeLog(label: string, content: string): void {
    // eslint-disable-next-line no-console
    console.log(`--- ${label} ---`);
    // eslint-disable-next-line no-console
    console.log(content);
}

function parseTfvars(): void {
    const parser = new TfVarsParser();
    [tfvarsFile, tfvarsJsonFile]
        .filter((filePath) => fs.existsSync(filePath))
        .forEach((filePath) => {
            const parsed = parser.parseFile(filePath);
            maybeLog(`tfvars ${path.basename(filePath)}`, JSON.stringify(parsed, null, 2));
        });
}

function parseStateAndPlan(): void {
    if (fs.existsSync(stateFile)) {
        const state = new TfStateParser().parseFile(stateFile);
        maybeLog('terraform.tfstate', JSON.stringify(state, null, 2));
    }

    if (fs.existsSync(planFile)) {
        const plan = new TfPlanParser().parseFile(planFile);
        maybeLog('plan.json', JSON.stringify(plan, null, 2));
    }
}

function parseTfJson(): void {
    if (!fs.existsSync(tfJsonFile)) return;
    const doc = new TerraformParser().parseFile(tfJsonFile);
    maybeLog('tf.json document', toJson(doc));
    maybeLog('tf.json export (graph)', toJsonExport(doc));
}

export function runArtifactUsage(): void {
    parseTfvars();
    parseStateAndPlan();
    parseTfJson();
}

if (require.main === module) {
    runArtifactUsage();
}
