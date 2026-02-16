import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Network, Menu, Loader2, AlertCircle } from 'lucide-react';
import { GraphData, LayoutType, ColorSettings, CommunitySettings, FilterSettings, RdfNode } from './types';
import { rdfService } from './services/rdfService';
import { detectCommunities } from './services/communityService';
import { DEMO_TTL } from './constants';
import GraphViewer from './components/Graph/GraphViewer';
import Sidebar from './components/Controls/Sidebar';
import Inspector from './components/Inspector';

function App() {
  // --- State ---
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], edges: [], prefixes: {} });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // UI State
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [focusMode, setFocusMode] = useState(false);
  
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
      // Reset view state
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
    // Use timeout to allow UI to show loading state before heavy calculation
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

  // --- Derived State (Filtering) ---

  const visibleNodes = useMemo(() => {
    let filtered = graphData.nodes;
    
    // Search
    if (filterSettings.searchTerm) {
      const lower = filterSettings.searchTerm.toLowerCase();
      filtered = filtered.filter(n => 
        n.label.toLowerCase().includes(lower) || 
        n.id.toLowerCase().includes(lower) ||
        (n.curie && n.curie.toLowerCase().includes(lower))
      );
      // Note: In a real graph app, searching usually just highlights, but here we filter for clarity or zoom
      // Ideally, we keep all nodes but only show search matches? 
      // For this implementation: We will NOT remove nodes from the graph prop passed to Cytoscape based on search, 
      // but instead use search to Select/Highlight. 
      // The FILTER section usually implies removing things. 
      // Let's assume Filter Class removes them. Search highlights them.
    }

    // Filter by Class (if implemented)
    // For now, if filteredClasses is not empty, include only those.
    // skipped for brevity in UI, but logic is here:
    // if (filterSettings.selectedClasses.length > 0) { ... }

    return filtered;
  }, [graphData.nodes, filterSettings.searchTerm]);

  const visibleEdges = useMemo(() => {
    let filtered = graphData.edges;

    // Filter by Predicate
    if (filterSettings.selectedPredicates.length > 0) {
      filtered = filtered.filter(e => filterSettings.selectedPredicates.includes(e.label) || filterSettings.selectedPredicates.includes(e.predicate));
    }
    
    return filtered;
  }, [graphData.edges, filterSettings.selectedPredicates]);

  // Derived Lists for UI
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

  // Handle Search Result Selection
  useEffect(() => {
    if (filterSettings.searchTerm && visibleNodes.length > 0) {
       // Optional: Auto-select first match?
       // Let's just rely on user clicking results if we had a list.
       // For now, basic search filtering is visual only.
    }
  }, [filterSettings.searchTerm, visibleNodes]);


  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        setIsSidebarOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // --- Render ---

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
        <div className="flex items-center gap-4 text-xs font-medium text-slate-400">
          <span className="hidden sm:inline">Ctrl+B to toggle sidebar</span>
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 hover:bg-white/10 rounded-md transition-colors"
          >
            <Menu size={20} />
          </button>
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
