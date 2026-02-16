import { RdfNode } from '../types';

export interface SelectionState {
  selectedNodeId: string | null;
  selectedNode: RdfNode | null;
  focusMode: boolean;
}

export function resolveSelectedNode(
  selectedNodeId: string | null,
  mergedNodes: RdfNode[],
  fullNodes: RdfNode[]
): RdfNode | null {
  if (!selectedNodeId) return null;

  return (
    mergedNodes.find((n) => n.id === selectedNodeId) ||
    fullNodes.find((n) => n.id === selectedNodeId) ||
    null
  );
}

export function applyNodeClickSelection(
  clickedNode: RdfNode | null,
  mergedNodes: RdfNode[],
  fullNodes: RdfNode[],
  currentFocusMode: boolean
): SelectionState {
  if (!clickedNode) {
    return {
      selectedNodeId: null,
      selectedNode: null,
      focusMode: false
    };
  }

  return {
    selectedNodeId: clickedNode.id,
    selectedNode: resolveSelectedNode(clickedNode.id, mergedNodes, fullNodes) || clickedNode,
    focusMode: currentFocusMode
  };
}
