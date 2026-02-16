import React, { useEffect, useRef, useState, useCallback } from 'react';
import CytoscapeComponent from 'react-cytoscapejs';
import cytoscape, { Core, EdgeSingular, NodeSingular } from 'cytoscape';
import { RdfNode, RdfEdge, LayoutType, ColorSettings } from '../../types';
import { COLOR_PALETTE } from '../../constants';

interface GraphViewerProps {
  nodes: RdfNode[];
  edges: RdfEdge[];
  layout: LayoutType;
  colorSettings: ColorSettings;
  onNodeClick: (node: RdfNode | null) => void;
  selectedNodeId: string | null;
  focusMode: boolean;
  setCyInstance?: (cy: Core) => void;
}

const GraphViewer: React.FC<GraphViewerProps> = ({ 
  nodes, 
  edges, 
  layout, 
  colorSettings,
  onNodeClick,
  selectedNodeId,
  focusMode,
  setCyInstance
}) => {
  const cyRef = useRef<Core | null>(null);
  const [elements, setElements] = useState<any[]>([]);

  // 1. Prepare Elements
  useEffect(() => {
    const newElements = [
      ...nodes.map(n => ({
        data: { 
          id: n.id, 
          label: n.label, 
          type: n.type,
          classes: n.classes,
          community: n.community,
          degree: n.val // simplistic degree
        },
      })),
      ...edges.map(e => ({
        data: { 
          id: e.id, 
          source: e.source, 
          target: e.target, 
          label: e.label 
        }
      }))
    ];
    setElements(newElements);
  }, [nodes, edges]);

  // 2. Determine Layout Config
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
          nestingFactor: 5, 
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

  // 3. Handle Layout Updates
  useEffect(() => {
    if (!cyRef.current) return;
    const cy = cyRef.current;
    
    // Only run layout if we have elements to avoid errors
    if (elements.length > 0) {
      const layoutConfig = getLayoutConfig(layout);
      const layoutInstance = cy.layout(layoutConfig);
      layoutInstance.run();
    }

  }, [layout, elements, getLayoutConfig]);

  // 4. Handle Styling & Coloring
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
      if (comm === undefined) return '#64748b'; // slate-500
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
          'color': '#cbd5e1', // slate-300
          'text-valign': 'center',
          'text-halign': 'center',
          'text-outline-color': '#0f172a',
          'text-outline-width': 2,
          'font-size': '12px',
          'width': (ele: NodeSingular) => `${Math.max(20, Math.min(60, (ele.data('degree') || 1) * 5 + 20))}px`,
          'height': (ele: NodeSingular) => `${Math.max(20, Math.min(60, (ele.data('degree') || 1) * 5 + 20))}px`,
          'border-width': 2,
          'border-color': 'rgba(255,255,255,0.1)',
          'transition-property': 'background-color, width, height, opacity',
          'transition-duration': 300
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
        selector: 'edge',
        style: {
          'width': '1.5px',
          'line-color': '#334155', // slate-700
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
          'label': '',
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

  // 5. Handle Selection & Focus Mode
  useEffect(() => {
    if (!cyRef.current) return;
    const cy = cyRef.current;

    cy.elements().removeClass('dimmed highlighted');

    if (selectedNodeId) {
      const selected = cy.getElementById(selectedNodeId);
      
      if (focusMode) {
        cy.elements().addClass('dimmed');
        const neighborhood = selected.neighborhood().add(selected);
        neighborhood.removeClass('dimmed').addClass('highlighted');
      }
      
      cy.$(':selected').unselect();
      selected.select();
    }
  }, [selectedNodeId, focusMode]);

  return (
    <CytoscapeComponent
      elements={CytoscapeComponent.normalizeElements(elements)}
      style={{ width: '100%', height: '100%' }}
      cy={(cy) => {
        cyRef.current = cy;
        if (setCyInstance) setCyInstance(cy);
        
        cy.on('tap', 'node', (evt) => {
          const node = evt.target;
          onNodeClick({ 
             id: node.id(), 
             label: node.data('label'), 
             type: node.data('type'),
             classes: node.data('classes'),
             community: node.data('community'),
             curie: node.data('curie')
          });
        });
        cy.on('tap', (evt) => {
          if (evt.target === cy) {
            onNodeClick(null);
          }
        });
      }}
      wheelSensitivity={0.3}
    />
  );
};

export default React.memo(GraphViewer);