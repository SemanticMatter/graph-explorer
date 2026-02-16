import React, { useState } from 'react';
import { LayoutType, ColorSettings, CommunitySettings, FilterSettings, GraphData } from '../../types';
import { Upload, FileText, Settings, Share2, Layers, Search, Filter, Palette, Activity } from 'lucide-react';

interface SidebarProps {
  onImport: (file: File) => void;
  onLoadDemo: () => void;
  graphStats: { nodes: number; edges: number };
  layout: LayoutType;
  setLayout: (l: LayoutType) => void;
  colorSettings: ColorSettings;
  setColorSettings: (c: ColorSettings) => void;
  communitySettings: CommunitySettings;
  setCommunitySettings: (c: CommunitySettings) => void;
  onRunCommunityDetection: () => void;
  filterSettings: FilterSettings;
  setFilterSettings: (f: FilterSettings) => void;
  availableClasses: string[];
  availablePredicates: string[];
}

const Sidebar: React.FC<SidebarProps> = ({
  onImport,
  onLoadDemo,
  graphStats,
  layout,
  setLayout,
  colorSettings,
  setColorSettings,
  communitySettings,
  setCommunitySettings,
  onRunCommunityDetection,
  filterSettings,
  setFilterSettings,
  availableClasses,
  availablePredicates
}) => {
  const [activeTab, setActiveTab] = useState<'data' | 'view' | 'analyze'>('data');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onImport(e.target.files[0]);
    }
  };

  return (
    <div className="flex flex-col h-full text-sm">
      {/* Tabs */}
      <div className="flex border-b border-white/10">
        <button 
          onClick={() => setActiveTab('data')}
          className={`flex-1 p-3 flex justify-center items-center gap-2 transition-colors ${activeTab === 'data' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-slate-400 hover:text-white'}`}
        >
          <Upload size={16} /> <span className="hidden sm:inline">Data</span>
        </button>
        <button 
          onClick={() => setActiveTab('view')}
          className={`flex-1 p-3 flex justify-center items-center gap-2 transition-colors ${activeTab === 'view' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-slate-400 hover:text-white'}`}
        >
          <Layers size={16} /> <span className="hidden sm:inline">View</span>
        </button>
        <button 
          onClick={() => setActiveTab('analyze')}
          className={`flex-1 p-3 flex justify-center items-center gap-2 transition-colors ${activeTab === 'analyze' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-slate-400 hover:text-white'}`}
        >
          <Activity size={16} /> <span className="hidden sm:inline">Analyze</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        
        {/* DATA TAB */}
        {activeTab === 'data' && (
          <div className="space-y-6">
            <div className="space-y-2">
              <h3 className="text-slate-400 uppercase text-xs font-bold tracking-wider">Import</h3>
              <div className="border-2 border-dashed border-slate-700 rounded-lg p-6 flex flex-col items-center justify-center gap-3 text-slate-400 hover:border-blue-500/50 hover:bg-white/5 transition-all cursor-pointer relative">
                <input 
                  type="file" 
                  accept=".ttl" 
                  onChange={handleFileUpload} 
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <Upload size={24} />
                <span className="text-xs">Drag .ttl file or click to upload</span>
              </div>
              <button 
                onClick={onLoadDemo}
                className="w-full py-2 px-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-md flex items-center justify-center gap-2 transition-all"
              >
                <FileText size={14} /> Load Demo Graph
              </button>
            </div>

            <div className="space-y-2">
              <h3 className="text-slate-400 uppercase text-xs font-bold tracking-wider">Stats</h3>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-900/50 p-3 rounded-lg border border-white/5">
                  <div className="text-2xl font-light text-blue-400">{graphStats.nodes}</div>
                  <div className="text-xs text-slate-500">Nodes</div>
                </div>
                <div className="bg-slate-900/50 p-3 rounded-lg border border-white/5">
                  <div className="text-2xl font-light text-violet-400">{graphStats.edges}</div>
                  <div className="text-xs text-slate-500">Triples</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW TAB */}
        {activeTab === 'view' && (
          <div className="space-y-6">
             {/* Layout */}
             <div className="space-y-3">
              <h3 className="text-slate-400 uppercase text-xs font-bold tracking-wider flex items-center gap-2">
                <Layers size={14} /> Layout
              </h3>
              <select 
                value={layout} 
                onChange={(e) => setLayout(e.target.value as LayoutType)}
                className="w-full bg-slate-900 border border-slate-700 rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="force">Force Directed (Cose)</option>
                <option value="hierarchical">Hierarchical (Tree)</option>
                <option value="radial">Radial</option>
                <option value="circular">Circular</option>
                <option value="grid">Grid</option>
              </select>
              <button 
                onClick={() => setLayout(layout)} // Re-trigger effect
                className="w-full py-1.5 text-xs bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 rounded transition-colors"
              >
                Re-run Layout
              </button>
            </div>

            {/* Coloring */}
            <div className="space-y-3">
              <h3 className="text-slate-400 uppercase text-xs font-bold tracking-wider flex items-center gap-2">
                <Palette size={14} /> Coloring
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {['mono', 'class', 'community', 'degree'].map((m) => (
                  <button
                    key={m}
                    onClick={() => setColorSettings({ ...colorSettings, mode: m as any })}
                    className={`p-2 rounded text-xs capitalize border ${
                      colorSettings.mode === m 
                      ? 'bg-blue-600 border-blue-500 text-white' 
                      : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
              {colorSettings.mode === 'mono' && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Base Color:</span>
                  <input 
                    type="color" 
                    value={colorSettings.baseColor}
                    onChange={(e) => setColorSettings({...colorSettings, baseColor: e.target.value})}
                    className="bg-transparent border-none h-6 w-6 p-0 cursor-pointer"
                  />
                </div>
              )}
            </div>

            {/* Filters */}
            <div className="space-y-3">
              <h3 className="text-slate-400 uppercase text-xs font-bold tracking-wider flex items-center gap-2">
                <Filter size={14} /> Filters
              </h3>
              
              <div className="space-y-1">
                <label className="text-xs text-slate-500">Search</label>
                <div className="relative">
                  <input 
                    type="text"
                    value={filterSettings.searchTerm}
                    onChange={(e) => setFilterSettings({...filterSettings, searchTerm: e.target.value})}
                    placeholder="Search node..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-md py-1.5 pl-8 pr-2 text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                  <Search size={14} className="absolute left-2.5 top-2 text-slate-500" />
                </div>
              </div>

              <div className="space-y-1">
                 <label className="text-xs text-slate-500 block mb-1">Predicates</label>
                 <div className="max-h-32 overflow-y-auto border border-slate-700 rounded bg-slate-900 p-2 space-y-1">
                   {availablePredicates.map(pred => (
                     <label key={pred} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-white/5 p-1 rounded">
                       <input 
                         type="checkbox" 
                         checked={filterSettings.selectedPredicates.length === 0 || filterSettings.selectedPredicates.includes(pred)}
                         onChange={(e) => {
                           const checked = e.target.checked;
                           let newPreds = [...filterSettings.selectedPredicates];
                           if (newPreds.length === 0) {
                              // If currently "Show All" (empty), and we uncheck one, we must populate with all others
                              // Actually easier: if list is empty, it means all.
                              if (!checked) {
                                newPreds = availablePredicates.filter(p => p !== pred);
                              } else {
                                // If list was empty and we check one... logic is tricky.
                                // Standard logic: Empty = All. Non-Empty = specific.
                                newPreds = [pred];
                              }
                           } else {
                             if (checked) newPreds.push(pred);
                             else newPreds = newPreds.filter(p => p !== pred);
                           }
                           setFilterSettings({...filterSettings, selectedPredicates: newPreds});
                         }}
                         className="rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-0"
                       />
                       <span className="truncate" title={pred}>{pred}</span>
                     </label>
                   ))}
                 </div>
              </div>
            </div>
          </div>
        )}

        {/* ANALYZE TAB */}
        {activeTab === 'analyze' && (
           <div className="space-y-6">
             <div className="space-y-3">
              <h3 className="text-slate-400 uppercase text-xs font-bold tracking-wider flex items-center gap-2">
                <Share2 size={14} /> Community Detection
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Partition the graph into communities based on structural density.
              </p>
              
              <div className="flex flex-col gap-2">
                <label className="text-xs text-slate-400">Algorithm</label>
                <select 
                  value={communitySettings.algorithm}
                  onChange={(e) => setCommunitySettings({...communitySettings, algorithm: e.target.value as any})}
                  className="bg-slate-900 border border-slate-700 rounded p-2 text-sm"
                >
                  <option value="lpa">Label Propagation (Fast)</option>
                  <option value="louvain">Louvain (Modular)</option>
                </select>
              </div>

              <button 
                onClick={onRunCommunityDetection}
                className="w-full py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-md text-xs font-medium transition-all shadow-lg shadow-violet-900/20"
              >
                Run Detection
              </button>
             </div>
           </div>
        )}

      </div>
    </div>
  );
};

export default Sidebar;
