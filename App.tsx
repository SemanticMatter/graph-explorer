import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Network, Menu, Loader2, AlertCircle, RotateCcw, ZoomIn, ZoomOut, Map as MapIcon, Layers } from 'lucide-react';
import { Core } from 'cytoscape';
import { GraphData, LayoutType, ColorSettings, CommunitySettings, FilterSettings, RdfNode, RdfEdge } from './types';
import { rdfService } from './services/rdfService';
import { detectCommunities } from './services/communityService';
import { DEMO_TTL } from './constants';
import {
  buildExpandedGraph,
  buildFilteredGraph,
  buildGraphIndex,
  getNeighborCount as computeNeighborCount,
  mergeFilteredWithExpanded
} from './services/graphViewService';
import { applyNodeClickSelection, resolveSelectedNode } from './services/selectionService';
import GraphViewer from './components/Graph/GraphViewer';
import Sidebar from './components/Controls/Sidebar';
import Inspector from './components/Inspector';
import Minimap from './components/Graph/Minimap';

const EMPTY_GRAPH: GraphData = { nodes: [], edges: [], prefixes: {} };
const EXPAND_NEIGHBOR_WARN_THRESHOLD = 200;

function App() {
  const [fullGraph, setFullGraph] = useState<GraphData>(EMPTY_GRAPH);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // UI State
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<RdfNode | null>(null);
  const [focusMode, setFocusMode] = useState(false);
  const [isMinimapOpen, setIsMinimapOpen] = useState(true);

  // Cytoscape instance
  const [cyInstance, setCyInstance] = useState<Core | null>(null);

  // Graph interaction state
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [expansionRevision, setExpansionRevision] = useState(0);
  const [lastExpandedNodeId, setLastExpandedNodeId] = useState<string | null>(null);
  const [graphVersion, setGraphVersion] = useState(0);
  const [layoutRunNonce, setLayoutRunNonce] = useState(0);

  // Settings
  const [layout, setLayout] = useState<LayoutType>('force');
  const [colorSettings, setColorSettings] = useState<ColorSettings>({ mode: 'class', baseColor: '#3b82f6' });
  const [communitySettings, setCommunitySettings] = useState<CommunitySettings>({ enabled: false, algorithm: 'lpa', resolution: 1.0 });
  const [filterSettings, setFilterSettings] = useState<FilterSettings>({
    showLiterals: true,
    selectedClasses: [],
    selectedPredicates: [],
    searchTerm: ''
  });

  const graphIndex = useMemo(() => buildGraphIndex(fullGraph), [fullGraph]);

  const resetGraphInteractions = useCallback(() => {
    setExpandedNodes(new Set());
    setSelectedNodeId(null);
    setSelectedNode(null);
    setFocusMode(false);
    setLastExpandedNodeId(null);
    setExpansionRevision((v) => v + 1);
  }, []);

  const handleImport = async (file: File) => {
    setIsLoading(true);
    setError(null);
    try {
      const text = await file.text();
      const data = await rdfService.parseTurtle(text);
      setFullGraph(data);
      setCommunitySettings((s) => ({ ...s, enabled: false }));
      resetGraphInteractions();
      setGraphVersion((v) => v + 1);
    } catch (err: any) {
      setError(`Failed to parse TTL: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadDemo = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await rdfService.parseTurtle(DEMO_TTL);
      setFullGraph(data);
      setCommunitySettings((s) => ({ ...s, enabled: false }));
      resetGraphInteractions();
      setGraphVersion((v) => v + 1);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredGraph = useMemo<GraphData>(
    () => (fullGraph.nodes.length === 0 ? EMPTY_GRAPH : buildFilteredGraph(fullGraph, filterSettings)),
    [fullGraph, filterSettings]
  );

  const expandedGraph = useMemo(() => buildExpandedGraph(graphIndex, expandedNodes), [expandedNodes, graphIndex]);

  const mergedGraph = useMemo(
    () => mergeFilteredWithExpanded(filteredGraph, expandedGraph, expandedNodes),
    [filteredGraph, expandedGraph, expandedNodes]
  );

  const availablePredicates = useMemo(() => {
    const s = new Set<string>();
    fullGraph.edges.forEach((e) => s.add(e.label));
    return Array.from(s).sort();
  }, [fullGraph.edges]);

  const availableClasses = useMemo(() => {
    const s = new Set<string>();
    fullGraph.nodes.forEach((n) => n.classes.forEach((c) => s.add(c)));
    return Array.from(s).sort();
  }, [fullGraph.nodes]);

  const getNeighborCount = useCallback((nodeId: string) => {
    return computeNeighborCount(graphIndex, nodeId);
  }, [graphIndex.edgesByNode]);

  const toggleNodeExpansion = useCallback((nodeId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);

      if (next.has(nodeId)) {
        next.delete(nodeId);
        setLastExpandedNodeId(nodeId);
        setExpansionRevision((v) => v + 1);
        return next;
      }

      const neighborCount = getNeighborCount(nodeId);
      if (neighborCount > EXPAND_NEIGHBOR_WARN_THRESHOLD) {
        const shouldExpand = window.confirm(
          `This node has ${neighborCount} direct neighbors. Expanding may impact performance. Continue?`
        );
        if (!shouldExpand) return prev;
      }

      next.add(nodeId);
      setLastExpandedNodeId(nodeId);
      setExpansionRevision((v) => v + 1);
      return next;
    });
  }, [getNeighborCount]);

  const collapseAllExpanded = useCallback(() => {
    setExpandedNodes(new Set());
    setLastExpandedNodeId(null);
    setExpansionRevision((v) => v + 1);
  }, []);

  const runCommunityDetection = () => {
    setIsLoading(true);
    setTimeout(() => {
      const communities = detectCommunities(mergedGraph.nodes, mergedGraph.edges);
      const newNodes = fullGraph.nodes.map((n) => ({
        ...n,
        community: communities.get(n.id)
      }));
      setFullGraph((prev) => ({ ...prev, nodes: newNodes }));
      setCommunitySettings((s) => ({ ...s, enabled: true }));
      setColorSettings((s) => ({ ...s, mode: 'community' }));
      setIsLoading(false);
    }, 100);
  };

  const handleResetView = useCallback(() => {
    if (cyInstance) {
      cyInstance.animate({
        fit: { eles: cyInstance.elements(), padding: 50 },
        duration: 500,
        easing: 'ease-in-out-cubic'
      });
    }
  }, [cyInstance]);

  const handleZoomIn = () => {
    if (cyInstance) {
      cyInstance.zoom({
        level: cyInstance.zoom() * 1.2,
        renderedPosition: { x: cyInstance.width() / 2, y: cyInstance.height() / 2 }
      });
    }
  };

  const handleZoomOut = () => {
    if (cyInstance) {
      cyInstance.zoom({
        level: cyInstance.zoom() * 0.8,
        renderedPosition: { x: cyInstance.width() / 2, y: cyInstance.height() / 2 }
      });
    }
  };

  const handleLayoutChange = useCallback((nextLayout: LayoutType) => {
    setLayout((prev) => {
      if (prev === nextLayout) {
        setLayoutRunNonce((n) => n + 1);
      }
      return nextLayout;
    });
  }, []);

  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null) => {
      const element = target as HTMLElement | null;
      if (!element) return false;
      const tag = element.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || element.isContentEditable;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setIsSidebarOpen((prev) => !prev);
      }

      if (isTypingTarget(e.target)) return;

      if (e.key.toLowerCase() === 'm' && !e.ctrlKey && !e.metaKey) {
        setIsMinimapOpen((prev) => !prev);
      }

      if (e.key.toLowerCase() === 'r' && !e.ctrlKey && !e.metaKey) {
        handleResetView();
      }

      if (e.key.toLowerCase() === 'e' && !e.ctrlKey && !e.metaKey && selectedNodeId) {
        toggleNodeExpansion(selectedNodeId);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleResetView, selectedNodeId, toggleNodeExpansion]);

  useEffect(() => {
    setSelectedNode(resolveSelectedNode(selectedNodeId, mergedGraph.nodes, fullGraph.nodes));
  }, [selectedNodeId, mergedGraph.nodes, fullGraph.nodes]);

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-200 overflow-hidden relative selection:bg-blue-500/30">
      <header className="h-14 border-b border-white/10 glass-panel flex items-center px-4 justify-between z-30 relative">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-1.5 rounded-lg shadow-lg shadow-blue-500/20">
            <Network className="text-white" size={20} />
          </div>
          <h1 className="font-bold text-lg tracking-tight text-white">RDF Explorer</h1>
        </div>

        <div className="flex items-center gap-2">
          {expandedNodes.size > 0 && (
            <button
              onClick={collapseAllExpanded}
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-amber-500/20 text-amber-200 hover:bg-amber-500/30 rounded-md transition-colors border border-amber-400/30"
              title="Collapse all temporary 1-hop expansions"
            >
              <Layers size={14} /> Collapse Expanded ({expandedNodes.size})
            </button>
          )}
          <button
            onClick={handleResetView}
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-white/5 hover:bg-white/10 rounded-md transition-colors border border-white/5"
            title="Reset View (R)"
          >
            <RotateCcw size={14} /> Reset View
          </button>
          <div className="w-px h-6 bg-white/10 mx-2 hidden sm:block"></div>
          <div className="flex items-center gap-4 text-xs font-medium text-slate-400">
            <span className="hidden lg:inline">Ctrl+B Sidebar | E Expand</span>
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-white/10 rounded-md transition-colors"
            >
              <Menu size={20} />
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        <div
          className={`
            absolute inset-y-0 left-0 z-20 w-80 glass-panel border-r border-white/10 transform transition-transform duration-300 ease-in-out
            ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          `}
        >
          <Sidebar
            onImport={handleImport}
            onLoadDemo={handleLoadDemo}
            graphStats={{ nodes: fullGraph.nodes.length, edges: fullGraph.edges.length }}
            layout={layout}
            setLayout={handleLayoutChange}
            colorSettings={colorSettings}
            setColorSettings={setColorSettings}
            communitySettings={communitySettings}
            setCommunitySettings={setCommunitySettings}
            onRunCommunityDetection={runCommunityDetection}
            filterSettings={filterSettings}
            setFilterSettings={setFilterSettings}
            availableClasses={availableClasses}
            availablePredicates={availablePredicates}
          />
        </div>

        <div className={`flex-1 relative transition-all duration-300 ${isSidebarOpen ? 'ml-80' : 'ml-0'}`}>
          <div className="absolute inset-0 bg-slate-950 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px]">
            {fullGraph.nodes.length > 0 ? (
              <GraphViewer
                nodes={mergedGraph.nodes}
                edges={mergedGraph.edges}
                layout={layout}
                colorSettings={colorSettings}
                onNodeClick={(node) => {
                  const next = applyNodeClickSelection(node, mergedGraph.nodes, fullGraph.nodes, focusMode);
                  setSelectedNodeId(next.selectedNodeId);
                  setSelectedNode(next.selectedNode);
                  setFocusMode(next.focusMode);
                }}
                onNodeDoubleClick={toggleNodeExpansion}
                selectedNodeId={selectedNodeId}
                focusMode={focusMode}
                graphVersion={graphVersion}
                layoutRunNonce={layoutRunNonce}
                expansionRevision={expansionRevision}
                lastExpandedNodeId={lastExpandedNodeId}
                setCyInstance={setCyInstance}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-4">
                <Network size={64} className="opacity-20" />
                <p>Upload a TTL file or load the demo to begin.</p>
                <button
                  onClick={handleLoadDemo}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md transition-colors"
                >
                  Load Demo Graph
                </button>
              </div>
            )}
          </div>

          {fullGraph.nodes.length > 0 && (
            <div className="absolute top-4 right-4 z-40 glass-panel p-3 rounded-lg text-xs text-slate-300 border border-white/10">
              <div className="font-semibold text-slate-100 mb-2">Legend</div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="inline-block w-3 h-3 rounded-full bg-blue-500/80"></span>
                  Normal node
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block w-3 h-3 rounded-full border-2 border-amber-300 shadow-[0_0_8px_rgba(251,191,36,0.7)]"></span>
                  Expanded (filter override)
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block w-4 h-[2px] bg-amber-300"></span>
                  Expanded edge
                </div>
              </div>
              <div className="mt-2 text-[11px] text-slate-400">Double-click node or press E to toggle 1-hop expansion.</div>
            </div>
          )}

          {fullGraph.nodes.length > 0 && (
            <div className="absolute bottom-4 left-4 z-40 flex flex-col gap-2">
              <div className="glass-panel p-1 rounded-lg flex flex-col gap-1 shadow-xl">
                <button onClick={handleZoomIn} className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded transition-colors" title="Zoom In">
                  <ZoomIn size={18} />
                </button>
                <button onClick={handleZoomOut} className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded transition-colors" title="Zoom Out">
                  <ZoomOut size={18} />
                </button>
                <div className="h-px bg-white/10 mx-1"></div>
                <button onClick={handleResetView} className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded transition-colors" title="Reset View (R)">
                  <RotateCcw size={18} />
                </button>
              </div>
              <button
                onClick={() => setIsMinimapOpen(!isMinimapOpen)}
                className={`glass-panel p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors shadow-xl ${isMinimapOpen ? 'text-blue-400 bg-blue-500/10 border-blue-500/30' : ''}`}
                title="Toggle Minimap (M)"
              >
                <MapIcon size={18} />
              </button>
            </div>
          )}

          <Minimap cy={cyInstance} isOpen={isMinimapOpen} onClose={() => setIsMinimapOpen(false)} />

          {isLoading && (
            <div className="absolute inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <Loader2 size={40} className="animate-spin text-blue-500" />
                <span className="text-blue-200 font-medium">Processing Graph...</span>
              </div>
            </div>
          )}

          {error && (
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-red-500/10 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg flex items-center gap-3 shadow-xl backdrop-blur-md max-w-lg z-50">
              <AlertCircle size={20} className="text-red-400" />
              <p className="text-sm">{error}</p>
              <button onClick={() => setError(null)} className="ml-auto hover:text-white"><span className="sr-only">Dismiss</span>x</button>
            </div>
          )}
        </div>

        {selectedNode && (
          <Inspector
            node={selectedNode}
            edges={fullGraph.edges}
            onClose={() => {
              setSelectedNodeId(null);
              setSelectedNode(null);
              setFocusMode(false);
            }}
            onFocusModeToggle={setFocusMode}
            focusMode={focusMode}
            onCenterNode={(nodeId) => {
              setSelectedNodeId(nodeId);
              setSelectedNode(resolveSelectedNode(nodeId, mergedGraph.nodes, fullGraph.nodes));
            }}
          />
        )}
      </div>
    </div>
  );
}

export default App;
