# parse-hcl

[![npm version](https://img.shields.io/npm/v/parse-hcl.svg?label=npm&color=blue)](https://www.npmjs.com/package/parse-hcl)
[![PyPI version](https://img.shields.io/pypi/v/parse-hcl.svg?label=pypi&color=blue)](https://pypi.org/project/parse-hcl/)
[![license](https://img.shields.io/npm/l/parse-hcl.svg?color=blue)](LICENSE)

A lightweight, zero-dependency Terraform/HCL parser CLI and library for TypeScript and Python.

Extracts and analyzes Terraform configuration blocks, builds dependency graphs, and outputs structured JSON/YAML — perfect for building IaC tooling, linters, documentation generators, and CI/CD integrations.

## Quick Start

### Installation

**Node.js / TypeScript:**
```bash
# npm
npm install -g parse-hcl

# yarn
yarn global add parse-hcl

# pnpm
pnpm add -g parse-hcl
```

**Python:**
```bash
# pip
pip install parse-hcl

# pipx (recommended for CLI)
pipx install parse-hcl

# uv
uv tool install parse-hcl
```

### Basic CLI Usage

```bash
# Parse a single Terraform file
parse-hcl --file main.tf

# Parse with YAML output
parse-hcl --file main.tf --format yaml

# Parse entire directory
parse-hcl --dir ./terraform

# Generate dependency graph
parse-hcl --file main.tf --graph

# Parse tfvars file
parse-hcl --file terraform.tfvars

# Parse Terraform state
parse-hcl --file terraform.tfstate

# Parse Terraform plan
parse-hcl --file plan.json
```

## CLI Reference

```
parse-hcl --file <path> | --dir <path> [options]
```

### Options

| Option | Description | Default |
|--------|-------------|---------|
| `--file <path>` | Parse a single file (`.tf`, `.tf.json`, `.tfvars`, `.tfstate`, `plan.json`) | - |
| `--dir <path>` | Parse all Terraform files in directory (recursive) | - |
| `--format <type>` | Output format: `json` or `yaml` | `json` |
| `--graph` | Include dependency graph in output | `false` |
| `--no-prune` | Keep empty arrays/objects in output | `false` |
| `--out <path>` | Save output to file (or directory for combined output) | `./parse-hcl-output*.{json,yaml}` |
| `--out-dir <dir>` | Save per-file results under this directory (directory mode) | `./parse-hcl-output/files` |
| `--split` / `--no-split` | Enable/disable per-file saving in directory mode | `true` |
| `--stdout` / `--no-stdout` | Also print to stdout (default off) | `false` |

### Behavior and Defaults

- You must provide either `--file` or `--dir`; when both are present, `--file` is used. Missing inputs print usage to stderr and exit with code `1`.
- **Default output is files, stdout off.**  
  - Single file: writes `./parse-hcl-output.{json|yaml}`.  
  - Directory: writes combined `./parse-hcl-output.combined.{json|yaml}` and per-file under `./parse-hcl-output/files/<relative-path>.{json|yaml}`.  
  - Add `--stdout` to also print.
- `--out` overrides the combined/single output path. If it points to a directory, the tool writes `output.{json|yaml}` (single file) or `combined.{json|yaml}` (directory). If no extension is given, one is added based on `--format`.
- `--out-dir` sets the root for per-file outputs (directory mode). If omitted but `--out` is provided, per-file results go under `per-file/` next to the `--out` target. Disable per-file writes with `--no-split`.
- `--file` auto-detects artifacts: paths containing `tfvars` use the tfvars parser, `.tfstate` files use the state parser, and `plan.json` uses the plan parser. Other files are treated as Terraform configs. The `--graph` flag only applies to Terraform configs; artifact parsers ignore it and return the raw parse.
- `--dir` recursively parses only `.tf` and `.tf.json` files, skipping `.terraform`, `.git`, and `node_modules`. The default output includes `combined` (aggregated document) and `files` (per-file results). With `--graph`, the dependency graph is built from the aggregated document.
- When split outputs are written, each `files` entry now includes `relative_path`, `output_path`, and `output_dir` (all relative). Module blocks include `source_raw` (as written) and, when local, `source_output_dir`, pointing to the per-file output directory for that module.
- Warnings and usage go to stderr. The CLI exits non-zero on invalid arguments or parsing failures.
- `--format` affects every output shape; `--no-prune` keeps empty arrays/objects that are removed by default for compactness.

## Features

- **Zero dependencies** — No external runtime dependencies in both TypeScript and Python
- **CLI-first design** — Powerful command-line interface for instant Terraform analysis
- **Dual language support** — Feature-parity between TypeScript/Node.js and Python implementations
- **Multiple file formats** — Parses `.tf`, `.tf.json`, `.tfvars`, `.tfstate`, and `plan.json`
- **Dependency graph** — Automatically builds resource dependency graphs with reference tracking
- **Flexible output** — JSON and YAML serialization with optional pruning
- **Expression analysis** — Detects variables, locals, resources, data sources, and module references

## Language-Specific Docs

- TypeScript/Node.js: [typescript/README.md](typescript/README.md)
- Python: [python/README.md](python/README.md)

### Examples

**Parse a Terraform file to JSON:**
```bash
$ parse-hcl --file main.tf --format json
```

**Output:**
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
      }
    }
  ],
  "variable": [...],
  "output": [...],
  "locals": [...]
}
```

**Generate dependency graph:**
```bash
$ parse-hcl --file main.tf --graph --format json
```

**Output:**
```json
{
  "version": "1.0.0",
  "document": { ... },
  "graph": {
    "nodes": [
      { "id": "resource.aws_s3_bucket.demo", "kind": "resource", "type": "aws_s3_bucket", "name": "demo" },
      { "id": "locals.name_prefix", "kind": "locals", "name": "name_prefix" },
      { "id": "output.bucket_name", "kind": "output", "name": "bucket_name" }
    ],
    "edges": [
      { "from": "resource.aws_s3_bucket.demo", "to": "locals.name_prefix" },
      { "from": "output.bucket_name", "to": "resource.aws_s3_bucket.demo" }
    ]
  }
}
```

**Parse tfvars file:**
```bash
$ parse-hcl --file terraform.tfvars
```

**Output:**
```json
{
  "source": "terraform.tfvars",
  "assignments": {
    "project": { "type": "literal", "value": "demo" },
    "env": { "type": "literal", "value": "dev" },
    "cidrs": {
      "type": "array",
      "value": [
        { "type": "literal", "value": "10.0.0.0/16" },
        { "type": "literal", "value": "10.1.0.0/16" }
      ]
    }
  }
}
```

**Parse entire directory:**
```bash
$ parse-hcl --dir ./infrastructure --format yaml
```

**Default saved outputs (no flags):**
```bash
$ ls parse-hcl-output*
parse-hcl-output.combined.json
parse-hcl-output/files/main.tf.json
parse-hcl-output/files/modules/vpc/variables.tf.json
```

**Directory output structure (`--dir` + `--stdout`):**
```bash
$ parse-hcl --dir ./infrastructure --stdout | jq 'keys'
# ["combined","files"]
```

```json
{
  "combined": { "resource": [...], "variable": [...], "output": [...], "locals": [...] },
  "files": [
    {
      "path": "/abs/path/main.tf",
      "document": { "resource": [...], "locals": [...], "output": [...], "terraform": [...] }
    }
  ]
}
```

## Supported Terraform Blocks

| Block Type | Description |
|------------|-------------|
| `resource` | Infrastructure resources with type, name, and properties |
| `data` | Data sources for querying external information |
| `variable` | Input variables with type constraints and defaults |
| `output` | Output values with sensitivity and descriptions |
| `locals` | Local values for intermediate computations |
| `module` | Module calls with source and version |
| `provider` | Provider configurations with aliases |
| `terraform` | Terraform settings (required_version, backend, etc.) |
| `moved` | Resource move/rename blocks |
| `import` | Import existing resources |
| `check` | Validation check blocks |

## Reference Detection

The parser automatically detects and classifies references in expressions:

| Reference Kind | Example | Detected As |
|----------------|---------|-------------|
| Variable | `var.region` | `{ kind: "variable", name: "region" }` |
| Local | `local.prefix` | `{ kind: "local", name: "prefix" }` |
| Resource | `aws_s3_bucket.demo.id` | `{ kind: "resource", resource_type: "aws_s3_bucket", name: "demo", attribute: "id" }` |
| Data | `data.aws_ami.latest.id` | `{ kind: "data", data_type: "aws_ami", name: "latest", attribute: "id" }` |
| Module | `module.vpc.subnet_ids` | `{ kind: "module_output", module: "vpc", output: "subnet_ids" }` |
| Path | `path.module` | `{ kind: "path", path_type: "module" }` |
| Each | `each.key` | `{ kind: "each", property: "key" }` |
| Count | `count.index` | `{ kind: "count" }` |
| Self | `self.id` | `{ kind: "self", attribute: "id" }` |

## Language-Specific Documentation

For detailed programmatic API usage and language-specific features:

- **[TypeScript/Node.js Documentation](typescript/README.md)** — Full TypeScript API, types, and examples
- **[Python Documentation](python/README.md)** — Full Python API, type hints, and examples

## Architecture

```
parse-hcl/
├── typescript/          # TypeScript/Node.js implementation
│   ├── src/
│   │   ├── cli.ts       # CLI entry point
│   │   ├── services/    # Core parsers
│   │   ├── utils/       # Lexer, serialization, graph
│   │   └── types/       # Type definitions
│   └── test/
├── python/              # Python implementation
│   ├── src/parse_hcl/
│   │   ├── cli.py       # CLI entry point
│   │   ├── services/    # Core parsers
│   │   ├── utils/       # Lexer, serialization, graph
│   │   └── types/       # Type definitions
│   └── tests/
└── docs/                # Internal documentation
```

## Use Cases

- **IaC Linters** — Build custom Terraform linting rules
- **Documentation Generators** — Auto-generate docs from Terraform configs
- **CI/CD Integration** — Validate and analyze Terraform in pipelines
- **IDE Extensions** — Power code intelligence features
- **Drift Detection** — Compare configurations with state files
- **Cost Estimation** — Extract resource configurations for pricing
- **Security Scanning** — Analyze resource configurations for vulnerabilities
- **Dependency Visualization** — Generate architecture diagrams

## Development

```bash
# Clone repository
git clone https://github.com/sigmoid-hq/parse-hcl.git
cd parse-hcl

# TypeScript development
cd typescript
yarn install
yarn build
yarn test

# Python development
cd python
pip install -e .
python -m pytest tests/
```

## License

[Apache-2.0](LICENSE) — Copyright 2025 Juan Lee

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.
