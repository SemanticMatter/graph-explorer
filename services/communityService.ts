import { RdfNode, RdfEdge } from "../types";

// A simple deterministic Label Propagation implementation
export function detectCommunities(nodes: RdfNode[], edges: RdfEdge[]): Map<string, number> {
  // Map node IDs to indices
  const idToIndex = new Map<string, number>();
  nodes.forEach((n, i) => idToIndex.set(n.id, i));

  // Adjacency list
  const adj: number[][] = Array.from({ length: nodes.length }, () => []);
  edges.forEach(e => {
    const u = idToIndex.get(e.source);
    const v = idToIndex.get(e.target);
    if (u !== undefined && v !== undefined) {
      adj[u].push(v);
      adj[v].push(u); // Treat as undirected for community detection
    }
  });

  // Initialize labels (each node is its own community)
  let labels = nodes.map((_, i) => i);
  const maxIterations = 20;
  
  // Create a random permutation for update order to avoid oscillation
  const indices = Array.from({ length: nodes.length }, (_, i) => i);

  for (let iter = 0; iter < maxIterations; iter++) {
    let changed = false;
    
    // Shuffle indices
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }

    for (const i of indices) {
      if (adj[i].length === 0) continue;

      const labelCounts = new Map<number, number>();
      for (const neighbor of adj[i]) {
        const l = labels[neighbor];
        labelCounts.set(l, (labelCounts.get(l) || 0) + 1);
      }

      // Find max label
      let maxCount = -1;
      let bestLabels: number[] = [];
      
      labelCounts.forEach((count, lbl) => {
        if (count > maxCount) {
          maxCount = count;
          bestLabels = [lbl];
        } else if (count === maxCount) {
          bestLabels.push(lbl);
        }
      });

      // If current label is not among best, pick a random best
      if (!bestLabels.includes(labels[i])) {
        const newLabel = bestLabels[Math.floor(Math.random() * bestLabels.length)];
        labels[i] = newLabel;
        changed = true;
      }
    }

    if (!changed) break;
  }

  // Renumber communities sequentially for cleaner coloring
  const uniqueLabels = Array.from(new Set(labels));
  const labelMap = new Map<number, number>();
  uniqueLabels.forEach((l, i) => labelMap.set(l, i));

  const result = new Map<string, number>();
  nodes.forEach((n, i) => {
    result.set(n.id, labelMap.get(labels[i])!);
  });

  return result;
}
