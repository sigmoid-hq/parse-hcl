/**
 * Parser for Terraform output blocks.
 * Extracts output value declarations with their expressions and metadata.
 */

import { HclBlock, OutputBlock } from '../types/blocks';
import { parseBlockBody } from '../utils/bodyParser';
import { literalBoolean, literalString } from '../utils/valueHelpers';

/**
 * Parser for Terraform output definition blocks.
 *
 * @example
 * ```hcl
 * output "instance_ip" {
 *   description = "The public IP of the instance"
 *   value       = aws_instance.web.public_ip
 *   sensitive   = false
 * }
 * ```
 */
export class OutputParser {
    /**
     * Parses an output block into a structured OutputBlock.
     * @param block - The raw HCL block to parse
     * @returns Parsed OutputBlock with all extracted fields
     */
    parse(block: HclBlock): OutputBlock {
        const name = block.labels[0] || 'unknown';
        const parsed = parseBlockBody(block.body);

        const description = literalString(parsed.attributes.description) ?? parsed.attributes.description?.raw;
        const value = parsed.attributes.value;
        const sensitive = literalBoolean(parsed.attributes.sensitive);

        return {
            name,
            description,
            value,
            sensitive,
            raw: block.raw,
            source: block.source
        };
    }
}
