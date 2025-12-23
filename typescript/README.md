# parse-hcl

[![npm version](https://img.shields.io/npm/v/parse-hcl.svg?label=npm&color=blue)](https://www.npmjs.com/package/parse-hcl)
[![license](https://img.shields.io/npm/l/parse-hcl.svg?color=blue)](LICENSE)
[![build](https://img.shields.io/badge/tests-vitest-brightgreen)](#development)

Lightweight Terraform parser for TypeScript. It extracts top-level Terraform blocks (resource, variable, output, module, provider, data, terraform, locals, etc.), tfvars/tfstate/plan JSON artifacts, and serializes results to JSON/YAML.

## Install
```bash
yarn add parse-hcl
```

## Usage
```ts
import {
    TerraformParser,
    toJson,
    toJsonExport,
    toYamlDocument,
    buildDependencyGraph,
    TfVarsParser,
    TfStateParser,
    TfPlanParser
} from 'parse-hcl';

const parser = new TerraformParser();

// Single file
const doc = parser.parseFile('examples/terraform/main.tf');
console.log(toJson(doc));           // prunes empty structures by default
console.log(toYamlDocument(doc));   // YAML output
console.log(toJsonExport(doc));     // { version, document, graph }
console.log(buildDependencyGraph(doc));

// Directory (aggregated + per-file)
const dir = parser.parseDirectory('examples/terraform', { aggregate: true, includePerFile: true });
console.log(dir.combined);
console.log(dir.files[0].path);

// Other Terraform artifacts
const tfvars = new TfVarsParser().parseFile('examples/terraform/variables.auto.tfvars');
const state = new TfStateParser().parseFile('terraform.tfstate');
const plan = new TfPlanParser().parseFile('plan.json'); // terraform show -json output

// tf.json
const jsonDoc = parser.parseFile('examples/terraform/config.tf.json');
console.log(toJson(jsonDoc, { pruneEmpty: false })); // keep empty collections
```

## CLI
설치 후 전역 실행(또는 npx):
```bash
parse-hcl --file examples/terraform/main.tf --format json
parse-hcl --dir examples/terraform --graph --format yaml
parse-hcl --file examples/terraform/vars.auto.tfvars.json --format json --no-prune
```

레포 내에서 직접 실행:
```bash
yarn build
node dist/cli.js --file examples/terraform/main.tf --format json
node dist/cli.js --dir examples/terraform --graph --format yaml
node dist/cli.js --file examples/terraform/vars.auto.tfvars.json --format json --no-prune
```

## Examples
```bash
yarn example            # generates ./output/combined.(json|yaml)
yarn example:usage      # basic tf / tf.json console output
yarn example:artifacts  # tfvars / tfstate / plan console output
```

## Development
```bash
yarn install
yarn build
yarn test
```

## Notes
- Block scanning balances braces while respecting strings, heredocs, and comments.
- Inside a block, top-level `key = value` becomes `attributes`; nested blocks are preserved in `blocks`.
- Values are classified as literal/array/object/expression; complex expressions retain the original `raw`.
- Directory parsing options:
  - `aggregate` (default: `true`): combine into one `TerraformDocument`
  - `includePerFile` (default: `true`): include per-file results
