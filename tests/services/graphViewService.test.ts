import test from 'node:test';
import assert from 'node:assert/strict';
import { FilterSettings, GraphData } from '../../types';
import {
  RDF_TYPE,
  RDFS_SUBCLASS_OF,
  buildExpandedGraph,
  buildFilteredGraph,
  buildGraphIndex,
  deriveInitialPredicatePolicy,
  enforcePredicateVisibilityPolicy,
  getNeighborCount,
  mergeFilteredWithExpanded
} from '../../services/graphViewService';
import { PREDICATE_NONE_SENTINEL } from '../../constants';

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

test('buildFilteredGraph hides all edges in disable-all predicate mode', () => {
  const filtered = buildFilteredGraph(sampleGraph, {
    ...baseFilter,
    selectedPredicates: [PREDICATE_NONE_SENTINEL]
  });

  assert.equal(filtered.edges.length, 0);
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

test('predicate policy: only active predicates and expanded override edges remain visible', () => {
  const merged = {
    nodes: sampleGraph.nodes,
    edges: [
      { ...sampleGraph.edges[0], isExpanded: false }, // knows
      { ...sampleGraph.edges[1], isExpanded: false }, // worksAt
      { ...sampleGraph.edges[2], isExpanded: true } // name (override)
    ]
  };

  const result = enforcePredicateVisibilityPolicy(merged, new Set(['knows']), null);

  assert.deepEqual(result.edges.map((e) => e.id).sort(), ['e1', 'e3']);
});

test('predicate policy: expanded edges disappear immediately once expansion flag is removed', () => {
  const withExpansion = {
    nodes: sampleGraph.nodes,
    edges: [{ ...sampleGraph.edges[2], isExpanded: true }] // name
  };
  const withoutExpansion = {
    nodes: sampleGraph.nodes,
    edges: [{ ...sampleGraph.edges[2], isExpanded: false }]
  };

  const activePredicates = new Set(['knows']);
  const resultWith = enforcePredicateVisibilityPolicy(withExpansion, activePredicates, null);
  const resultWithout = enforcePredicateVisibilityPolicy(withoutExpansion, activePredicates, null);

  assert.equal(resultWith.edges.length, 1);
  assert.equal(resultWithout.edges.length, 0);
});

test('deriveInitialPredicatePolicy keeps all predicates for small graphs', () => {
  const result = deriveInitialPredicatePolicy(sampleGraph, {
    tripleThreshold: 100,
    maxActivePredicates: 2
  });

  assert.equal(result.isLimited, false);
  assert.deepEqual(result.selectedPredicates, []);
  assert.equal(result.summary, null);
});

test('deriveInitialPredicatePolicy limits predicates for large graphs', () => {
  const largeGraph: GraphData = {
    nodes: sampleGraph.nodes,
    edges: [
      ...Array.from({ length: 60 }, (_, i) => ({ id: `k-${i}`, source: 'A', target: 'B', label: 'knows', predicate: 'knows' })),
      ...Array.from({ length: 40 }, (_, i) => ({ id: `w-${i}`, source: 'A', target: 'C', label: 'worksAt', predicate: 'worksAt' })),
      ...Array.from({ length: 20 }, (_, i) => ({ id: `n-${i}`, source: 'A', target: 'LIT', label: 'name', predicate: 'name' }))
    ],
    prefixes: {}
  };

  const result = deriveInitialPredicatePolicy(largeGraph, {
    tripleThreshold: 50,
    maxActivePredicates: 2
  });

  assert.equal(result.isLimited, true);
  assert.deepEqual(result.selectedPredicates.sort(), ['knows', 'worksAt']);
  assert.equal(Boolean(result.summary), true);
});

test('deriveInitialPredicatePolicy disables all when a huge graph has a single predicate', () => {
  const singlePredLarge: GraphData = {
    nodes: sampleGraph.nodes,
    edges: Array.from({ length: 120 }, (_, i) => ({
      id: `e-${i}`,
      source: 'A',
      target: 'B',
      label: 'knows',
      predicate: 'knows'
    })),
    prefixes: {}
  };

  const result = deriveInitialPredicatePolicy(singlePredLarge, {
    tripleThreshold: 100,
    maxActivePredicates: 10
  });

  assert.equal(result.isLimited, true);
  assert.deepEqual(result.selectedPredicates, [PREDICATE_NONE_SENTINEL]);
});
