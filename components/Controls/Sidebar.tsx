import React, { useState } from 'react';
import { ApiShaclReportResponse, ColorSettings, CommunitySettings, FilterSettings, LayoutType, ReasoningProfile, ReasoningResultFormat, RdfMimeType } from '../../types';
import { Upload, FileText, Share2, Layers, Search, Filter, Palette, Activity, Download, Trash2, RefreshCcw, Cloud } from 'lucide-react';
import { PREDICATE_NONE_SENTINEL } from '../../constants';

interface SidebarProps {
  onImport: (file: File) => void;
  onExportGraph: (format: RdfMimeType) => void;
  onLoadDemo: () => void;
  graphStats: { nodes: number; edges: number };
  layout: LayoutType;
  setLayout: (l: LayoutType) => void;
  colorSettings: ColorSettings;
  setColorSettings: (c: ColorSettings) => void;
  showNodeLabels: boolean;
  setShowNodeLabels: (value: boolean) => void;
  showEdgeLabels: boolean;
  setShowEdgeLabels: (value: boolean) => void;
  communitySettings: CommunitySettings;
  setCommunitySettings: (c: CommunitySettings) => void;
  onRunCommunityDetection: () => void;
  filterSettings: FilterSettings;
  setFilterSettings: (f: FilterSettings) => void;
  availableClasses: string[];
  availablePredicates: string[];

  apiBaseUrl: string;
  onApiBaseUrlChange: (value: string) => void;
  onPersistApiBaseUrl: () => void;
  onTestApiHealth: () => void;
  apiHealthStatus: string;

  apiGraphId: string | null;
  apiGraphNamedIri: string | null;
  apiGraphTriples: number | null;
  onDeleteGraph: () => void;

  reasoningProfile: ReasoningProfile;
  setReasoningProfile: (value: ReasoningProfile) => void;
  reasoningResultFormat: ReasoningResultFormat;
  setReasoningResultFormat: (value: ReasoningResultFormat) => void;
  reasoningJobId: string | null;
  reasoningJobStatus: string;
  onRunReasoningWorkflow: () => void;
  onMergeInferred: () => void;
  onExportInferredJsonLd: () => void;
  inferredTriplesCount: number;
  assertedTriplesCount: number;

  shapesId: string | null;
  onUploadShapes: (file: File) => void;
  shaclJobId: string | null;
  shaclJobStatus: string;
  onRunShaclWorkflow: () => void;
  onDownloadShaclReport: () => void;
  onDeleteShapes: () => void;
  shaclReport: ApiShaclReportResponse | null;
  onOpenShaclReport: () => void;

  analyzeBusy: boolean;
  analyzeMessage: string;
}

