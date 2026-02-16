import test from 'node:test';
import assert from 'node:assert/strict';
import { FilterSettings, GraphData } from '../../types';
import {
  RDF_TYPE,
  RDFS_SUBCLASS_OF,
  buildExpandedGraph,
  buildFilteredGraph,
  buildGraphIndex,
  getNeighborCount,
  mergeFilteredWithExpanded
} from '../../services/graphViewService';

const baseFilter: FilterSettings = {
  showLiterals: true,
  selectedClasses: [],
  selectedPredicates: [],
  searchTerm: ''
};

const sampleGraph: GraphData = {
  nodes: [
    { id: 'A', label: 'Alice', type: 'resource', classes: ['ex:Person'] },
    { id: 'B', label: 'Bob', type: 'resource', classes: ['ex:Person'] },
    { id: 'C', label: 'Company', type: 'resource', classes: ['ex:Organization'] },
    { id: 'LIT', label: 'Alice literal', type: 'literal', classes: [] },
    { id: 'ex:Person', label: 'Person', type: 'resource', classes: [] },
    { id: 'ex:Agent', label: 'Agent', type: 'resource', classes: [] }
  ],
  edges: [
    { id: 'e1', source: 'A', target: 'B', label: 'knows', predicate: 'http://example/knows' },
    { id: 'e2', source: 'A', target: 'C', label: 'worksAt', predicate: 'http://example/worksAt' },
    { id: 'e3', source: 'A', target: 'LIT', label: 'name', predicate: 'http://example/name' },
    { id: 'e4', source: 'A', target: 'ex:Person', label: 'rdf:type', predicate: RDF_TYPE },
    { id: 'e5', source: 'ex:Person', target: 'ex:Agent', label: 'rdfs:subClassOf', predicate: RDFS_SUBCLASS_OF }
  ],
  prefixes: { ex: 'http://example/' }
};

test('buildGraphIndex indexes nodes and all touching edges', () => {
  const index = buildGraphIndex(sampleGraph);

  assert.equal(index.nodeById.get('A')?.label, 'Alice');
  assert.deepEqual((index.edgesByNode.get('A') || []).map((e) => e.id).sort(), ['e1', 'e2', 'e3', 'e4']);
  assert.deepEqual((index.edgesByNode.get('B') || []).map((e) => e.id), ['e1']);
});

test('buildFilteredGraph applies search, class, literal and predicate filters', () => {
  const filtered = buildFilteredGraph(sampleGraph, {
    ...baseFilter,
    showLiterals: false,
    selectedClasses: ['ex:Person'],
    selectedPredicates: ['knows'],
    searchTerm: 'ali'
  });

  assert.deepEqual(filtered.nodes.map((n) => n.id), ['A']);
  assert.deepEqual(filtered.edges, []);
});

test('buildFilteredGraph keeps connected edges for included nodes', () => {
  const filtered = buildFilteredGraph(sampleGraph, {
    ...baseFilter,
    selectedPredicates: ['knows', 'worksAt']
  });

  assert.equal(filtered.nodes.some((n) => n.id === 'A'), true);
  assert.deepEqual(filtered.edges.map((e) => e.id).sort(), ['e1', 'e2']);
});

test('buildExpandedGraph includes 1-hop, rdf:type, and subclass hierarchy', () => {
  const index = buildGraphIndex(sampleGraph);
  const expanded = buildExpandedGraph(index, new Set(['A']));

  const edgeIds = expanded.edges.map((e) => e.id).sort();
  assert.deepEqual(edgeIds, ['e1', 'e2', 'e3', 'e4', 'e5']);

  const nodeIds = expanded.nodes.map((n) => n.id);
  assert.equal(nodeIds.includes('B'), true);
  assert.equal(nodeIds.includes('C'), true);
  assert.equal(nodeIds.includes('ex:Person'), true);
  assert.equal(nodeIds.includes('ex:Agent'), true);
});

test('mergeFilteredWithExpanded marks expansion-only entities', () => {
  const filtered: GraphData = {
    ...sampleGraph,
    nodes: sampleGraph.nodes.filter((n) => ['A', 'B'].includes(n.id)),
    edges: [sampleGraph.edges[0]]
  };

  const expanded = {
    nodes: sampleGraph.nodes.filter((n) => ['A', 'C'].includes(n.id)),
    edges: sampleGraph.edges.filter((e) => ['e1', 'e2'].includes(e.id))
  };

  const merged = mergeFilteredWithExpanded(filtered, expanded, new Set(['A']));

  const byId = new Map(merged.nodes.map((n) => [n.id, n]));
  const byEdge = new Map(merged.edges.map((e) => [e.id, e]));

  assert.equal(byId.get('A')?.isExpandedSeed, true);
  assert.equal(byId.get('A')?.isExpanded, false);
  assert.equal(byId.get('C')?.isExpanded, true);
  assert.equal(byEdge.get('e1')?.isExpanded, false);
  assert.equal(byEdge.get('e2')?.isExpanded, true);
});

test('getNeighborCount counts unique 1-hop neighbors', () => {
  const index = buildGraphIndex(sampleGraph);
  assert.equal(getNeighborCount(index, 'A'), 4);
  assert.equal(getNeighborCount(index, 'B'), 1);
  assert.equal(getNeighborCount(index, 'missing'), 0);
});
