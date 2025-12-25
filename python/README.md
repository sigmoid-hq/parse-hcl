# parse-hcl (Python)

[![PyPI version](https://img.shields.io/pypi/v/parse-hcl.svg?label=pypi&color=blue)](https://pypi.org/project/parse-hcl/)
[![license](https://img.shields.io/pypi/l/parse-hcl.svg?color=blue)](../LICENSE)
[![Python](https://img.shields.io/badge/python-3.9%2B-blue)](https://www.python.org/)

A lightweight, zero-dependency Terraform/HCL parser for Python. This package provides both a powerful CLI tool and a programmatic API for parsing Terraform configurations.

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
# pip (standard installation)
pip install parse-hcl

# pipx (recommended for CLI usage - isolated environment)
pipx install parse-hcl

# uv (fast Python package installer)
uv pip install parse-hcl
uv tool install parse-hcl  # for CLI

# From source
pip install ./python
```

**Requirements:** Python >= 3.9

---

## CLI Usage

The `parse-hcl` CLI provides instant Terraform configuration analysis from your terminal.

### Command Synopsis

```bash
parse-hcl --file <path> | --dir <path> [--format json|yaml] [--graph] [--no-prune]
```

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

# Save to custom path and also print
parse-hcl --file main.tf --out ./out/result.json --stdout
```

**Running from source (without installation):**
```bash
python -m parse_hcl.cli --file main.tf --format json
python -m parse_hcl.cli --dir ./terraform --graph --format yaml
```

### Options Reference

| Option | Description | Default |
|--------|-------------|---------|
| `--file <path>` | Parse a single file | - |
| `--dir <path>` | Parse all `.tf` and `.tf.json` files in directory (recursive) | - |
| `--format <type>` | Output format: `json` or `yaml` | `json` |
| `--graph` | Include dependency graph (nodes, edges, references) | `false` |
| `--no-prune` | Keep empty arrays and objects in output | `false` |
| `--out <path>` | Save output to file (or directory for combined output) | `./parse-hcl-output*.{json,yaml}` |
| `--out-dir <dir>` | Save per-file results under this directory (directory mode) | `./parse-hcl-output/files` |
| `--split` / `--no-split` | Enable/disable per-file saving in directory mode | `true` |
| `--stdout` / `--no-stdout` | Also print to stdout (default off) | `false` |

### Behavior and Defaults

- Pass either `--file` or `--dir`; if both are present, `--file` is used. Missing inputs print usage to stderr and exit with code `1`.
- **Default output is files, stdout off.**  
  - Single file: writes `./parse-hcl-output.{json|yaml}`.  
  - Directory: writes combined `./parse-hcl-output.combined.{json|yaml}` and per-file under `./parse-hcl-output/files/<relative-path>.{json|yaml}`.  
  - Add `--stdout` to also print.
- `--out` overrides the combined/single output path. If it points to a directory, the tool writes `output.{json|yaml}` (single file) or `combined.{json|yaml}` (directory). If no extension is given, one is added based on `--format`.
- `--out-dir` sets the root for per-file outputs (directory mode). If omitted but `--out` is provided, per-file results go under `per-file/` next to the `--out` target. Disable per-file writes with `--no-split`.
- `--file` auto-detects artifacts: paths containing `tfvars` use the tfvars parser, `.tfstate` uses the state parser, and `plan.json` uses the plan parser. Other files are treated as Terraform configs. The `--graph` flag only applies to Terraform configs; artifact parsers ignore it and emit the raw parse.
- `--dir` walks recursively, parsing only `.tf` and `.tf.json` files while skipping `.terraform`, `.git`, and `node_modules`. Default output contains `combined` (aggregated document) and `files` (per-file results). With `--graph`, the dependency graph is built from the aggregated document.
- When split outputs are enabled, each `files` entry includes `relative_path`, `output_path`, and `output_dir` (all relative). Module blocks include `source_raw` (as written) and, when local, `source_output_dir`, pointing to the per-file output directory for that module.
- Warnings and usage go to stderr. The CLI exits non-zero on invalid arguments or parsing failures.
- `--format` applies to every output shape; `--no-prune` keeps empty arrays/objects that are removed by default for compactness.
- Run without a global install via `pipx run parse-hcl ...` or from the repo with `python -m parse_hcl.cli ...`.

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

**Default saved files (no flags):**
```bash
$ ls parse-hcl-output*
parse-hcl-output.combined.json
parse-hcl-output/files/main.tf.json
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
    "orphan_references": []
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

```python
from parse_hcl import TerraformParser, to_json, to_yaml_document

parser = TerraformParser()

# Parse a single .tf file
doc = parser.parse_file("main.tf")

# Access parsed blocks (all are lists of TypedDict)
print(doc["resource"])   # List of ResourceBlock
print(doc["variable"])   # List of VariableBlock
print(doc["output"])     # List of OutputBlock
print(doc["locals"])     # List of LocalValue
print(doc["module"])     # List of ModuleBlock
print(doc["provider"])   # List of ProviderBlock
print(doc["data"])       # List of DataBlock
print(doc["terraform"])  # List of TerraformSettingsBlock

# Serialize to JSON string
json_str = to_json(doc)
print(json_str)

# Serialize to YAML string
yaml_str = to_yaml_document(doc)
print(yaml_str)
```

### Parsing Directories

```python
from parse_hcl import TerraformParser, to_json

parser = TerraformParser()

# Parse entire directory (default: aggregate + per-file)
result = parser.parse_directory("./terraform")

# Access combined document (all files merged)
print(result["combined"])

# Access per-file results
for file_result in result["files"]:
    print(f"File: {file_result['path']}")
    print(f"Resources: {len(file_result['document']['resource'])}")

# Parse with options
result = parser.parse_directory(
    "./terraform",
    aggregate=True,        # Combine all files into one document (default: True)
    include_per_file=True  # Include per-file results (default: True)
)

# Combine multiple documents manually
combined = parser.combine([doc1, doc2, doc3])
```

### Parsing Artifacts

```python
from parse_hcl import TfVarsParser, TfStateParser, TfPlanParser

# Parse .tfvars file
tfvars = TfVarsParser().parse_file("terraform.tfvars")
print(tfvars["assignments"])
# {"project": {"type": "literal", "value": "demo"}, ...}

# Parse .tfstate file
state = TfStateParser().parse_file("terraform.tfstate")
print(state["terraform_version"])  # "1.6.0"
print(state["outputs"])            # {"bucket_name": {"value": "...", "type": "string"}}
print(state["resources"])          # List of TerraformStateResource

# Parse plan.json (terraform show -json planfile)
plan = TfPlanParser().parse_file("plan.json")
print(plan["resource_changes"])    # List of PlanResourceChange
print(plan["planned_values"])      # PlannedValues dict
```

### Building Dependency Graphs

```python
from parse_hcl import (
    TerraformParser,
    build_dependency_graph,
    to_json_export,
    create_export
)

parser = TerraformParser()
doc = parser.parse_file("main.tf")

# Build dependency graph
graph = build_dependency_graph(doc)

# Graph structure
print(graph["nodes"])              # List of GraphNode dicts
print(graph["edges"])              # List of GraphEdge dicts
print(graph["orphan_references"])  # List of unresolved Reference dicts

# Iterate over nodes
for node in graph["nodes"]:
    print(f"{node['kind']}: {node['id']}")
    # Output: "resource: resource.aws_s3_bucket.demo"
    # Output: "variable: variable.region"

# Iterate over edges (dependencies)
for edge in graph["edges"]:
    print(f"{edge['from']} -> {edge['to']}")
    # Output: "resource.aws_s3_bucket.demo -> locals.name_prefix"

# Create full export with version
export_data = create_export(doc)
# {"version": "1.0.0", "document": {...}, "graph": {...}}

# Serialize export to JSON
export_json = to_json_export(doc)
print(export_json)
```

### Serialization

```python
from parse_hcl import (
    TerraformParser,
    to_json,
    to_yaml_document,
    to_json_export,
    to_export
)

parser = TerraformParser()
doc = parser.parse_file("main.tf")

# JSON serialization
json_str = to_json(doc)                           # Pruned (default)
json_full = to_json(doc, prune_empty=False)       # Keep empty arrays

# YAML serialization
yaml_str = to_yaml_document(doc)                         # Pruned
yaml_full = to_yaml_document(doc, prune_empty=False)     # Keep empty

# Export with graph (JSON string)
export_json = to_json_export(doc)                         # Pruned
export_json_full = to_json_export(doc, prune_empty=False) # Keep empty

# Export dict (for further processing)
export_obj = to_export(doc)
export_obj_full = to_export(doc, prune_empty=False)
```

---

## Type Definitions

All types are defined using `TypedDict` for full IDE support and type checking.

### Core Types

```python
from typing import TypedDict, List, Optional

class TerraformDocument(TypedDict, total=False):
    terraform: List[TerraformSettingsBlock]
    provider: List[ProviderBlock]
    variable: List[VariableBlock]
    output: List[OutputBlock]
    resource: List[ResourceBlock]
    data: List[DataBlock]
    module: List[ModuleBlock]
    locals: List[LocalValue]
    moved: List[GenericBlock]
    import_: List[GenericBlock]  # 'import' is reserved in Python
    check: List[GenericBlock]

class ResourceBlock(TypedDict, total=False):
    type: str           # e.g., "aws_s3_bucket"
    name: str           # e.g., "demo"
    properties: ParsedBody  # Attributes dict
    meta: ResourceMeta      # count, for_each, depends_on, etc.
    blocks: List[NestedBlock]
    dynamic_blocks: List[DynamicBlock]
    raw: str            # Original HCL source
    source: str         # File path

class VariableBlock(TypedDict, total=False):
    name: str
    type: str
    type_constraint: TypeConstraint
    default: Value
    description: str
    sensitive: bool
    nullable: bool
    validation: List[VariableValidation]
    raw: str
    source: str

class OutputBlock(TypedDict, total=False):
    name: str
    value: Value
    description: str
    sensitive: bool
    depends_on: Value
    raw: str
    source: str
```

### Value Types

```python
from typing import Union, Dict, List, Any

# Value union type (in practice, a dict with 'type' discriminator)
Value = Union[LiteralValue, ArrayValue, ObjectValue, ExpressionValue]

class LiteralValue(TypedDict):
    type: str  # "literal"
    value: Union[str, int, float, bool, None]
    raw: str

class ArrayValue(TypedDict, total=False):
    type: str  # "array"
    value: List[Value]
    raw: str
    references: List[Reference]

class ObjectValue(TypedDict, total=False):
    type: str  # "object"
    value: Dict[str, Value]
    raw: str
    references: List[Reference]

class ExpressionValue(TypedDict, total=False):
    type: str  # "expression"
    kind: str  # "traversal", "function_call", "template", "for_expr", etc.
    raw: str
    references: List[Reference]
```

### Reference Types

```python
from typing import Union

Reference = Union[
    VariableReference,
    LocalReference,
    ResourceReference,
    DataReference,
    ModuleOutputReference,
    PathReference,
    EachReference,
    CountReference,
    SelfReference,
]

class VariableReference(TypedDict, total=False):
    kind: str  # "variable"
    name: str
    attribute: str

class ResourceReference(TypedDict, total=False):
    kind: str  # "resource"
    resource_type: str
    name: str
    attribute: str

class ModuleOutputReference(TypedDict):
    kind: str  # "module_output"
    module: str
    output: str

# ... other reference types
```

### Graph Types

```python
class DependencyGraph(TypedDict):
    nodes: List[GraphNode]
    edges: List[GraphEdge]
    orphan_references: List[Reference]

class GraphNode(TypedDict, total=False):
    id: str           # e.g., "resource.aws_s3_bucket.demo"
    kind: str         # "resource", "variable", "output", "locals", etc.
    name: str
    type: str         # For resources: resource type
    source: str       # File path

class GraphEdge(TypedDict, total=False):
    from_: str        # Source node ID (from_ because 'from' is reserved)
    to: str           # Target node ID
    reference: Reference  # The reference that created this edge
    source: str       # File path

class TerraformExport(TypedDict):
    version: str      # "1.0.0"
    document: TerraformDocument
    graph: DependencyGraph
```

---

## Examples

### Example 1: List All Resources in a Project

```python
from parse_hcl import TerraformParser

parser = TerraformParser()
result = parser.parse_directory("./infrastructure")

if result.get("combined"):
    for resource in result["combined"]["resource"]:
        print(f"{resource['type']}.{resource['name']}")

# Output:
# aws_s3_bucket.data
# aws_s3_bucket.logs
# aws_iam_role.lambda_exec
# aws_lambda_function.processor
```

### Example 2: Find All Variable References

```python
from parse_hcl import TerraformParser, build_dependency_graph

parser = TerraformParser()
doc = parser.parse_file("main.tf")
graph = build_dependency_graph(doc)

# Find all edges pointing to variables
variable_usages = [
    edge for edge in graph["edges"]
    if edge["to"].startswith("variable.")
]

for edge in variable_usages:
    print(f"{edge['from']} uses {edge['to']}")

# Output:
# resource.aws_s3_bucket.demo uses variable.bucket_name
# locals.full_name uses variable.environment
```

### Example 3: Validate Required Variables Have Defaults

```python
from parse_hcl import TerraformParser

parser = TerraformParser()
result = parser.parse_directory("./modules/vpc")

if result.get("combined"):
    missing_defaults = [
        v for v in result["combined"]["variable"]
        if not v.get("default") and not v.get("nullable")
    ]

    if missing_defaults:
        print("Variables without defaults:")
        for v in missing_defaults:
            print(f"  - {v['name']} ({v.get('source', 'unknown')})")
```

### Example 4: Export to File

```python
from pathlib import Path
from parse_hcl import TerraformParser, to_json_export, to_yaml_document

parser = TerraformParser()
doc = parser.parse_file("main.tf")

# Export as JSON with graph
Path("output.json").write_text(to_json_export(doc))

# Export as YAML
Path("output.yaml").write_text(to_yaml_document(doc))
```

### Example 5: Analyze Terraform State

```python
from parse_hcl import TfStateParser

state = TfStateParser().parse_file("terraform.tfstate")

print(f"Terraform version: {state['terraform_version']}")
print(f"Serial: {state['serial']}")

# List all managed resources
for resource in state["resources"]:
    if resource["mode"] == "managed":
        print(f"{resource['type']}.{resource['name']}")
        for i, inst in enumerate(resource["instances"]):
            attrs = inst.get("attributes", {})
            print(f"  [{i}] id={attrs.get('id')}")
```

### Example 6: Custom Linter - Check Resource Naming

```python
import re
from parse_hcl import TerraformParser

def check_naming_convention(directory: str) -> list[str]:
    """Check that all resources follow snake_case naming."""
    parser = TerraformParser()
    result = parser.parse_directory(directory)
    errors = []

    if not result.get("combined"):
        return errors

    snake_case_pattern = re.compile(r"^[a-z][a-z0-9_]*$")

    for resource in result["combined"]["resource"]:
        if not snake_case_pattern.match(resource["name"]):
            errors.append(
                f"Resource {resource['type']}.{resource['name']} "
                f"does not follow snake_case naming ({resource.get('source')})"
            )

    return errors

# Usage
errors = check_naming_convention("./terraform")
for error in errors:
    print(f"ERROR: {error}")
```

### Example 7: Generate Resource Inventory

```python
import json
from collections import defaultdict
from parse_hcl import TerraformParser

parser = TerraformParser()
result = parser.parse_directory("./infrastructure")

if result.get("combined"):
    # Group resources by type
    inventory = defaultdict(list)

    for resource in result["combined"]["resource"]:
        inventory[resource["type"]].append({
            "name": resource["name"],
            "source": resource.get("source", "unknown"),
            "has_count": "count" in resource.get("meta", {}),
            "has_for_each": "for_each" in resource.get("meta", {}),
        })

    # Output inventory
    print(json.dumps(dict(inventory), indent=2))
```

---

## Development

### Setup

```bash
git clone https://github.com/sigmoid-hq/parse-hcl.git
cd parse-hcl/python

# Using pip
pip install -e .

# Using uv
uv pip install -e .
```

### Running Tests

```bash
# Using unittest
python -m unittest discover -s tests -v

# Using pytest (if installed)
pytest tests/ -v

# With coverage
pytest tests/ --cov=src/parse_hcl --cov-report=html
```

### Project Structure

```
python/
├── src/
│   └── parse_hcl/
│       ├── __init__.py           # Main exports
│       ├── cli.py                # CLI entry point
│       ├── types/
│       │   └── __init__.py       # Type definitions
│       ├── services/
│       │   ├── terraform_parser.py      # Main HCL parser
│       │   ├── terraform_json_parser.py # .tf.json parser
│       │   └── artifact_parsers.py      # tfvars/state/plan parsers
│       ├── parsers/
│       │   ├── generic_parser.py        # Generic block parsing
│       │   ├── variable_parser.py       # Variable block parsing
│       │   ├── output_parser.py         # Output block parsing
│       │   └── locals_parser.py         # Locals block parsing
│       └── utils/
│           ├── lexer/
│           │   ├── hcl_lexer.py         # HCL tokenization
│           │   └── block_scanner.py     # Block boundary detection
│           ├── parser/
│           │   ├── body_parser.py       # Block body parsing
│           │   └── value_classifier.py  # Value classification
│           ├── serialization/
│           │   ├── serializer.py        # JSON/YAML serialization
│           │   └── yaml.py              # YAML utilities
│           ├── graph/
│           │   └── graph_builder.py     # Dependency graph builder
│           └── common/
│               ├── errors.py            # Error types
│               ├── logger.py            # Logging utilities
│               └── fs.py                # File system utilities
├── tests/
│   ├── test_terraform_parser.py
│   ├── test_hcl_lexer.py
│   ├── test_value_classifier.py
│   ├── test_artifacts_and_graph.py
│   ├── test_integration_comprehensive.py
│   └── fixtures/                  # Test Terraform files
├── pyproject.toml
└── README.md
```

---

## License

[Apache-2.0](../LICENSE) - Copyright 2025 Juan Lee
