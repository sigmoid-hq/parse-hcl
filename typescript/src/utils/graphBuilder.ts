/**
 * Dependency graph builder for Terraform documents.
 * Creates a directed graph of dependencies between Terraform elements.
 */

import {
    DependencyGraph,
    GraphEdge,
    GraphNode,
    GraphNodeKind,
    TerraformExport
} from '../types/artifacts';
import { NestedBlock, Reference, TerraformDocument, Value } from '../types/blocks';

/** Current graph export version */
const GRAPH_VERSION = '1.0.0';

/**
 * Builds a dependency graph from a parsed Terraform document.
 * Analyzes all blocks and their references to construct nodes and edges.
 *
 * @param document - The parsed Terraform document
 * @returns A complete dependency graph with nodes, edges, and orphan references
 *
 * @example
 * ```typescript
 * const parser = new TerraformParser();
 * const doc = parser.parseFile('main.tf');
 * const graph = buildDependencyGraph(doc);
 *
 * // Visualize dependencies
 * for (const edge of graph.edges) {
 *   console.log(`${edge.from} -> ${edge.to}`);
 * }
 * ```
 */
export function buildDependencyGraph(document: TerraformDocument): DependencyGraph {
    const nodes = new Map<string, GraphNode>();
    const edges: GraphEdge[] = [];
    const orphanReferences: Reference[] = [];
    const edgeKeys = new Set<string>();

    // First pass: populate all declared nodes
    populateNodes(document, nodes);

    /**
     * Adds edges from a source node to all referenced targets.
     */
    const addEdges = (fromNode: GraphNode | undefined, refs: Reference[], source?: string): void => {
        if (!fromNode || refs.length === 0) {
            return;
        }

        for (const ref of refs) {
            const target = ensureTargetNode(ref, nodes);
            if (!target) {
                orphanReferences.push(ref);
                continue;
            }

            // Deduplicate edges
            const key = `${fromNode.id}->${target.id}:${JSON.stringify(ref)}`;
            if (edgeKeys.has(key)) {
                continue;
            }
            edgeKeys.add(key);

            edges.push({
                from: fromNode.id,
                to: target.id,
                reference: ref,
                source
            });
        }
    };

    // Process terraform settings
    for (const block of document.terraform) {
        const node = nodes.get(nodeId('terraform', 'settings'));
        addEdges(node, referencesFromAttributes(block.properties), block.source);
    }

    // Process providers
    for (const provider of document.provider) {
        const node = nodes.get(nodeId('provider', provider.name, provider.alias));
        addEdges(node, referencesFromAttributes(provider.properties), provider.source);
    }

    // Process variables (references in default values)
    for (const variable of document.variable) {
        const node = nodes.get(nodeId('variable', variable.name));
        addEdges(node, referencesFromValue(variable.default), variable.source);
    }

    // Process outputs
    for (const output of document.output) {
        const node = nodes.get(nodeId('output', output.name));
        addEdges(node, referencesFromValue(output.value), output.source);
    }

    // Process modules
    for (const module of document.module) {
        const node = nodes.get(nodeId('module', module.name));
        addEdges(node, referencesFromAttributes(module.properties), module.source);
    }

    // Process resources
    for (const resource of document.resource) {
        const node = nodes.get(nodeId('resource', resource.type, resource.name));
        addEdges(node, referencesFromAttributes(resource.properties), resource.source);
        addEdges(node, referencesFromAttributes(resource.meta), resource.source);

        // Process dynamic blocks
        for (const dyn of resource.dynamic_blocks) {
            addEdges(node, referencesFromValue(dyn.for_each), resource.source);
            addEdges(node, referencesFromAttributes(dyn.content), resource.source);
        }

        // Process nested blocks
        addEdges(node, referencesFromNestedBlocks(resource.blocks), resource.source);
    }

    // Process data sources
    for (const data of document.data) {
        const node = nodes.get(nodeId('data', data.dataType, data.name));
        addEdges(node, referencesFromAttributes(data.properties), data.source);
        addEdges(node, referencesFromNestedBlocks(data.blocks), data.source);
    }

    // Process locals
    for (const local of document.locals) {
        const node = nodes.get(nodeId('locals', local.name));
        addEdges(node, referencesFromValue(local.value), local.source);
    }

    // Process other blocks (moved/import/check/terraform_data/unknown)
    const otherBlocks = [
        ...document.moved,
        ...document.import,
        ...document.check,
        ...document.terraform_data,
        ...document.unknown
    ];

    for (const block of otherBlocks) {
        // These blocks don't have nodes, but we track their references
        const allRefs = [
            ...referencesFromAttributes(block.properties),
            ...referencesFromNestedBlocks(block.blocks)
        ];

        // Add edges from the block type as a pseudo-node
        const blockNode = nodes.get(nodeId(block.type as GraphNodeKind, block.labels[0] || 'default'));
        if (!blockNode) {
            // Create a node for this block
            const newNode: GraphNode = {
                id: nodeId(block.type as GraphNodeKind, block.labels[0] || 'default'),
                kind: block.type as GraphNodeKind,
                name: block.labels[0] || 'default',
                source: block.source
            };
            nodes.set(newNode.id, newNode);
            addEdges(newNode, allRefs, block.source);
        } else {
            addEdges(blockNode, allRefs, block.source);
        }
    }

    return {
        nodes: Array.from(nodes.values()),
        edges,
        orphanReferences
    };
}

