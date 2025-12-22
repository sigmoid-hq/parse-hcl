import path from 'path';
import { TerraformParser, toJson, toJsonExport, toYamlDocument } from '..';

const exampleDir = path.resolve(__dirname, '../../examples/terraform');
const mainTf = path.join(exampleDir, 'main.tf');

function parseSingleFile(): void {
    const parser = new TerraformParser();
    const doc = parser.parseFile(mainTf);

    // eslint-disable-next-line no-console
    console.log('--- Single file (JSON, pruned) ---');
    console.log(toJson(doc));

    // eslint-disable-next-line no-console
    console.log('--- Single file (YAML) ---');
    console.log(toYamlDocument(doc));

    // eslint-disable-next-line no-console
    console.log('--- Single file (with graph) ---');
    console.log(toJsonExport(doc));
}

function parseDirectory(): void {
    const parser = new TerraformParser();
    const result = parser.parseDirectory(exampleDir, { aggregate: true, includePerFile: true });

    // eslint-disable-next-line no-console
    console.log('--- Directory aggregated JSON ---');
    if (result.combined) {
        console.log(toJson(result.combined));
    }

    // eslint-disable-next-line no-console
    console.log('--- Directory per-file JSON (pruned) ---');
    for (const file of result.files) {
        console.log(`# ${file.path}`);
        console.log(toJson(file.document));
    }
}

export function runBasicUsage(): void {
    parseSingleFile();
    parseDirectory();
}

if (require.main === module) {
    runBasicUsage();
}
