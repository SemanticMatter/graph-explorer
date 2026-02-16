import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Network, Menu, Loader2, AlertCircle, Focus, RotateCcw, ZoomIn, ZoomOut, Map as MapIcon } from 'lucide-react';
import { Core } from 'cytoscape';
import { GraphData, LayoutType, ColorSettings, CommunitySettings, FilterSettings, RdfNode } from './types';
import { rdfService } from './services/rdfService';
import { detectCommunities } from './services/communityService';
import { DEMO_TTL } from './constants';
import GraphViewer from './components/Graph/GraphViewer';
import Sidebar from './components/Controls/Sidebar';
import Inspector from './components/Inspector';
import Minimap from './components/Graph/Minimap';

function App() {
  // --- State ---
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], edges: [], prefixes: {} });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // UI State
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [focusMode, setFocusMode] = useState(false);
  const [isMinimapOpen, setIsMinimapOpen] = useState(true);
  
  // Cytoscape Instance Reference
  const [cyInstance, setCyInstance] = useState<Core | null>(null);
  
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

  // --- Actions ---

  const handleImport = async (file: File) => {
    setIsLoading(true);
    setError(null);
    try {
      const text = await file.text();
      const data = await rdfService.parseTurtle(text);
      setGraphData(data);
      setCommunitySettings(s => ({...s, enabled: false}));
      setSelectedNodeId(null);
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
      setGraphData(data);
      setCommunitySettings(s => ({...s, enabled: false}));
      setSelectedNodeId(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const runCommunityDetection = () => {
    setIsLoading(true);
    setTimeout(() => {
      const communities = detectCommunities(visibleNodes, visibleEdges);
      const newNodes = graphData.nodes.map(n => ({
        ...n,
        community: communities.get(n.id)
      }));
      setGraphData(prev => ({ ...prev, nodes: newNodes }));
      setCommunitySettings(s => ({...s, enabled: true}));
      setColorSettings(s => ({...s, mode: 'community'}));
      setIsLoading(false);
    }, 100);
  };

  // --- View Control Actions ---
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

  // --- Derived State (Filtering) ---

  const visibleNodes = useMemo(() => {
    let filtered = graphData.nodes;
    if (filterSettings.searchTerm) {
      const lower = filterSettings.searchTerm.toLowerCase();
      filtered = filtered.filter(n => 
        n.label.toLowerCase().includes(lower) || 
        n.id.toLowerCase().includes(lower) ||
        (n.curie && n.curie.toLowerCase().includes(lower))
      );
    }
    return filtered;
  }, [graphData.nodes, filterSettings.searchTerm]);

  const visibleEdges = useMemo(() => {
    let filtered = graphData.edges;
    if (filterSettings.selectedPredicates.length > 0) {
      filtered = filtered.filter(e => filterSettings.selectedPredicates.includes(e.label) || filterSettings.selectedPredicates.includes(e.predicate));
    }
    return filtered;
  }, [graphData.edges, filterSettings.selectedPredicates]);

  const availablePredicates = useMemo(() => {
    const s = new Set<string>();
    graphData.edges.forEach(e => s.add(e.label));
    return Array.from(s).sort();
  }, [graphData.edges]);
  
  const availableClasses = useMemo(() => {
    const s = new Set<string>();
    graphData.nodes.forEach(n => n.classes.forEach(c => s.add(c)));
    return Array.from(s).sort();
  }, [graphData.nodes]);

  // --- Effects ---

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Sidebar Toggle
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        setIsSidebarOpen(prev => !prev);
      }
      // Minimap Toggle
      if (e.key.toLowerCase() === 'm' && !e.ctrlKey && !e.metaKey && (e.target as HTMLElement).tagName !== 'INPUT') {
        setIsMinimapOpen(prev => !prev);
      }
      // Reset View
      if (e.key.toLowerCase() === 'r' && !e.ctrlKey && !e.metaKey && (e.target as HTMLElement).tagName !== 'INPUT') {
        handleResetView();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleResetView]);

  const selectedNode = useMemo(() => 
    selectedNodeId ? graphData.nodes.find(n => n.id === selectedNodeId) || null : null
  , [selectedNodeId, graphData.nodes]);

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-200 overflow-hidden relative selection:bg-blue-500/30">
      
      {/* Navbar */}
      <header className="h-14 border-b border-white/10 glass-panel flex items-center px-4 justify-between z-30 relative">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-1.5 rounded-lg shadow-lg shadow-blue-500/20">
            <Network className="text-white" size={20} />
          </div>
          <h1 className="font-bold text-lg tracking-tight text-white">RDF Explorer</h1>
        </div>
        
        <div className="flex items-center gap-2">
           <button 
              onClick={handleResetView}
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-white/5 hover:bg-white/10 rounded-md transition-colors border border-white/5"
              title="Reset View (R)"
           >
              <RotateCcw size={14} /> Reset View
           </button>
           <div className="w-px h-6 bg-white/10 mx-2 hidden sm:block"></div>
           <div className="flex items-center gap-4 text-xs font-medium text-slate-400">
             <span className="hidden lg:inline">Ctrl+B Sidebar</span>
             <button 
               onClick={() => setIsSidebarOpen(!isSidebarOpen)}
               className="p-2 hover:bg-white/10 rounded-md transition-colors"
             >
               <Menu size={20} />
             </button>
           </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* Sidebar */}
        <div 
          className={`
            absolute inset-y-0 left-0 z-20 w-80 glass-panel border-r border-white/10 transform transition-transform duration-300 ease-in-out
            ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          `}
        >
          <Sidebar 
            onImport={handleImport}
            onLoadDemo={handleLoadDemo}
            graphStats={{ nodes: graphData.nodes.length, edges: graphData.edges.length }}
            layout={layout}
            setLayout={setLayout}
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

        {/* Graph Canvas Area */}
        <div className={`flex-1 relative transition-all duration-300 ${isSidebarOpen ? 'ml-80' : 'ml-0'}`}>
          {/* Canvas */}
          <div className="absolute inset-0 bg-slate-950 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px]">
             {graphData.nodes.length > 0 ? (
               <GraphViewer 
                  nodes={visibleNodes}
                  edges={visibleEdges}
                  layout={layout}
                  colorSettings={colorSettings}
                  onNodeClick={(node) => {
                    setSelectedNodeId(node?.id || null);
                    if (!node) setFocusMode(false);
                  }}
                  selectedNodeId={selectedNodeId}
                  focusMode={focusMode}
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

          {/* Floating Controls Toolbar */}
          {graphData.nodes.length > 0 && (
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
          
          {/* Minimap HUD */}
          <Minimap cy={cyInstance} isOpen={isMinimapOpen} onClose={() => setIsMinimapOpen(false)} />

          {/* Loading Overlay */}
          {isLoading && (
            <div className="absolute inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <Loader2 size={40} className="animate-spin text-blue-500" />
                <span className="text-blue-200 font-medium">Processing Graph...</span>
              </div>
            </div>
          )}

          {/* Error Toast */}
          {error && (
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-red-500/10 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg flex items-center gap-3 shadow-xl backdrop-blur-md max-w-lg z-50">
              <AlertCircle size={20} className="text-red-400" />
              <p className="text-sm">{error}</p>
              <button onClick={() => setError(null)} className="ml-auto hover:text-white"><span className="sr-only">Dismiss</span>×</button>
            </div>
          )}
        </div>

        {/* Right Inspector */}
        {selectedNode && (
          <Inspector 
            node={selectedNode}
            edges={graphData.edges}
            onClose={() => {
              setSelectedNodeId(null);
              setFocusMode(false);
            }}
            onFocusModeToggle={setFocusMode}
            focusMode={focusMode}
            onCenterNode={setSelectedNodeId}
          />
        )}

      </div>
    </div>
  );
}

export default App;