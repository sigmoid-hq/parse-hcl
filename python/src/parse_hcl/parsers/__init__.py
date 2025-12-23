# Domain-specific block parsers for Terraform structures.
from .generic_parser import (
    DataParser,
    GenericBlockParser,
    ModuleParser,
    ProviderParser,
    ResourceParser,
    TerraformSettingsParser,
)
from .locals_parser import LocalsParser
from .output_parser import OutputParser
from .variable_parser import VariableParser, parse_type_constraint

__all__ = [
    # generic_parser
    "DataParser",
    "GenericBlockParser",
    "ModuleParser",
    "ProviderParser",
    "ResourceParser",
    "TerraformSettingsParser",
    # locals_parser
    "LocalsParser",
    # output_parser
    "OutputParser",
    # variable_parser
    "VariableParser",
    "parse_type_constraint",
]
