/**
 * Generic parsers for Terraform blocks.
 * Handles resource, data, provider, module, terraform settings, and unknown block types.
 */

import {
    DataBlock,
    GenericBlock,
    ModuleBlock,
    ProviderBlock,
    ResourceBlock,
    TerraformSettingsBlock
} from '../types/blocks';
import { HclBlock } from '../types/blocks';
import { parseBlockBody } from '../utils/parser/bodyParser';
import { literalString } from '../utils/common/valueHelpers';

/** Meta-argument keys that are separated from resource properties */
const META_KEYS = new Set(['count', 'for_each', 'provider', 'depends_on', 'lifecycle']);

/**
 * Parser for terraform settings blocks.
 *
 * @example
 * ```hcl
 * terraform {
 *   required_version = ">= 1.0.0"
 *   required_providers {
 *     aws = {
 *       source  = "hashicorp/aws"
 *       version = "~> 4.0"
 *     }
 *   }
 * }
 * ```
 */
export class TerraformSettingsParser {
    /**
     * Parses a terraform settings block.
     * @param block - The raw HCL block to parse
     * @returns Parsed TerraformSettingsBlock
     */
    parse(block: HclBlock): TerraformSettingsBlock {
        const parsed = parseBlockBody(block.body);
        return {
            properties: parsed.attributes,
            raw: block.raw,
            source: block.source
        };
    }
}

/**
 * Parser for provider configuration blocks.
 *
 * @example
 * ```hcl
 * provider "aws" {
 *   alias  = "west"
 *   region = "us-west-2"
 * }
 * ```
 */
export class ProviderParser {
    /**
     * Parses a provider configuration block.
     * @param block - The raw HCL block to parse
     * @returns Parsed ProviderBlock with name, alias, and properties
     */
    parse(block: HclBlock): ProviderBlock {
        const name = block.labels[0] || 'default';
        const parsed = parseBlockBody(block.body);

        return {
            name,
            alias: literalString(parsed.attributes.alias) ?? parsed.attributes.alias?.raw,
            properties: parsed.attributes,
            raw: block.raw,
            source: block.source
        };
    }
}

/**
 * Parser for module call blocks.
 *
 * @example
 * ```hcl
 * module "vpc" {
 *   source  = "terraform-aws-modules/vpc/aws"
 *   version = "3.0.0"
 *
 *   name = "my-vpc"
 *   cidr = "10.0.0.0/16"
 * }
 * ```
 */
export class ModuleParser {
    /**
     * Parses a module call block.
     * @param block - The raw HCL block to parse
     * @returns Parsed ModuleBlock with name and all properties
     */
    parse(block: HclBlock): ModuleBlock {
        const name = block.labels[0] || 'unnamed';
        const parsed = parseBlockBody(block.body);

        return {
            name,
            properties: parsed.attributes,
            raw: block.raw,
            source: block.source
        };
    }
}

/**
 * Parser for resource definition blocks.
 * Separates meta-arguments (count, for_each, depends_on, etc.) from resource properties.
 *
 * @example
 * ```hcl
 * resource "aws_instance" "web" {
 *   count         = 3
 *   ami           = var.ami_id
 *   instance_type = "t2.micro"
 *
 *   tags = {
 *     Name = "web-${count.index}"
 *   }
 *
 *   dynamic "ebs_block_device" {
 *     for_each = var.ebs_volumes
 *     content {
 *       device_name = ebs_block_device.value.device_name
 *       volume_size = ebs_block_device.value.size
 *     }
 *   }
 * }
 * ```
 */
export class ResourceParser {
    /**
     * Parses a resource block, separating properties, meta-arguments, and dynamic blocks.
     * @param block - The raw HCL block to parse
     * @returns Parsed ResourceBlock with separated concerns
     */
    parse(block: HclBlock): ResourceBlock {
        const [type, name] = block.labels;
        const parsed = parseBlockBody(block.body);
        const meta: ResourceBlock['meta'] = {};
        const properties: ResourceBlock['properties'] = {};

        // Separate meta-arguments from properties
        for (const [key, value] of Object.entries(parsed.attributes)) {
            if (META_KEYS.has(key)) {
                meta[key] = value;
            } else {
                properties[key] = value;
            }
        }

        return {
            type: type || 'unknown',
            name: name || 'unnamed',
            properties,
            blocks: parsed.blocks.filter((child) => child.type !== 'dynamic'),
            dynamic_blocks: this.extractDynamicBlocks(parsed.blocks),
            meta,
            raw: block.raw,
            source: block.source
        };
    }

    /**
     * Extracts dynamic blocks from nested blocks.
     * @param blocks - Nested blocks from the resource body
     * @returns Array of DynamicBlock objects
     */
    private extractDynamicBlocks(blocks: ReturnType<typeof parseBlockBody>['blocks']): ResourceBlock['dynamic_blocks'] {
        const dynamicBlocks: ResourceBlock['dynamic_blocks'] = [];

        for (const block of blocks) {
            if (block.type !== 'dynamic') {
                continue;
            }

            const label = block.labels[0] || 'dynamic';
            const for_each = block.attributes.for_each;
            const iterator = literalString(block.attributes.iterator);
            const contentBlock = block.blocks.find((child) => child.type === 'content');

            dynamicBlocks.push({
                label,
                for_each,
                iterator,
                content: contentBlock?.attributes || {},
                raw: block.raw
            });
        }

        return dynamicBlocks;
    }
}

/**
 * Parser for data source blocks.
 *
 * @example
 * ```hcl
 * data "aws_ami" "ubuntu" {
 *   most_recent = true
 *
 *   filter {
 *     name   = "name"
 *     values = ["ubuntu/images/hvm-ssd/ubuntu-focal-20.04-amd64-server-*"]
 *   }
 *
 *   owners = ["099720109477"]
 * }
 * ```
 */
export class DataParser {
    /**
     * Parses a data source block.
     * @param block - The raw HCL block to parse
     * @returns Parsed DataBlock with type, name, properties, and nested blocks
     */
    parse(block: HclBlock): DataBlock {
        const [dataType, name] = block.labels;
        const parsed = parseBlockBody(block.body);

        return {
            dataType: dataType || 'unknown',
            name: name || 'unnamed',
            properties: parsed.attributes,
            blocks: parsed.blocks,
            raw: block.raw,
            source: block.source
        };
    }
}

/**
 * Parser for generic/unknown block types.
 * Used for moved, import, check, terraform_data, and unrecognized blocks.
 *
 * @example
 * ```hcl
 * moved {
 *   from = aws_instance.old
 *   to   = aws_instance.new
 * }
 *
 * import {
 *   to = aws_instance.example
 *   id = "i-1234567890abcdef0"
 * }
 *
 * check "health" {
 *   assert {
 *     condition     = data.http.health.status_code == 200
 *     error_message = "Health check failed"
 *   }
 * }
 * ```
 */
export class GenericBlockParser {
    /**
     * Parses a generic block into a GenericBlock structure.
     * @param block - The raw HCL block to parse
     * @returns Parsed GenericBlock with type, labels, properties, and nested blocks
     */
    parse(block: HclBlock): GenericBlock {
        const parsed = parseBlockBody(block.body);
        return {
            type: block.keyword,
            labels: block.labels,
            properties: parsed.attributes,
            blocks: parsed.blocks,
            raw: block.raw,
            source: block.source
        };
    }
}
