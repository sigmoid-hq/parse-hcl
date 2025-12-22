import fs from 'fs';
import path from 'path';
import { TerraformParser, TfVarsParser, toJson, toJsonExport, toYamlDocument } from '..';

const EXAMPLE_DIR = path.resolve(__dirname, '../../examples/terraform');
const TFVARS_FILE = path.resolve(EXAMPLE_DIR, 'vars.auto.tfvars');
const TFVARS_JSON_FILE = path.resolve(EXAMPLE_DIR, 'vars.auto.tfvars.json');
const OUTPUT_DIR = path.resolve(__dirname, '../../output');

function ensureOutputDir(): void {
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
        // eslint-disable-next-line no-console
        console.info(`Created output directory at ${OUTPUT_DIR}`);
    }
}

function writeExampleOutputs(): void {
    const parser = new TerraformParser();
    const result = parser.parseDirectory(EXAMPLE_DIR, { aggregate: true, includePerFile: true });

    if (result.combined) {
        fs.writeFileSync(path.join(OUTPUT_DIR, 'combined.json'), toJson(result.combined));
        fs.writeFileSync(path.join(OUTPUT_DIR, 'combined.yaml'), toYamlDocument(result.combined));
        fs.writeFileSync(
            path.join(OUTPUT_DIR, 'combined.graph.json'),
            toJsonExport(result.combined, { pruneEmpty: true })
        );
        fs.writeFileSync(
            path.join(OUTPUT_DIR, 'combined.full.json'),
            toJson(result.combined, { pruneEmpty: false })
        );
    }

    for (const file of result.files) {
        const base = path.basename(file.path, path.extname(file.path));
        fs.writeFileSync(path.join(OUTPUT_DIR, `${base}.json`), toJson(file.document));
    }

    const tfvarsParser = new TfVarsParser();
    [TFVARS_FILE, TFVARS_JSON_FILE]
        .filter((p) => fs.existsSync(p))
        .forEach((filePath) => {
            const tfvars = tfvarsParser.parseFile(filePath);
            const base = path.basename(filePath);
            fs.writeFileSync(path.join(OUTPUT_DIR, `${base}.json`), JSON.stringify(tfvars, null, 2));
        });

    // eslint-disable-next-line no-console
    console.info(`Example outputs written to ${OUTPUT_DIR}`);
}

export function runExample(): void {
    ensureOutputDir();
    writeExampleOutputs();
}

if (require.main === module) {
    runExample();
}
