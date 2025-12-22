# parse-hcl

Lightweight Terraform parser for TypeScript. It extracts top-level Terraform blocks (resource, variable, output, module, provider, data, terraform, locals, etc.) from single files or directories and serializes them to JSON/YAML.

## Highlights
- Scans top-level blocks and dispatches to block-specific parsers
- Supports resource/data/module/provider/terraform/locals/variable/output blocks
- Detects moved/import/check/terraform_data/unknown blocks
- Parses tfvars/tfstate/tfplan (JSON), tfvars.json, and tf.json configs
- Serialization prunes empty collections/objects by default (`pruneEmpty: false` keeps everything)
- Exports dependency graphs
- Directory parsing can return per-file results and aggregated output

## How to use
1) Install and build
```bash
cd typescript
yarn install
yarn build
```

2) In code
```ts
import {
  TerraformParser,
  toJson,
  toYamlDocument,
  toJsonExport,
  buildDependencyGraph,
  TfVarsParser,
  TfStateParser,
  TfPlanParser
} from './dist';

const parser = new TerraformParser();
const single = parser.parseFile('examples/main.tf');
console.log(toJson(single)); // pruneEmpty default applied
console.log(toYamlDocument(single));
console.log(toJsonExport(single)); // { version, document, graph }
console.log(buildDependencyGraph(single));

const dirResult = parser.parseDirectory('examples', { aggregate: true, includePerFile: true });
console.log(dirResult.combined);      // aggregated result
console.log(dirResult.files[0].path); // per-file result

// Other Terraform artifacts
const tfvars = new TfVarsParser().parseFile('examples/variables.auto.tfvars');
const state = new TfStateParser().parseFile('terraform.tfstate');
const plan = new TfPlanParser().parseFile('plan.json'); // terraform show -json output

// tf.json parsing
const jsonDoc = parser.parseFile('examples/config.tf.json');
console.log(toJson(jsonDoc, { pruneEmpty: false })); // keep empty collections
```

3) Run examples
```bash
cd typescript
yarn example
# Generates sample outputs like ./output/combined.json and ./output/combined.yaml
yarn example:usage      # console examples for tf/tf.json
yarn example:artifacts  # console examples for tfvars/tfstate/plan
```

4) Quick CLI
```bash
cd typescript
yarn cli --file examples/main.tf --format json
yarn cli --dir examples/terraform --graph --format yaml
yarn cli --file examples/vars.auto.tfvars.json --format json --no-prune
```

## Parsing notes
- Block scanning balances braces while respecting strings and comments.
- Inside a block, top-level `key = value` assignments become `attributes`; nested blocks remain as `blocks`.
- Values are classified as string/number/boolean/array/object/expression; complex expressions keep the original `raw`.

## Tests
```bash
cd typescript
yarn test
```

## Directory parsing options
- `aggregate` (default: `true`): Combine all files into a single `TerraformDocument`.
- `includePerFile` (default: `true`): Include per-file parse results.
