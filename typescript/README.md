# parse-hcl (TypeScript/Node.js)

[![npm version](https://img.shields.io/npm/v/parse-hcl.svg?label=npm&color=blue)](https://www.npmjs.com/package/parse-hcl)
[![license](https://img.shields.io/npm/l/parse-hcl.svg?color=blue)](../LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/typescript-5.x-blue)](https://www.typescriptlang.org/)

A lightweight, zero-dependency Terraform/HCL parser for TypeScript and Node.js. This package provides both a powerful CLI tool and a programmatic API for parsing Terraform configurations.

## Table of Contents

- [Installation](#installation)
- [CLI Usage](#cli-usage)
  - [Basic Commands](#basic-commands)
  - [Options Reference](#options-reference)
  - [Output Formats](#output-formats)
  - [File Type Detection](#file-type-detection)
- [Programmatic API](#programmatic-api)
  - [Parsing Files](#parsing-files)
  - [Parsing Directories](#parsing-directories)
  - [Parsing Artifacts](#parsing-artifacts)
  - [Building Dependency Graphs](#building-dependency-graphs)
  - [Serialization](#serialization)
- [Type Definitions](#type-definitions)
- [Examples](#examples)
- [Development](#development)

---

## Installation

```bash
# Global installation (recommended for CLI usage)
npm install -g parse-hcl
yarn global add parse-hcl
pnpm add -g parse-hcl

# Local installation (for programmatic usage)
npm install parse-hcl
yarn add parse-hcl
pnpm add parse-hcl
```

**Requirements:** Node.js >= 18

---

## CLI Usage

The `parse-hcl` CLI provides instant Terraform configuration analysis from your terminal.

### Basic Commands

```bash
# Parse a single Terraform file (JSON output)
parse-hcl --file main.tf

# Parse with YAML output
parse-hcl --file main.tf --format yaml

# Parse entire directory
parse-hcl --dir ./terraform

# Parse directory with dependency graph
parse-hcl --dir ./terraform --graph

# Parse tfvars file
parse-hcl --file variables.tfvars

# Parse Terraform state file
parse-hcl --file terraform.tfstate

# Parse Terraform plan output
parse-hcl --file plan.json

# Keep empty arrays/objects in output
parse-hcl --file main.tf --no-prune
```

### Options Reference

| Option | Description | Default |
|--------|-------------|---------|
| `--file <path>` | Parse a single file | - |
| `--dir <path>` | Parse all `.tf` and `.tf.json` files in directory (recursive) | - |
| `--format <type>` | Output format: `json` or `yaml` | `json` |
| `--graph` | Include dependency graph (nodes, edges, references) | `false` |
| `--no-prune` | Keep empty arrays and objects in output | `false` |

### Output Formats

**JSON Output (default):**
```bash
$ parse-hcl --file main.tf --format json
```

```json
{
  "resource": [
    {
      "type": "aws_s3_bucket",
      "name": "demo",
      "properties": {
        "bucket": {
          "type": "expression",
          "kind": "template",
          "raw": "${local.name_prefix}-bucket",
          "references": [
            { "kind": "local", "name": "name_prefix" }
          ]
        }
      },
      "meta": {
        "count": { "type": "literal", "value": 2, "raw": "2" }
      },
      "raw": "resource \"aws_s3_bucket\" \"demo\" { ... }",
      "source": "/path/to/main.tf"
    }
  ],
  "variable": [...],
  "output": [...],
  "locals": [...],
  "provider": [...],
  "terraform": [...]
}
```

**YAML Output:**
```bash
$ parse-hcl --file main.tf --format yaml
```

```yaml
resource:
  - type: aws_s3_bucket
    name: demo
    properties:
      bucket:
        type: expression
        kind: template
        raw: "${local.name_prefix}-bucket"
        references:
          - kind: local
            name: name_prefix
    meta:
      count:
        type: literal
        value: 2
variable:
  - name: region
    type: string
    default:
      type: literal
      value: us-east-1
```

**Graph Output:**
```bash
$ parse-hcl --file main.tf --graph --format json
```

```json
{
  "version": "1.0.0",
  "document": {
    "resource": [...],
    "variable": [...],
    "output": [...],
    "locals": [...]
  },
  "graph": {
    "nodes": [
      {
        "id": "resource.aws_s3_bucket.demo",
        "kind": "resource",
        "type": "aws_s3_bucket",
        "name": "demo",
        "source": "/path/to/main.tf"
      },
      {
        "id": "locals.name_prefix",
        "kind": "locals",
        "name": "name_prefix"
      },
      {
        "id": "output.bucket_name",
        "kind": "output",
        "name": "bucket_name"
      }
    ],
    "edges": [
      {
        "from": "resource.aws_s3_bucket.demo",
        "to": "locals.name_prefix",
        "reference": { "kind": "local", "name": "name_prefix" }
      },
      {
        "from": "output.bucket_name",
        "to": "resource.aws_s3_bucket.demo",
        "reference": { "kind": "resource", "resource_type": "aws_s3_bucket", "name": "demo" }
      }
    ],
    "orphanReferences": []
  }
}
```

### File Type Detection

The CLI automatically detects file types:

| Extension/Pattern | Parser Used | Description |
|-------------------|-------------|-------------|
| `*.tf` | TerraformParser | HCL configuration files |
| `*.tf.json` | TerraformJsonParser | JSON-format Terraform configs |
| `*.tfvars`, `*.tfvars.json` | TfVarsParser | Variable assignment files |
| `*.tfstate` | TfStateParser | Terraform state files |
| `*plan.json` | TfPlanParser | `terraform show -json` output |

---

## Programmatic API

### Parsing Files

```typescript
import { TerraformParser, toJson, toYamlDocument } from 'parse-hcl';

const parser = new TerraformParser();

// Parse a single .tf file
const doc = parser.parseFile('main.tf');

// Access parsed blocks
console.log(doc.resource);   // ResourceBlock[]
console.log(doc.variable);   // VariableBlock[]
console.log(doc.output);     // OutputBlock[]
console.log(doc.locals);     // LocalValue[]
console.log(doc.module);     // ModuleBlock[]
console.log(doc.provider);   // ProviderBlock[]
console.log(doc.data);       // DataBlock[]
console.log(doc.terraform);  // TerraformSettingsBlock[]

// Serialize to JSON string
const jsonStr = toJson(doc);
console.log(jsonStr);

// Serialize to YAML string
const yamlStr = toYamlDocument(doc);
console.log(yamlStr);
```

### Parsing Directories

```typescript
import { TerraformParser, toJson } from 'parse-hcl';

const parser = new TerraformParser();

// Parse entire directory (default: aggregate + per-file)
const result = parser.parseDirectory('./terraform');

// Access combined document (all files merged)
console.log(result.combined);

// Access per-file results
result.files.forEach(file => {
  console.log(`File: ${file.path}`);
  console.log(`Resources: ${file.document.resource.length}`);
});

// Parse with options
const result2 = parser.parseDirectory('./terraform', {
  aggregate: true,      // Combine all files into one document (default: true)
  includePerFile: true  // Include per-file results (default: true)
});

// Combine multiple documents manually
const combined = parser.combine([doc1, doc2, doc3]);
```

### Parsing Artifacts

```typescript
import {
  TfVarsParser,
  TfStateParser,
  TfPlanParser
} from 'parse-hcl';

// Parse .tfvars file
const tfvars = new TfVarsParser().parseFile('terraform.tfvars');
console.log(tfvars.assignments);
// { project: { type: 'literal', value: 'demo' }, ... }

// Parse .tfstate file
const state = new TfStateParser().parseFile('terraform.tfstate');
console.log(state.terraform_version);  // "1.6.0"
console.log(state.outputs);            // { bucket_name: { value: "...", type: "string" } }
console.log(state.resources);          // TerraformStateResource[]

// Parse plan.json (terraform show -json planfile)
const plan = new TfPlanParser().parseFile('plan.json');
console.log(plan.resource_changes);    // PlanResourceChange[]
console.log(plan.planned_values);      // PlannedValues
```

### Building Dependency Graphs

```typescript
import {
  TerraformParser,
  buildDependencyGraph,
  toJsonExport,
  createExport
} from 'parse-hcl';

const parser = new TerraformParser();
const doc = parser.parseFile('main.tf');

// Build dependency graph
const graph = buildDependencyGraph(doc);

// Graph structure
console.log(graph.nodes);  // GraphNode[] - all resources, variables, etc.
console.log(graph.edges);  // GraphEdge[] - dependency relationships
console.log(graph.orphanReferences);  // Reference[] - unresolved references

// Iterate over nodes
graph.nodes.forEach(node => {
  console.log(`${node.kind}: ${node.id}`);
  // Output: "resource: resource.aws_s3_bucket.demo"
  // Output: "variable: variable.region"
});

// Iterate over edges (dependencies)
graph.edges.forEach(edge => {
  console.log(`${edge.from} -> ${edge.to}`);
  // Output: "resource.aws_s3_bucket.demo -> locals.name_prefix"
});

// Create full export with version
const exportData = createExport(doc);
// { version: "1.0.0", document: {...}, graph: {...} }

// Serialize export to JSON
const exportJson = toJsonExport(doc);
console.log(exportJson);
```

### Serialization

```typescript
import {
  TerraformParser,
  toJson,
  toYamlDocument,
  toJsonExport,
  toExport
} from 'parse-hcl';

const parser = new TerraformParser();
const doc = parser.parseFile('main.tf');

// JSON serialization
const json = toJson(doc);                              // Pruned (default)
const jsonFull = toJson(doc, { pruneEmpty: false });   // Keep empty arrays

// YAML serialization
const yaml = toYamlDocument(doc);                              // Pruned
const yamlFull = toYamlDocument(doc, { pruneEmpty: false });   // Keep empty

// Export with graph (JSON string)
const exportJson = toJsonExport(doc);                           // Pruned
const exportJsonFull = toJsonExport(doc, { pruneEmpty: false }); // Keep empty

// Export object (for further processing)
const exportObj = toExport(doc);
const exportObjFull = toExport(doc, { pruneEmpty: false });
```

---

## Type Definitions

### Core Types

```typescript
// Main document structure
interface TerraformDocument {
  terraform: TerraformSettingsBlock[];
  provider: ProviderBlock[];
  variable: VariableBlock[];
  output: OutputBlock[];
  resource: ResourceBlock[];
  data: DataBlock[];
  module: ModuleBlock[];
  locals: LocalValue[];
  moved: GenericBlock[];
  import: GenericBlock[];
  check: GenericBlock[];
}

// Resource block
interface ResourceBlock {
  type: string;           // e.g., "aws_s3_bucket"
  name: string;           // e.g., "demo"
  properties: ParsedBody; // Attributes
  meta?: {
    count?: Value;
    for_each?: Value;
    depends_on?: Value;
    provider?: Value;
    lifecycle?: Value;
  };
  blocks?: NestedBlock[];
  dynamic_blocks?: DynamicBlock[];
  raw: string;            // Original HCL source
  source?: string;        // File path
}

// Variable block
interface VariableBlock {
  name: string;
  type?: string;
  typeConstraint?: TypeConstraint;
  default?: Value;
  description?: string;
  sensitive?: boolean;
  nullable?: boolean;
  validation?: VariableValidation[];
  raw: string;
  source?: string;
}

// Output block
interface OutputBlock {
  name: string;
  value: Value;
  description?: string;
  sensitive?: boolean;
  depends_on?: Value;
  raw: string;
  source?: string;
}
```

### Value Types

```typescript
// Value union type
type Value = LiteralValue | ArrayValue | ObjectValue | ExpressionValue;

// Literal values (string, number, boolean, null)
interface LiteralValue {
  type: 'literal';
  value: string | number | boolean | null;
  raw: string;
}

// Array values
interface ArrayValue {
  type: 'array';
  value: Value[];
  raw: string;
  references?: Reference[];
}

// Object values
interface ObjectValue {
  type: 'object';
  value: Record<string, Value>;
  raw: string;
  references?: Reference[];
}

// Expression values (references, function calls, templates, etc.)
interface ExpressionValue {
  type: 'expression';
  kind: ExpressionKind;  // 'traversal' | 'function_call' | 'template' | 'for_expr' | ...
  raw: string;
  references?: Reference[];
}
```

### Reference Types

```typescript
type Reference =
  | VariableReference
  | LocalReference
  | ResourceReference
  | DataReference
  | ModuleOutputReference
  | PathReference
  | EachReference
  | CountReference
  | SelfReference;

interface VariableReference {
  kind: 'variable';
  name: string;
  attribute?: string;
}

interface ResourceReference {
  kind: 'resource';
  resource_type: string;
  name: string;
  attribute?: string;
}

interface ModuleOutputReference {
  kind: 'module_output';
  module: string;
  output: string;
}

// ... other reference types
```

### Graph Types

```typescript
interface DependencyGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  orphanReferences: Reference[];
}

interface GraphNode {
  id: string;           // e.g., "resource.aws_s3_bucket.demo"
  kind: GraphNodeKind;  // 'resource' | 'variable' | 'output' | 'locals' | ...
  name: string;
  type?: string;        // For resources: resource type
  source?: string;      // File path
}

interface GraphEdge {
  from: string;         // Source node ID
  to: string;           // Target node ID
  reference: Reference; // The reference that created this edge
  source?: string;      // File path
}

interface TerraformExport {
  version: string;      // "1.0.0"
  document: TerraformDocument;
  graph: DependencyGraph;
}
```

---

## Examples

### Example 1: List All Resources in a Project

```typescript
import { TerraformParser } from 'parse-hcl';

const parser = new TerraformParser();
const result = parser.parseDirectory('./infrastructure');

if (result.combined) {
  result.combined.resource.forEach(resource => {
    console.log(`${resource.type}.${resource.name}`);
  });
}

// Output:
// aws_s3_bucket.data
// aws_s3_bucket.logs
// aws_iam_role.lambda_exec
// aws_lambda_function.processor
```

### Example 2: Find All Variable References

```typescript
import { TerraformParser, buildDependencyGraph } from 'parse-hcl';

const parser = new TerraformParser();
const doc = parser.parseFile('main.tf');
const graph = buildDependencyGraph(doc);

// Find all edges pointing to variables
const variableUsages = graph.edges.filter(edge =>
  edge.to.startsWith('variable.')
);

variableUsages.forEach(edge => {
  console.log(`${edge.from} uses ${edge.to}`);
});

// Output:
// resource.aws_s3_bucket.demo uses variable.bucket_name
// locals.full_name uses variable.environment
```

### Example 3: Validate Required Variables Have Defaults

```typescript
import { TerraformParser } from 'parse-hcl';

const parser = new TerraformParser();
const result = parser.parseDirectory('./modules/vpc');

if (result.combined) {
  const missingDefaults = result.combined.variable.filter(v =>
    !v.default && !v.nullable
  );

  if (missingDefaults.length > 0) {
    console.log('Variables without defaults:');
    missingDefaults.forEach(v => {
      console.log(`  - ${v.name} (${v.source})`);
    });
  }
}
```

### Example 4: Export to File

```typescript
import { writeFileSync } from 'fs';
import { TerraformParser, toJsonExport, toYamlDocument } from 'parse-hcl';

const parser = new TerraformParser();
const doc = parser.parseFile('main.tf');

// Export as JSON with graph
writeFileSync('output.json', toJsonExport(doc));

// Export as YAML
writeFileSync('output.yaml', toYamlDocument(doc));
```

### Example 5: Analyze Terraform State

```typescript
import { TfStateParser } from 'parse-hcl';

const state = new TfStateParser().parseFile('terraform.tfstate');

console.log(`Terraform version: ${state.terraform_version}`);
console.log(`Serial: ${state.serial}`);

// List all managed resources
state.resources
  .filter(r => r.mode === 'managed')
  .forEach(r => {
    console.log(`${r.type}.${r.name}`);
    r.instances.forEach((inst, i) => {
      console.log(`  [${i}] id=${inst.attributes?.id}`);
    });
  });
```

---

## Development

### Setup

```bash
git clone https://github.com/sigmoid-hq/parse-hcl.git
cd parse-hcl/typescript
yarn install
```

### Scripts

```bash
# Build
yarn build

# Run tests
yarn test

# Run tests with coverage
yarn test:coverage

# Lint
yarn lint
yarn lint:fix

# Format
yarn format
yarn format:check

# Run CLI locally
yarn cli --file test/fixtures/main.tf

# Run examples
yarn example            # Full example with output files
yarn example:usage      # Basic usage demo
yarn example:artifacts  # Artifact parsing demo
```

### Project Structure

```
typescript/
├── src/
│   ├── index.ts              # Main exports
│   ├── cli.ts                # CLI entry point
│   ├── types/
│   │   ├── blocks.ts         # Block type definitions
│   │   └── artifacts.ts      # Artifact type definitions
│   ├── services/
│   │   ├── terraformParser.ts      # Main HCL parser
│   │   ├── terraformJsonParser.ts  # .tf.json parser
│   │   └── artifactParsers.ts      # tfvars/state/plan parsers
│   ├── parsers/
│   │   ├── genericParser.ts        # Generic block parsing
│   │   ├── variableParser.ts       # Variable block parsing
│   │   ├── outputParser.ts         # Output block parsing
│   │   └── localsParser.ts         # Locals block parsing
│   └── utils/
│       ├── lexer/
│       │   ├── hclLexer.ts         # HCL tokenization
│       │   └── blockScanner.ts     # Block boundary detection
│       ├── parser/
│       │   ├── bodyParser.ts       # Block body parsing
│       │   └── valueClassifier.ts  # Value classification
│       ├── serialization/
│       │   ├── serializer.ts       # JSON/YAML serialization
│       │   └── yaml.ts             # YAML utilities
│       ├── graph/
│       │   └── graphBuilder.ts     # Dependency graph builder
│       └── common/
│           ├── errors.ts           # Error types
│           ├── logger.ts           # Logging utilities
│           └── fs.ts               # File system utilities
├── test/
│   ├── unit/                 # Unit tests
│   ├── integration/          # Integration tests
│   └── fixtures/             # Test Terraform files
├── examples/                 # Example scripts
├── package.json
└── tsconfig.json
```

---

## License

[Apache-2.0](../LICENSE) - Copyright 2025 Juan Lee
