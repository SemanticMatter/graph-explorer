import test from 'node:test';
import assert from 'node:assert/strict';
import { detectCommunities } from '../../services/communityService';
import { RdfEdge, RdfNode } from '../../types';

const originalRandom = Math.random;

test.afterEach(() => {
  Math.random = originalRandom;
});

test('detectCommunities returns a community id for every node', () => {
  Math.random = () => 0.1;

  const nodes: RdfNode[] = [
    { id: 'A', label: 'A', type: 'resource', classes: [] },
    { id: 'B', label: 'B', type: 'resource', classes: [] },
    { id: 'C', label: 'C', type: 'resource', classes: [] }
  ];
  const edges: RdfEdge[] = [
    { id: 'e1', source: 'A', target: 'B', label: 'rel', predicate: 'rel' }
  ];

  const result = detectCommunities(nodes, edges);

  assert.equal(result.size, 3);
  assert.equal(result.has('A'), true);
  assert.equal(result.has('B'), true);
  assert.equal(result.has('C'), true);

  for (const value of result.values()) {
    assert.equal(Number.isInteger(value), true);
    assert.equal(value >= 0, true);
  }
});

test('detectCommunities keeps disconnected components separate for simple graph', () => {
  Math.random = () => 0.1;

  const nodes: RdfNode[] = [
    { id: 'A', label: 'A', type: 'resource', classes: [] },
    { id: 'B', label: 'B', type: 'resource', classes: [] },
    { id: 'C', label: 'C', type: 'resource', classes: [] },
    { id: 'D', label: 'D', type: 'resource', classes: [] }
  ];
  const edges: RdfEdge[] = [
    { id: 'e1', source: 'A', target: 'B', label: 'rel', predicate: 'rel' },
    { id: 'e2', source: 'C', target: 'D', label: 'rel', predicate: 'rel' }
  ];

  const result = detectCommunities(nodes, edges);

  assert.equal(result.get('A'), result.get('B'));
  assert.equal(result.get('C'), result.get('D'));
  assert.notEqual(result.get('A'), result.get('C'));
});

test('detectCommunities handles empty graph', () => {
  const result = detectCommunities([], []);
  assert.equal(result.size, 0);
});