/**
 * Creates a complete export containing the document and its dependency graph.
 *
 * @param document - The parsed Terraform document
 * @returns TerraformExport with version, document, and graph
 */
export function createExport(document: TerraformDocument): TerraformExport {
    return {
        version: GRAPH_VERSION,
        document,
        graph: buildDependencyGraph(document)
    };
}

/**
 * Populates the node map with all declared elements from the document.
 */
function populateNodes(document: TerraformDocument, nodes: Map<string, GraphNode>): void {
    const addNode = (node: GraphNode): void => {
        if (!nodes.has(node.id)) {
            nodes.set(node.id, node);
        }
    };

    // Always add terraform settings node
    addNode({
        id: nodeId('terraform', 'settings'),
        kind: 'terraform',
        name: 'settings'
    });

    // Add provider nodes
    for (const provider of document.provider) {
        addNode({
            id: nodeId('provider', provider.name, provider.alias),
            kind: 'provider',
            name: provider.alias || provider.name,
            type: provider.name,
            source: provider.source
        });
    }

    // Add variable nodes
    for (const variable of document.variable) {
        addNode({
            id: nodeId('variable', variable.name),
            kind: 'variable',
            name: variable.name,
            source: variable.source
        });
    }

    // Add output nodes
    for (const output of document.output) {
        addNode({
            id: nodeId('output', output.name),
            kind: 'output',
            name: output.name,
            source: output.source
        });
    }

    // Add module nodes
    for (const module of document.module) {
        addNode({
            id: nodeId('module', module.name),
            kind: 'module',
            name: module.name,
            source: module.source
        });
    }

    // Add resource nodes
    for (const resource of document.resource) {
        addNode({
            id: nodeId('resource', resource.type, resource.name),
            kind: 'resource',
            name: resource.name,
            type: resource.type,
            source: resource.source
        });
    }

    // Add data source nodes
    for (const data of document.data) {
        addNode({
            id: nodeId('data', data.dataType, data.name),
            kind: 'data',
            name: data.name,
            type: data.dataType,
            source: data.source
        });
    }

    // Add local value nodes
    for (const local of document.locals) {
        addNode({
            id: nodeId('locals', local.name),
            kind: 'locals',
            name: local.name,
            source: local.source
        });
    }
}

/**
 * Extracts all references from a record of attributes.
 */
