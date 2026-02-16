import React, { useEffect, useRef, useState, useCallback } from 'react';
import CytoscapeComponent from 'react-cytoscapejs';
import { Core, NodeSingular } from 'cytoscape';
import { RdfNode, RdfEdge, LayoutType, ColorSettings } from '../../types';
import { COLOR_PALETTE } from '../../constants';

interface GraphViewerProps {
  nodes: RdfNode[];
  edges: RdfEdge[];
  layout: LayoutType;
  colorSettings: ColorSettings;
  onNodeClick: (node: RdfNode | null) => void;
  onNodeDoubleClick: (nodeId: string) => void;
  selectedNodeId: string | null;
  focusMode: boolean;
  graphVersion: number;
  layoutRunNonce: number;
  expansionRevision: number;
  lastExpandedNodeId: string | null;
  setCyInstance?: (cy: Core) => void;
}

const DOUBLE_CLICK_MS = 260;

const GraphViewer: React.FC<GraphViewerProps> = ({
  nodes,
  edges,
  layout,
  colorSettings,
  onNodeClick,
  onNodeDoubleClick,
  selectedNodeId,
  focusMode,
  graphVersion,
  layoutRunNonce,
  expansionRevision,
  lastExpandedNodeId,
  setCyInstance
}) => {
  const cyRef = useRef<Core | null>(null);
  const [elements, setElements] = useState<any[]>([]);
  const [hoverHint, setHoverHint] = useState<{ x: number; y: number; show: boolean }>({ x: 0, y: 0, show: false });
  const lastTapRef = useRef<{ nodeId: string; ts: number } | null>(null);

  useEffect(() => {
    const newElements = [
      ...nodes.map((n) => ({
        data: {
          id: n.id,
          label: n.label,
          type: n.type,
          classes: n.classes,
          community: n.community,
          degree: n.val,
          isExpanded: n.isExpanded ? 1 : 0,
          isExpandedSeed: n.isExpandedSeed ? 1 : 0
        }
      })),
      ...edges.map((e) => ({
        data: {
          id: e.id,
          source: e.source,
          target: e.target,
          label: e.label,
          isExpanded: e.isExpanded ? 1 : 0
        }
      }))
    ];
    setElements(newElements);
  }, [nodes, edges]);

  const getLayoutConfig = useCallback((type: LayoutType) => {
    const baseConfig = { animate: true, animationDuration: 500 };
    switch (type) {
      case 'force':
        return {
          name: 'cose',
          ...baseConfig,
          idealEdgeLength: 100,
          nodeOverlap: 20,
          refresh: 20,
          fit: true,
          padding: 30,
          randomize: false,
          componentSpacing: 100,
          nodeRepulsion: 400000,
          edgeElasticity: 100,
          nestingFactor: 5
        };
      case 'hierarchical':
        return { name: 'breadthfirst', ...baseConfig, directed: true, spacingFactor: 1.75, circle: false, grid: false };
      case 'circular':
        return { name: 'circle', ...baseConfig, radius: 300 };
      case 'radial':
        return { name: 'concentric', ...baseConfig, minNodeSpacing: 50 };
      case 'grid':
        return { name: 'grid', ...baseConfig, rows: undefined };
      default:
        return { name: 'cose', ...baseConfig };
    }
  }, []);

  // Full layout only on explicit layout changes or new dataset loads.
  useEffect(() => {
    if (!cyRef.current || elements.length === 0) return;
    const cy = cyRef.current;

    const layoutConfig = getLayoutConfig(layout);
    const layoutInstance = cy.layout(layoutConfig);
    layoutInstance.run();
  }, [layout, graphVersion, layoutRunNonce, getLayoutConfig, elements.length]);

  // Incremental local layout around just-expanded node to avoid global relayout.
  useEffect(() => {
    if (!cyRef.current || !lastExpandedNodeId) return;
    const cy = cyRef.current;

    const centerNode = cy.getElementById(lastExpandedNodeId);
    if (!centerNode || centerNode.empty()) return;

    const localCollection = centerNode.closedNeighborhood();
    if (localCollection.length <= 1) return;

    const localLayout = localCollection.layout({
      name: 'cose',
      fit: false,
      animate: true,
      randomize: false,
      animationDuration: 250,
      padding: 10,
      componentSpacing: 40,
      idealEdgeLength: 80,
      nodeRepulsion: 250000
    } as any);

    localLayout.run();
  }, [expansionRevision, lastExpandedNodeId]);

  const getNodeColor = useCallback((nodeData: any) => {
    if (colorSettings.mode === 'mono') return colorSettings.baseColor;

    if (colorSettings.mode === 'class') {
      const cls = nodeData.classes && nodeData.classes.length > 0 ? nodeData.classes[0] : 'default';
      let hash = 0;
      for (let i = 0; i < cls.length; i++) hash = cls.charCodeAt(i) + ((hash << 5) - hash);
      const index = Math.abs(hash) % COLOR_PALETTE.length;
      return COLOR_PALETTE[index];
    }

    if (colorSettings.mode === 'community') {
      const comm = nodeData.community;
      if (comm === undefined) return '#64748b';
      return COLOR_PALETTE[comm % COLOR_PALETTE.length];
    }

    if (colorSettings.mode === 'degree') {
      const intensity = Math.min(1, (nodeData.degree || 1) / 10);
      return intensity > 0.5 ? '#ef4444' : '#3b82f6';
    }

    return colorSettings.baseColor;
  }, [colorSettings]);

  useEffect(() => {
    if (!cyRef.current) return;
    const cy = cyRef.current;

    cy.style([
      {
        selector: 'node',
        style: {
          'background-color': (ele: NodeSingular) => getNodeColor(ele.data()),
          'label': 'data(label)',
          'color': '#cbd5e1',
          'text-valign': 'center',
          'text-halign': 'center',
          'text-outline-color': '#0f172a',
          'text-outline-width': 2,
          'font-size': '12px',
          'width': (ele: NodeSingular) => `${Math.max(20, Math.min(60, (ele.data('degree') || 1) * 5 + 20))}px`,
          'height': (ele: NodeSingular) => `${Math.max(20, Math.min(60, (ele.data('degree') || 1) * 5 + 20))}px`,
          'border-width': 2,
          'border-color': 'rgba(255,255,255,0.1)',
          'transition-property': 'background-color, width, height, opacity, border-color',
          'transition-duration': 250
        }
      },
      {
        selector: 'node[type="literal"]',
        style: {
          'shape': 'rectangle',
          'width': 'label',
          'padding': 10
        }
      },
      {
        selector: 'node[isExpanded = 1]',
        style: {
          'border-width': 3,
          'border-color': '#fbbf24',
          'shadow-blur': 14,
          'shadow-color': '#f59e0b',
          'shadow-opacity': 0.45
        }
      },
      {
        selector: 'node[isExpandedSeed = 1]',
        style: {
          'border-width': 4,
          'border-color': '#fde68a',
          'shadow-blur': 18,
          'shadow-color': '#f59e0b',
          'shadow-opacity': 0.65
        }
      },
      {
        selector: 'edge',
        style: {
          'width': '1.5px',
          'line-color': '#334155',
          'target-arrow-color': '#334155',
          'target-arrow-shape': 'triangle',
          'curve-style': 'bezier',
          'opacity': 0.6,
          'label': 'data(label)',
          'font-size': '10px',
          'color': '#64748b',
          'text-rotation': 'autorotate',
          'text-background-opacity': 1,
          'text-background-color': '#020617',
          'text-background-padding': 2
        }
      },
      {
        selector: 'edge[isExpanded = 1]',
        style: {
          'width': '2.5px',
          'line-color': '#fbbf24',
          'target-arrow-color': '#fbbf24',
          'opacity': 0.95,
          'text-background-color': '#1f2937',
          'text-background-opacity': 0.9,
          'color': '#fcd34d'
        }
      },
      {
        selector: ':selected',
        style: {
          'border-width': 4,
          'border-color': '#fff',
          'line-color': '#94a3b8',
          'target-arrow-color': '#94a3b8',
          'opacity': 1
        }
      },
      {
        selector: '.dimmed',
        style: {
          'opacity': 0.1,
          'label': ''
        }
      },
      {
        selector: '.highlighted',
        style: {
          'opacity': 1,
          'z-index': 9999
        }
      }
    ]);
  }, [colorSettings, getNodeColor]);

  useEffect(() => {
    if (!cyRef.current) return;
    const cy = cyRef.current;

    cy.elements().removeClass('dimmed highlighted');

    if (selectedNodeId) {
      const selected = cy.getElementById(selectedNodeId);
      if (!selected || selected.empty()) return;

      if (focusMode) {
        cy.elements().addClass('dimmed');
        const neighborhood = selected.neighborhood().add(selected);
        neighborhood.removeClass('dimmed').addClass('highlighted');
      }

      cy.$(':selected').unselect();
      selected.select();
    }
  }, [selectedNodeId, focusMode]);

  useEffect(() => {
    if (!cyRef.current) return;
    const cy = cyRef.current;

    const handleNodeTap = (evt: any) => {
      const node = evt.target;
      const now = Date.now();
      const lastTap = lastTapRef.current;

      onNodeClick({
        id: node.id(),
        label: node.data('label'),
        type: node.data('type'),
        classes: node.data('classes'),
        community: node.data('community'),
        curie: node.data('curie'),
        isExpanded: node.data('isExpanded') === 1,
        isExpandedSeed: node.data('isExpandedSeed') === 1
      });

      if (lastTap && lastTap.nodeId === node.id() && now - lastTap.ts <= DOUBLE_CLICK_MS) {
        onNodeDoubleClick(node.id());
        lastTapRef.current = null;
        return;
      }

      lastTapRef.current = { nodeId: node.id(), ts: now };
    };

    const handleCanvasTap = (evt: any) => {
      if (evt.target === cy) {
        onNodeClick(null);
        setHoverHint((prev) => ({ ...prev, show: false }));
      }
    };

    const handleMouseOverNode = (evt: any) => {
      const p = evt.renderedPosition;
      setHoverHint({ x: p.x + 12, y: p.y + 12, show: true });
      cy.container().style.cursor = 'pointer';
    };

    const handleMouseMoveNode = (evt: any) => {
      const p = evt.renderedPosition;
      setHoverHint((prev) => ({ ...prev, x: p.x + 12, y: p.y + 12, show: true }));
    };

    const handleMouseOutNode = () => {
      setHoverHint((prev) => ({ ...prev, show: false }));
      cy.container().style.cursor = 'default';
    };

    cy.on('tap', 'node', handleNodeTap);
    cy.on('tap', handleCanvasTap);
    cy.on('mouseover', 'node', handleMouseOverNode);
    cy.on('mousemove', 'node', handleMouseMoveNode);
    cy.on('mouseout', 'node', handleMouseOutNode);

    return () => {
      cy.off('tap', 'node', handleNodeTap);
      cy.off('tap', handleCanvasTap);
      cy.off('mouseover', 'node', handleMouseOverNode);
      cy.off('mousemove', 'node', handleMouseMoveNode);
      cy.off('mouseout', 'node', handleMouseOutNode);
    };
  }, [onNodeClick, onNodeDoubleClick]);

  return (
    <div className="relative w-full h-full">
      {hoverHint.show && (
        <div
          className="absolute z-50 px-2 py-1 text-[11px] rounded bg-slate-800/95 border border-slate-600 text-slate-100 pointer-events-none"
          style={{ left: hoverHint.x, top: hoverHint.y }}
        >
          Double-click to expand neighbors
        </div>
      )}
      <CytoscapeComponent
        elements={CytoscapeComponent.normalizeElements(elements)}
        style={{ width: '100%', height: '100%' }}
        cy={(cy) => {
          cyRef.current = cy;
          if (setCyInstance) setCyInstance(cy);
        }}
        wheelSensitivity={0.3}
      />
    </div>
  );
};

export default React.memo(GraphViewer);
