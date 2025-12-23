# parse-hcl

[![npm version](https://img.shields.io/npm/v/parse-hcl.svg?label=npm&color=blue)](https://www.npmjs.com/package/parse-hcl)
[![license](https://img.shields.io/npm/l/parse-hcl.svg?color=blue)](LICENSE)
[![build](https://img.shields.io/badge/tests-vitest-brightgreen)](#development)
[![python](https://img.shields.io/badge/python-3.9%2B-blue)](https://github.com/sigmoid-hq/parse-hcl/tree/main/python)

Lightweight Terraform parser for TypeScript **and Python**. It extracts top-level Terraform blocks (resource, variable, output, module, provider, data, terraform, locals, etc.), tfvars/tfstate/plan JSON artifacts, and serializes results to JSON/YAML.

## Install
TypeScript/Node:
```bash
yarn add parse-hcl
```

Python:
```bash
pip install parse-hcl           # when published
pip install ./python            # from this repo
```

## Usage
TypeScript:
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

Python:
```python
from parse_hcl import (
    TerraformParser,
    TfVarsParser,
    TfStateParser,
    TfPlanParser,
    to_json,
    to_json_export,
    to_yaml_document,
    build_dependency_graph,
)

parser = TerraformParser()

doc = parser.parse_file("examples/terraform/main.tf")
print(to_json(doc))           # prunes empty structures by default
print(to_yaml_document(doc))  # YAML output
print(to_json_export(doc))    # { version, document, graph }
print(build_dependency_graph(doc))

tfvars = TfVarsParser().parse_file("examples/terraform/variables.auto.tfvars")
state = TfStateParser().parse_file("terraform.tfstate")
plan = TfPlanParser().parse_file("plan.json")  # terraform show -json output
```

## CLI
설치 후 전역 실행(또는 npx/pipx). npm 또는 pip 어느 쪽으로 설치해도 `parse-hcl` 명령을 제공합니다.
```bash
parse-hcl --file examples/terraform/main.tf --format json
parse-hcl --dir examples/terraform --graph --format yaml
parse-hcl --file examples/terraform/vars.auto.tfvars.json --format json --no-prune
```

레포 내에서 직접 실행:
```bash
# Node/TypeScript build
yarn build
node dist/cli.js --file examples/terraform/main.tf --format json
node dist/cli.js --dir examples/terraform --graph --format yaml
node dist/cli.js --file examples/terraform/vars.auto.tfvars.json --format json --no-prune

# Python CLI
python -m parse_hcl.cli --file examples/terraform/main.tf --format json
python -m parse_hcl.cli --dir examples/terraform --graph --format yaml
```

## Examples
```bash
yarn example            # generates ./output/combined.(json|yaml)
yarn example:usage      # basic tf / tf.json console output
yarn example:artifacts  # tfvars / tfstate / plan console output
```

## Development
```bash
# TypeScript
yarn install
yarn build
yarn test

# Python
pip install ./python
python -m unittest discover -s python/tests
```

## Notes
- Block scanning balances braces while respecting strings, heredocs, and comments.
- Inside a block, top-level `key = value` becomes `attributes`; nested blocks are preserved in `blocks`.
- Values are classified as literal/array/object/expression; complex expressions retain the original `raw`.
- Directory parsing options:
  - `aggregate` (default: `true`): combine into one `TerraformDocument`
  - `includePerFile` (default: `true`): include per-file results
