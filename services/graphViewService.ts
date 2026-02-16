import { FilterSettings, GraphData, RdfEdge, RdfNode } from '../types';

export const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
export const RDFS_SUBCLASS_OF = 'http://www.w3.org/2000/01/rdf-schema#subClassOf';

export interface GraphIndex {
  nodeById: Map<string, RdfNode>;
  edgesByNode: Map<string, RdfEdge[]>;
}

export function buildGraphIndex(fullGraph: GraphData): GraphIndex {
  const nodeById = new Map<string, RdfNode>();
  const edgesByNode = new Map<string, RdfEdge[]>();

  fullGraph.nodes.forEach((node) => {
    nodeById.set(node.id, node);
  });

  fullGraph.edges.forEach((edge) => {
    const sourceEdges = edgesByNode.get(edge.source) || [];
    sourceEdges.push(edge);
    edgesByNode.set(edge.source, sourceEdges);

    const targetEdges = edgesByNode.get(edge.target) || [];
    targetEdges.push(edge);
    edgesByNode.set(edge.target, targetEdges);
  });

  return { nodeById, edgesByNode };
}

export function buildFilteredGraph(fullGraph: GraphData, filterSettings: FilterSettings): GraphData {
  if (fullGraph.nodes.length === 0) {
    return { nodes: [], edges: [], prefixes: {} };
  }

  const searchTerm = filterSettings.searchTerm.trim().toLowerCase();
  const selectedClasses = new Set(filterSettings.selectedClasses);
  const selectedPredicates = new Set(filterSettings.selectedPredicates);

  const nodeIds = new Set<string>();

  fullGraph.nodes.forEach((node) => {
    if (!filterSettings.showLiterals && node.type === 'literal') return;

    if (selectedClasses.size > 0) {
      const hasClass = node.classes.some((cls) => selectedClasses.has(cls));
      if (!hasClass) return;
    }

    if (searchTerm) {
      const matches =
        node.label.toLowerCase().includes(searchTerm) ||
        node.id.toLowerCase().includes(searchTerm) ||
        Boolean(node.curie && node.curie.toLowerCase().includes(searchTerm));
      if (!matches) return;
    }

    nodeIds.add(node.id);
  });

  const edges = fullGraph.edges.filter((edge) => {
    if (selectedPredicates.size > 0 && !selectedPredicates.has(edge.label) && !selectedPredicates.has(edge.predicate)) {
      return false;
    }
    return nodeIds.has(edge.source) && nodeIds.has(edge.target);
  });

  return {
    nodes: fullGraph.nodes.filter((n) => nodeIds.has(n.id)),
    edges,
    prefixes: fullGraph.prefixes
  };
}

export function buildExpandedGraph(index: GraphIndex, expandedNodes: Set<string>) {
  if (expandedNodes.size === 0) {
    return { nodes: [] as RdfNode[], edges: [] as RdfEdge[] };
  }

  const nodeIds = new Set<string>();
  const edgeIds = new Set<string>();
  const edges: RdfEdge[] = [];

  const addEdge = (edge: RdfEdge) => {
    if (edgeIds.has(edge.id)) return;
    edgeIds.add(edge.id);
    edges.push(edge);
    nodeIds.add(edge.source);
    nodeIds.add(edge.target);
  };

  expandedNodes.forEach((rootId) => {
    nodeIds.add(rootId);

    const directEdges = index.edgesByNode.get(rootId) || [];
    const oneHopNodeIds = new Set<string>([rootId]);
    directEdges.forEach((edge) => {
      addEdge(edge);
      oneHopNodeIds.add(edge.source);
      oneHopNodeIds.add(edge.target);
    });

    const classNodeIds = new Set<string>();
    oneHopNodeIds.forEach((nodeId) => {
      const touchingEdges = index.edgesByNode.get(nodeId) || [];
      touchingEdges.forEach((edge) => {
        if (edge.predicate !== RDF_TYPE) return;
        addEdge(edge);
        classNodeIds.add(edge.source);
        classNodeIds.add(edge.target);
      });
    });

    const classQueue = Array.from(classNodeIds);
    const visitedClassNodes = new Set(classQueue);
    let safetyCounter = 0;

    while (classQueue.length > 0 && safetyCounter < 5000) {
      safetyCounter += 1;
      const classId = classQueue.shift() as string;
      const touchingEdges = index.edgesByNode.get(classId) || [];

      touchingEdges.forEach((edge) => {
        if (edge.predicate !== RDFS_SUBCLASS_OF) return;
        addEdge(edge);

        if (!visitedClassNodes.has(edge.source)) {
          visitedClassNodes.add(edge.source);
          classQueue.push(edge.source);
        }
        if (!visitedClassNodes.has(edge.target)) {
          visitedClassNodes.add(edge.target);
          classQueue.push(edge.target);
        }
      });
    }
  });

  return {
    nodes: Array.from(nodeIds).map((id) => index.nodeById.get(id)).filter(Boolean) as RdfNode[],
    edges
  };
}

export function mergeFilteredWithExpanded(
  filteredGraph: GraphData,
  expandedGraph: { nodes: RdfNode[]; edges: RdfEdge[] },
  expandedNodes: Set<string>
) {
  const filteredNodeIds = new Set(filteredGraph.nodes.map((n) => n.id));
  const filteredEdgeIds = new Set(filteredGraph.edges.map((e) => e.id));

  const mergedNodesMap = new Map<string, RdfNode>();
  const mergedEdgesMap = new Map<string, RdfEdge>();

  filteredGraph.nodes.forEach((node) => {
    mergedNodesMap.set(node.id, {
      ...node,
      isExpanded: false,
      isExpandedSeed: expandedNodes.has(node.id)
    });
  });

  expandedGraph.nodes.forEach((node) => {
    const existing = mergedNodesMap.get(node.id);
    mergedNodesMap.set(node.id, {
      ...(existing || node),
      isExpanded: existing ? existing.isExpanded : !filteredNodeIds.has(node.id),
      isExpandedSeed: expandedNodes.has(node.id)
    });
  });

  filteredGraph.edges.forEach((edge) => {
    mergedEdgesMap.set(edge.id, { ...edge, isExpanded: false });
  });

  expandedGraph.edges.forEach((edge) => {
    const existing = mergedEdgesMap.get(edge.id);
    mergedEdgesMap.set(edge.id, {
      ...(existing || edge),
      isExpanded: existing ? existing.isExpanded : !filteredEdgeIds.has(edge.id)
    });
  });

  return {
    nodes: Array.from(mergedNodesMap.values()),
    edges: Array.from(mergedEdgesMap.values())
  };
}

export function getNeighborCount(index: GraphIndex, nodeId: string): number {
  const directEdges = index.edgesByNode.get(nodeId) || [];
  const neighborIds = new Set<string>();

  directEdges.forEach((edge) => {
    if (edge.source !== nodeId) neighborIds.add(edge.source);
    if (edge.target !== nodeId) neighborIds.add(edge.target);
  });

  return neighborIds.size;
}