function referencesFromAttributes(attributes: Record<string, Value | undefined> | undefined): Reference[] {
    if (!attributes) {
        return [];
    }
    return Object.values(attributes).flatMap((value) => referencesFromValue(value));
}

/**
 * Recursively extracts references from nested blocks.
 */
function referencesFromNestedBlocks(blocks: NestedBlock[]): Reference[] {
    const refs: Reference[] = [];
    for (const block of blocks) {
        refs.push(...referencesFromAttributes(block.attributes));
        refs.push(...referencesFromNestedBlocks(block.blocks));
    }
    return refs;
}

/**
 * Extracts all references from a value (recursively for arrays and objects).
 */
function referencesFromValue(value?: Value): Reference[] {
    if (!value) {
        return [];
    }

    const direct = (value as { references?: Reference[] }).references ?? [];

    if (value.type === 'object' && value.value) {
        return [...direct, ...referencesFromAttributes(value.value as Record<string, Value>)];
    }

    if (value.type === 'array' && Array.isArray(value.value)) {
        return [
            ...direct,
            ...value.value.flatMap((item) => referencesFromValue(item as Value))
        ];
    }

    return direct;
}

/**
 * Creates a node ID from kind and name components.
 */
function nodeId(kind: GraphNodeKind, primary: string, secondary?: string): string {
    return [kind, primary, secondary].filter(Boolean).join('.');
}

/**
 * Ensures a target node exists for a reference, creating a placeholder if needed.
 */
function ensureTargetNode(ref: Reference, nodes: Map<string, GraphNode>): GraphNode | undefined {
    const existing = nodes.get(referenceToId(ref));
    if (existing) {
        return existing;
    }

    const placeholder = referenceToNode(ref);
    if (!placeholder) {
        return undefined;
    }

    nodes.set(placeholder.id, placeholder);
    return placeholder;
}

/**
 * Converts a reference to its corresponding node ID.
 */
function referenceToId(ref: Reference): string {
    switch (ref.kind) {
        case 'variable':
            return nodeId('variable', ref.name);
        case 'local':
            return nodeId('locals', ref.name);
        case 'module_output':
            return nodeId('module_output', ref.module, ref.name);
        case 'data':
            return nodeId('data', ref.data_type, ref.name);
        case 'resource':
            return nodeId('resource', ref.resource_type, ref.name);
        case 'path':
            return nodeId('path', ref.name);
        case 'each':
            return nodeId('each', ref.property);
        case 'count':
            return nodeId('count', ref.property);
        case 'self':
            return nodeId('self', ref.attribute);
        default:
            return '';
    }
}

/**
 * Converts a reference to a placeholder node.
 */
function referenceToNode(ref: Reference): GraphNode | undefined {
    switch (ref.kind) {
        case 'variable':
            return { id: referenceToId(ref), kind: 'variable', name: ref.name };
        case 'local':
            return { id: referenceToId(ref), kind: 'locals', name: ref.name };
        case 'module_output':
            return {
                id: referenceToId(ref),
                kind: 'module_output',
                name: ref.name,
                type: ref.module
            };
        case 'data':
            return {
                id: referenceToId(ref),
                kind: 'data',
                name: ref.name,
                type: ref.data_type
            };
        case 'resource':
            return {
                id: referenceToId(ref),
                kind: 'resource',
                name: ref.name,
                type: ref.resource_type
            };
        case 'path':
            return { id: referenceToId(ref), kind: 'path', name: ref.name };
        case 'each':
            return { id: referenceToId(ref), kind: 'each', name: ref.property };
        case 'count':
            return { id: referenceToId(ref), kind: 'count', name: ref.property };
        case 'self':
            return { id: referenceToId(ref), kind: 'self', name: ref.attribute };
        default:
            return { id: `external.${JSON.stringify(ref)}`, kind: 'external', name: 'external' };
    }
}
