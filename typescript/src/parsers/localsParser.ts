/**
 * Parser for Terraform locals blocks.
 * Extracts local value definitions from locals blocks.
 */

import { HclBlock, LocalValue } from '../types/blocks';
import { parseBlockBody } from '../utils/bodyParser';

/**
 * Parser for Terraform locals definition blocks.
 * Converts a single locals block into multiple LocalValue entries.
 *
 * @example
 * ```hcl
 * locals {
 *   environment = "production"
 *   tags = {
 *     Name = "example"
 *     Env  = local.environment
 *   }
 * }
 * ```
 */
export class LocalsParser {
    /**
     * Parses a locals block into an array of LocalValue objects.
     * Each attribute in the locals block becomes a separate LocalValue.
     *
     * @param block - The raw HCL block to parse
     * @returns Array of LocalValue objects, one per local definition
     */
    parse(block: HclBlock): LocalValue[] {
        const parsed = parseBlockBody(block.body);

        return Object.entries(parsed.attributes).map<LocalValue>(([name, value]) => ({
            name,
            type: value.type,
            value,
            raw: value.raw,
            source: block.source
        }));
    }
}
