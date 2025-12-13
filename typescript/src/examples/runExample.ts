import fs from 'fs';
import path from 'path';
import { TerraformParser } from '../services/terraformParser';
import { toJson, toYamlDocument } from '../utils/serializer';
import { logger } from '../utils/logger';

const EXAMPLE_DIR = path.resolve(__dirname, '../../examples/terraform');
const OUTPUT_DIR = path.resolve(__dirname, '../../output');

function ensureOutputDir(): void {
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
        logger.info(`Created output directory at ${OUTPUT_DIR}`);
    }
}

function writeExampleOutputs(): void {
    const parser = new TerraformParser();
    const result = parser.parseDirectory(EXAMPLE_DIR, { aggregate: true, includePerFile: true });

    if (result.combined) {
        fs.writeFileSync(path.join(OUTPUT_DIR, 'combined.json'), toJson(result.combined));
        fs.writeFileSync(path.join(OUTPUT_DIR, 'combined.yaml'), toYamlDocument(result.combined));
    }

    for (const file of result.files) {
        const base = path.basename(file.path, path.extname(file.path));
        fs.writeFileSync(path.join(OUTPUT_DIR, `${base}.json`), toJson(file.document));
    }

    logger.info(`Example outputs written to ${OUTPUT_DIR}`);
}

export function runExample(): void {
    ensureOutputDir();
    writeExampleOutputs();
}

if (require.main === module) {
    runExample();
}
