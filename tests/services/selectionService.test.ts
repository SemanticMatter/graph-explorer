import test from 'node:test';
import assert from 'node:assert/strict';
import { RdfNode } from '../../types';
import { applyNodeClickSelection, resolveSelectedNode } from '../../services/selectionService';

const fullNodes: RdfNode[] = [
  { id: 'n1', label: 'Node 1', type: 'resource', classes: ['ex:Class'] },
  { id: 'n2', label: 'Node 2', type: 'resource', classes: [] }
];

const mergedNodes: RdfNode[] = [
  { id: 'n1', label: 'Node 1 merged', type: 'resource', classes: ['ex:Class'], isExpanded: true }
];

test('resolveSelectedNode prefers merged graph view first', () => {
  const resolved = resolveSelectedNode('n1', mergedNodes, fullNodes);
  assert.equal(resolved?.label, 'Node 1 merged');
});

test('regression: single-click node selects node so inspector should be visible', () => {
  const clicked = { id: 'n1', label: 'Node 1', type: 'resource', classes: [] } as RdfNode;
  const next = applyNodeClickSelection(clicked, mergedNodes, fullNodes, false);

  assert.equal(next.selectedNodeId, 'n1');
  assert.equal(Boolean(next.selectedNode), true);
  assert.equal(Boolean(next.selectedNode && next.selectedNodeId), true);
});

test('regression: background click clears selection so inspector should be hidden', () => {
  const next = applyNodeClickSelection(null, mergedNodes, fullNodes, true);

  assert.equal(next.selectedNodeId, null);
  assert.equal(next.selectedNode, null);
  assert.equal(next.focusMode, false);
  assert.equal(Boolean(next.selectedNode), false);
});
