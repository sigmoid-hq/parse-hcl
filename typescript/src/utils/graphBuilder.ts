import {
    DependencyGraph,
    GraphEdge,
    GraphNode,
    GraphNodeKind,
    TerraformExport
} from '../types/artifacts';
import { NestedBlock, Reference, TerraformDocument, Value } from '../types/blocks';

const GRAPH_VERSION = '1.0.0';

export function buildDependencyGraph(document: TerraformDocument): DependencyGraph {
    const nodes = new Map<string, GraphNode>();
    const edges: GraphEdge[] = [];
    const orphanReferences: Reference[] = [];
    const edgeKeys = new Set<string>();

    populateNodes(document, nodes);

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

    // terraform settings
    for (const block of document.terraform) {
        const node = nodes.get(nodeId('terraform', 'settings'));
        addEdges(node, referencesFromAttributes(block.properties), block.source);
    }

    // providers
    for (const provider of document.provider) {
        const node = nodes.get(nodeId('provider', provider.name, provider.alias));
        addEdges(node, referencesFromAttributes(provider.properties), provider.source);
    }

    // variables (default references)
    for (const variable of document.variable) {
        const node = nodes.get(nodeId('variable', variable.name));
        const defaultValue = (variable as { default?: Value }).default;
        addEdges(node, referencesFromValue(defaultValue), variable.source);
    }

    // outputs
    for (const output of document.output) {
        const node = nodes.get(nodeId('output', output.name));
        addEdges(node, referencesFromValue(output.value), output.source);
    }

    // modules
    for (const module of document.module) {
        const node = nodes.get(nodeId('module', module.name));
        addEdges(node, referencesFromAttributes(module.properties), module.source);
    }

    // resources
    for (const resource of document.resource) {
        const node = nodes.get(nodeId('resource', resource.type, resource.name));
        addEdges(node, referencesFromAttributes(resource.properties), resource.source);
        addEdges(node, referencesFromAttributes(resource.meta), resource.source);
        for (const dyn of resource.dynamic_blocks) {
            addEdges(node, referencesFromValue(dyn.for_each), resource.source);
            addEdges(node, referencesFromAttributes(dyn.content), resource.source);
        }
        addEdges(node, referencesFromNestedBlocks(resource.blocks), resource.source);
    }

    // data sources
    for (const data of document.data) {
        const node = nodes.get(nodeId('data', data.dataType, data.name));
        addEdges(node, referencesFromAttributes(data.properties), data.source);
        addEdges(node, referencesFromNestedBlocks(data.blocks), data.source);
    }

    // locals
    for (const local of document.locals) {
        const node = nodes.get(nodeId('locals', local.name));
        addEdges(node, referencesFromValue(local.value), local.source);
    }

    // other blocks (moved/import/check/terraform_data/unknown) - only references
    const otherBlocks = [
        ...document.moved,
        ...document.import,
        ...document.check,
        ...document.terraform_data,
        ...document.unknown
    ];
    for (const block of otherBlocks) {
        addEdges(undefined, referencesFromAttributes(block.properties), block.source);
        addEdges(undefined, referencesFromNestedBlocks(block.blocks), block.source);
    }

    return {
        nodes: Array.from(nodes.values()),
        edges,
        orphanReferences
    };
}

export function createExport(document: TerraformDocument): TerraformExport {
    return {
        version: GRAPH_VERSION,
        document,
        graph: buildDependencyGraph(document)
    };
}

function populateNodes(document: TerraformDocument, nodes: Map<string, GraphNode>): void {
    const addNode = (node: GraphNode): void => {
        if (!nodes.has(node.id)) {
            nodes.set(node.id, node);
        }
    };

    addNode({
        id: nodeId('terraform', 'settings'),
        kind: 'terraform',
        name: 'settings'
    });

    for (const provider of document.provider) {
        addNode({
            id: nodeId('provider', provider.name, provider.alias),
            kind: 'provider',
            name: provider.alias || provider.name,
            type: provider.name,
            source: provider.source
        });
    }

    for (const variable of document.variable) {
        addNode({
            id: nodeId('variable', variable.name),
            kind: 'variable',
            name: variable.name,
            source: variable.source
        });
    }

    for (const output of document.output) {
        addNode({
            id: nodeId('output', output.name),
            kind: 'output',
            name: output.name,
            source: output.source
        });
    }

    for (const module of document.module) {
        addNode({
            id: nodeId('module', module.name),
            kind: 'module',
            name: module.name,
            source: module.source
        });
    }

    for (const resource of document.resource) {
        addNode({
            id: nodeId('resource', resource.type, resource.name),
            kind: 'resource',
            name: resource.name,
            type: resource.type,
            source: resource.source
        });
    }

    for (const data of document.data) {
        addNode({
            id: nodeId('data', data.dataType, data.name),
            kind: 'data',
            name: data.name,
            type: data.dataType,
            source: data.source
        });
    }

    for (const local of document.locals) {
        addNode({
            id: nodeId('locals', local.name),
            kind: 'locals',
            name: local.name,
            source: local.source
        });
    }
}

function referencesFromAttributes(attributes: Record<string, Value | undefined> | undefined): Reference[] {
    if (!attributes) {
        return [];
    }
    return Object.values(attributes).flatMap((value) => referencesFromValue(value));
}

function referencesFromNestedBlocks(blocks: NestedBlock[]): Reference[] {
    const refs: Reference[] = [];
    for (const block of blocks) {
        refs.push(...referencesFromAttributes(block.attributes));
        refs.push(...referencesFromNestedBlocks(block.blocks));
    }
    return refs;
}

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

function nodeId(kind: GraphNodeKind, primary: string, secondary?: string): string {
    return [kind, primary, secondary].filter(Boolean).join('.');
}

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

function referenceToId(ref: Reference): string {
    switch (ref.kind) {
        case 'variable':
            return nodeId('variable', ref.name);
        case 'local':
            return nodeId('locals', ref.name);
        case 'module_output':
            return nodeId('module_output', `${ref.module}`, ref.name);
        case 'data':
            return nodeId('data', ref.data_type, ref.name);
        case 'resource':
            return nodeId('resource', ref.resource_type, ref.name);
        case 'path':
            return nodeId('path', ref.name);
        default:
            return '';
    }
}

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
        default:
            return { id: `external.${JSON.stringify(ref)}`, kind: 'external', name: 'external' };
    }
}
