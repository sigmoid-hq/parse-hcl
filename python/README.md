# parse-hcl (Python)

Python port of the `parse-hcl` Terraform parser. Feature parity with the TypeScript package, including block scanning, artifact parsing (tfvars/tfstate/plan), dependency graphing, and CLI support.

## Install
```bash
# after publishing to PyPI
pip install parse-hcl

# or from this repo
pip install ./python
```

## Usage
```python
from parse_hcl import (
    TerraformParser,
    TfVarsParser,
    TfStateParser,
    TfPlanParser,
    to_json,
    to_yaml_document,
    to_json_export,
    build_dependency_graph,
)

parser = TerraformParser()
doc = parser.parse_file("tests/fixtures/main.tf")
print(to_json(doc))
print(to_yaml_document(doc))
print(to_json_export(doc))
print(build_dependency_graph(doc))

tfvars = TfVarsParser().parse_file("tests/fixtures/vars.auto.tfvars.json")
state = TfStateParser().parse_file("tests/fixtures/terraform.tfstate")
plan = TfPlanParser().parse_file("tests/fixtures/plan.json")
```

## CLI
```bash
# installed (pip) CLI
parse-hcl --file tests/fixtures/main.tf --format json
parse-hcl --dir tests/fixtures --graph --format yaml

# repo local CLI
python -m parse_hcl.cli --file tests/fixtures/main.tf --format json
python -m parse_hcl.cli --dir tests/fixtures --graph --format yaml
```

## Development
```bash
cd python
pip install -e .
python -m unittest discover -s tests
```