const Sidebar: React.FC<SidebarProps> = ({
  onImport,
  onExportGraph,
  onLoadDemo,
  graphStats,
  layout,
  setLayout,
  colorSettings,
  setColorSettings,
  showNodeLabels,
  setShowNodeLabels,
  showEdgeLabels,
  setShowEdgeLabels,
  communitySettings,
  setCommunitySettings,
  onRunCommunityDetection,
  filterSettings,
  setFilterSettings,
  availableClasses,
  availablePredicates,

  apiBaseUrl,
  onApiBaseUrlChange,
  onPersistApiBaseUrl,
  onTestApiHealth,
  apiHealthStatus,

  apiGraphId,
  apiGraphNamedIri,
  apiGraphTriples,
  onDeleteGraph,

  reasoningProfile,
  setReasoningProfile,
  reasoningResultFormat,
  setReasoningResultFormat,
  reasoningJobId,
  reasoningJobStatus,
  onRunReasoningWorkflow,
  onMergeInferred,
  onExportInferredJsonLd,
  inferredTriplesCount,
  assertedTriplesCount,

  shapesId,
  onUploadShapes,
  shaclJobId,
  shaclJobStatus,
  onRunShaclWorkflow,
  onDownloadShaclReport,
  onDeleteShapes,
  shaclReport,
  onOpenShaclReport,

  analyzeBusy,
  analyzeMessage
}) => {
  const [activeTab, setActiveTab] = useState<'data' | 'view' | 'analyze'>('data');

  const nonePredicateMode = filterSettings.selectedPredicates.includes(PREDICATE_NONE_SENTINEL);
  const activePredicateSet = new Set(
    nonePredicateMode
      ? []
      : filterSettings.selectedPredicates.length === 0
        ? availablePredicates
        : filterSettings.selectedPredicates
  );

  return (
    <div className="flex flex-col h-full text-sm">
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
        {activeTab === 'data' && (
          <div className="space-y-6">
            <div className="space-y-2">
              <h3 className="text-slate-400 uppercase text-xs font-bold tracking-wider">Import</h3>
              <div className="border-2 border-dashed border-slate-700 rounded-lg p-6 flex flex-col items-center justify-center gap-3 text-slate-400 hover:border-blue-500/50 hover:bg-white/5 transition-all cursor-pointer relative">
                <input
                  type="file"
                  accept=".ttl,.jsonld,.json,application/ld+json,text/turtle"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onImport(file);
                  }}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <Upload size={24} />
                <span className="text-xs">Import .ttl/.jsonld/.json graph</span>
              </div>
              <button
                onClick={onLoadDemo}
                className="w-full py-2 px-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-md flex items-center justify-center gap-2 transition-all"
              >
                <FileText size={14} /> Load Demo Graph
              </button>
            </div>

            <div className="space-y-2">
              <h3 className="text-slate-400 uppercase text-xs font-bold tracking-wider">Export</h3>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => onExportGraph('text/turtle')}
                  className="py-2 px-3 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-md text-xs"
                >
                  Export Turtle
                </button>
                <button
                  onClick={() => onExportGraph('application/ld+json')}
                  className="py-2 px-3 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-md text-xs"
                >
                  Export JSON-LD
                </button>
              </div>
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

        {activeTab === 'view' && (
          <div className="space-y-6">
            <div className="space-y-3">
              <h3 className="text-slate-400 uppercase text-xs font-bold tracking-wider flex items-center gap-2"><Layers size={14} /> Layout</h3>
              <select value={layout} onChange={(e) => setLayout(e.target.value as LayoutType)} className="w-full bg-slate-900 border border-slate-700 rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                <option value="force">Force Directed (Cose)</option>
                <option value="hierarchical">Hierarchical (Tree)</option>
                <option value="radial">Radial</option>
                <option value="circular">Circular</option>
                <option value="grid">Grid</option>
              </select>
              <button onClick={() => setLayout(layout)} className="w-full py-1.5 text-xs bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 rounded transition-colors">Re-run Layout</button>
            </div>

            <div className="space-y-3">
              <h3 className="text-slate-400 uppercase text-xs font-bold tracking-wider flex items-center gap-2"><Palette size={14} /> Coloring</h3>
              <div className="grid grid-cols-2 gap-2">
                {['mono', 'class', 'community', 'degree'].map((m) => (
                  <button key={m} onClick={() => setColorSettings({ ...colorSettings, mode: m as any })} className={`p-2 rounded text-xs capitalize border ${colorSettings.mode === m ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'}`}>
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-slate-400 uppercase text-xs font-bold tracking-wider">Labels</h3>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setShowNodeLabels(!showNodeLabels)}
                  className={`py-2 px-3 rounded text-xs border transition-colors ${
                    showNodeLabels
                      ? 'bg-emerald-700/30 border-emerald-500/50 text-emerald-200'
                      : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  {showNodeLabels ? 'Node Labels: On' : 'Node Labels: Off'}
                </button>
                <button
                  onClick={() => setShowEdgeLabels(!showEdgeLabels)}
                  className={`py-2 px-3 rounded text-xs border transition-colors ${
                    showEdgeLabels
                      ? 'bg-emerald-700/30 border-emerald-500/50 text-emerald-200'
                      : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  {showEdgeLabels ? 'Edge Labels: On' : 'Edge Labels: Off'}
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-slate-400 uppercase text-xs font-bold tracking-wider flex items-center gap-2"><Filter size={14} /> Filters</h3>
              <div className="space-y-1">
                <label className="text-xs text-slate-500">Search</label>
                <div className="relative">
                  <input
                    type="text"
                    value={filterSettings.searchTerm}
                    onChange={(e) => setFilterSettings({ ...filterSettings, searchTerm: e.target.value })}
                    placeholder="Search node..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-md py-1.5 pl-8 pr-2 text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                  <Search size={14} className="absolute left-2.5 top-2 text-slate-500" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-500 block mb-1">Predicates</label>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <button onClick={() => setFilterSettings({ ...filterSettings, selectedPredicates: [] })} className="py-1 text-xs rounded border border-slate-600 bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors">Enable All</button>
                  <button onClick={() => setFilterSettings({ ...filterSettings, selectedPredicates: [PREDICATE_NONE_SENTINEL] })} className="py-1 text-xs rounded border border-slate-600 bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors">Disable All</button>
                </div>
                <div className="max-h-32 overflow-y-auto border border-slate-700 rounded bg-slate-900 p-2 space-y-1">
                  {availablePredicates.map((pred) => (
                    <label key={pred} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-white/5 p-1 rounded">
                      <input
                        type="checkbox"
                        checked={activePredicateSet.has(pred)}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          const next = new Set(activePredicateSet);
                          if (checked) next.add(pred); else next.delete(pred);

                          if (next.size === 0) {
                            setFilterSettings({ ...filterSettings, selectedPredicates: [PREDICATE_NONE_SENTINEL] });
                            return;
                          }
                          if (next.size === availablePredicates.length) {
                            setFilterSettings({ ...filterSettings, selectedPredicates: [] });
                            return;
                          }
                          setFilterSettings({ ...filterSettings, selectedPredicates: Array.from(next) });
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

        {activeTab === 'analyze' && (
          <div className="space-y-6">
            <div className="space-y-3">
              <h3 className="text-slate-400 uppercase text-xs font-bold tracking-wider flex items-center gap-2"><Cloud size={14} /> API Connection</h3>
              <input value={apiBaseUrl} onChange={(e) => onApiBaseUrlChange(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-md p-2 text-sm" placeholder="http://localhost:8080" />
              <div className="grid grid-cols-2 gap-2">
                <button onClick={onPersistApiBaseUrl} className="py-1.5 text-xs rounded border border-slate-600 bg-slate-800 hover:bg-slate-700">Save URL</button>
                <button onClick={onTestApiHealth} className="py-1.5 text-xs rounded border border-slate-600 bg-slate-800 hover:bg-slate-700">Test /health</button>
              </div>
              <div className="text-xs text-slate-400">{apiHealthStatus}</div>
            </div>

            <div className="space-y-3 border border-white/10 rounded-lg p-3">
              <h3 className="text-slate-400 uppercase text-xs font-bold tracking-wider flex items-center gap-2"><Upload size={14} /> Current Graph Ref</h3>
              <p className="text-xs text-slate-500">
                Reasoning and SHACL automatically upload the current graph snapshot before running.
              </p>
              <button onClick={onDeleteGraph} disabled={!apiGraphId} className="w-full py-1.5 text-xs rounded border border-red-700/60 bg-red-900/20 hover:bg-red-900/40 disabled:opacity-40 flex items-center justify-center gap-1"><Trash2 size={12} /> Cleanup Remote Graph</button>
              <div className="text-xs text-slate-400">
                graphId: {apiGraphId || 'n/a'}<br />
                namedGraphIri: {apiGraphNamedIri || 'n/a'}<br />
                triples: {apiGraphTriples ?? 'n/a'}
              </div>
            </div>

            <div className="space-y-3 border border-white/10 rounded-lg p-3">
              <h3 className="text-slate-400 uppercase text-xs font-bold tracking-wider flex items-center gap-2"><Share2 size={14} /> Reasoning</h3>
              <div className="grid grid-cols-2 gap-2">
                <select value={reasoningProfile} onChange={(e) => setReasoningProfile(e.target.value as ReasoningProfile)} className="bg-slate-900 border border-slate-700 rounded p-2 text-xs">
                  <option value="disabled">disabled</option>
                  <option value="rdfs">rdfs</option>
                  <option value="owlrl">owlrl</option>
                </select>
                <select value={reasoningResultFormat} onChange={(e) => setReasoningResultFormat(e.target.value as ReasoningResultFormat)} className="bg-slate-900 border border-slate-700 rounded p-2 text-xs">
                  <option value="application/n-triples">application/n-triples</option>
                  <option value="text/turtle">text/turtle</option>
                  <option value="application/ld+json">application/ld+json</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={onRunReasoningWorkflow}
                  className="col-span-2 py-2 text-xs rounded border border-blue-700/60 bg-blue-900/20 hover:bg-blue-900/40"
                >
                  Run Reasoning (Auto Poll)
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button onClick={onMergeInferred} className="py-1.5 text-xs rounded border border-emerald-700/60 bg-emerald-900/20 hover:bg-emerald-900/40">Merge Inferred</button>
                <button onClick={onExportInferredJsonLd} className="py-1.5 text-xs rounded border border-slate-600 bg-slate-800 hover:bg-slate-700 flex items-center justify-center gap-1"><Download size={12} /> Export Inferred JSON-LD</button>
              </div>

              <div className="text-xs text-slate-400">
                reasoningJob: {reasoningJobId || 'n/a'}<br />
                status: {reasoningJobStatus}<br />
                asserted triples: {assertedTriplesCount}<br />
                inferred triples: {inferredTriplesCount}
              </div>
            </div>

            <div className="space-y-3 border border-white/10 rounded-lg p-3">
              <h3 className="text-slate-400 uppercase text-xs font-bold tracking-wider flex items-center gap-2"><Activity size={14} /> SHACL</h3>
              <label className="block text-xs text-slate-400">Shapes file (.ttl/.jsonld)</label>
              <input
                type="file"
                accept=".ttl,.jsonld,.json"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onUploadShapes(file);
                }}
                className="w-full text-xs"
              />

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={onRunShaclWorkflow}
                  className="col-span-2 py-2 text-xs rounded border border-blue-700/60 bg-blue-900/20 hover:bg-blue-900/40"
                >
                  Run SHACL Validation (Auto Poll)
                </button>
                <button onClick={onDownloadShaclReport} className="col-span-2 py-1.5 text-xs rounded border border-slate-600 bg-slate-800 hover:bg-slate-700">Download Report</button>
              </div>

              <button onClick={onDeleteShapes} disabled={!shapesId} className="w-full py-1.5 text-xs rounded border border-red-700/60 bg-red-900/20 hover:bg-red-900/40 disabled:opacity-40 flex items-center justify-center gap-1"><Trash2 size={12} /> DELETE shapes</button>

              <div className="text-xs text-slate-400">
                shapesId: {shapesId || 'n/a'}<br />
                shaclJob: {shaclJobId || 'n/a'}<br />
                status: {shaclJobStatus}
              </div>

              {shaclReport && (
                <div className="text-xs bg-slate-900/70 border border-slate-700 rounded p-2 space-y-2">
                  <div>Conforms: <span className={shaclReport.report.conforms ? 'text-emerald-400' : 'text-red-400'}>{String(shaclReport.report.conforms)}</span></div>
                  <div>Violations: {shaclReport.report.violations?.length || 0}</div>
                  <button
                    onClick={onOpenShaclReport}
                    className="w-full py-1.5 text-xs rounded border border-blue-700/60 bg-blue-900/20 hover:bg-blue-900/40"
                  >
                    Open SHACL Report Pane
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <h3 className="text-slate-400 uppercase text-xs font-bold tracking-wider flex items-center gap-2"><RefreshCcw size={14} /> Local Analysis</h3>
              <p className="text-xs text-slate-500 leading-relaxed">Community detection remains available locally.</p>
              <div className="flex flex-col gap-2">
                <label className="text-xs text-slate-400">Algorithm</label>
                <select value={communitySettings.algorithm} onChange={(e) => setCommunitySettings({ ...communitySettings, algorithm: e.target.value as any })} className="bg-slate-900 border border-slate-700 rounded p-2 text-sm">
                  <option value="lpa">Label Propagation (Fast)</option>
                  <option value="louvain">Louvain (Modular)</option>
                </select>
              </div>
              <button onClick={onRunCommunityDetection} className="w-full py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-md text-xs font-medium transition-all shadow-lg shadow-violet-900/20">Run Detection</button>
            </div>

            <div className="text-xs text-slate-400 border border-white/10 rounded p-2">
              {analyzeBusy ? 'Working...' : 'Idle'}
              <br />
              {analyzeMessage}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
