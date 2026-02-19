import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Network, Menu, Loader2, AlertCircle, RotateCcw, ZoomIn, ZoomOut, Map as MapIcon, Layers } from 'lucide-react';
import { Core } from 'cytoscape';
import {
  ApiShaclReportResponse,
  GraphData,
  LayoutType,
  ColorSettings,
  CommunitySettings,
  FilterSettings,
  RdfNode,
  RdfMimeType,
  ReasoningProfile,
  ReasoningResultFormat,
  ShaclViolation
} from './types';
import { rdfService } from './services/rdfService';
import { detectCommunities } from './services/communityService';
import { DEMO_TTL, DEFAULT_API_BASE_URL, STORAGE_API_BASE_URL_KEY } from './constants';
import { LARGE_GRAPH_MAX_ACTIVE_PREDICATES, LARGE_GRAPH_TRIPLE_THRESHOLD } from './constants';
import {
  buildExpandedGraph,
  buildFilteredGraph,
  buildGraphIndex,
  deriveInitialPredicatePolicy,
  enforcePredicateVisibilityPolicy,
  getNeighborCount as computeNeighborCount,
  mergeFilteredWithExpanded
} from './services/graphViewService';
import { applyNodeClickSelection, resolveSelectedNode } from './services/selectionService';
import { ApiServiceError, kgApiService } from './services/kgApiService';
import GraphViewer from './components/Graph/GraphViewer';
import Sidebar from './components/Controls/Sidebar';
import Inspector from './components/Inspector';
import Minimap from './components/Graph/Minimap';
import ShaclReportPanel from './components/Report/ShaclReportPanel';

const EMPTY_GRAPH: GraphData = { nodes: [], edges: [], prefixes: {} };
const EXPAND_NEIGHBOR_WARN_THRESHOLD = 200;
const JOB_POLL_INTERVAL_MS = 1000;
const JOB_MAX_POLLS = 180;

function downloadFile(fileName: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

function toErrorMessage(err: unknown): string {
  if (err instanceof ApiServiceError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Unknown error occurred';
}

function inferMimeTypeFromResultFormat(format: ReasoningResultFormat): RdfMimeType {
  if (format === 'application/ld+json') return 'application/ld+json';
  if (format === 'application/n-triples') return 'application/n-triples';
  return 'text/turtle';
}

function App() {
  const [fullGraph, setFullGraph] = useState<GraphData>(EMPTY_GRAPH);
  const [sourceFormat, setSourceFormat] = useState<RdfMimeType>('text/turtle');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<RdfNode | null>(null);
  const [focusMode, setFocusMode] = useState(false);
  const [isMinimapOpen, setIsMinimapOpen] = useState(true);

  const [cyInstance, setCyInstance] = useState<Core | null>(null);

  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [expansionRevision, setExpansionRevision] = useState(0);
  const [lastExpandedNodeId, setLastExpandedNodeId] = useState<string | null>(null);
  const [graphVersion, setGraphVersion] = useState(0);
  const [layoutRunNonce, setLayoutRunNonce] = useState(0);

  const [layout, setLayout] = useState<LayoutType>('force');
  const [colorSettings, setColorSettings] = useState<ColorSettings>({ mode: 'class', baseColor: '#3b82f6' });
  const [showNodeLabels, setShowNodeLabels] = useState(true);
  const [showEdgeLabels, setShowEdgeLabels] = useState(true);
  const [communitySettings, setCommunitySettings] = useState<CommunitySettings>({ enabled: false, algorithm: 'lpa', resolution: 1.0 });
  const [filterSettings, setFilterSettings] = useState<FilterSettings>({
    showLiterals: true,
    selectedClasses: [],
    selectedPredicates: [],
    searchTerm: ''
  });

  // API + Analyze integration
  const [apiBaseUrl, setApiBaseUrl] = useState<string>(() => {
    const stored = localStorage.getItem(STORAGE_API_BASE_URL_KEY);
    if (!stored) return DEFAULT_API_BASE_URL;
    if (stored === 'http://localhost:8080') return DEFAULT_API_BASE_URL;
    return stored;
  });
  const [apiHealthStatus, setApiHealthStatus] = useState('Not tested');
  const [analyzeBusy, setAnalyzeBusy] = useState(false);
  const [analyzeMessage, setAnalyzeMessage] = useState('Idle');

  const [apiGraphId, setApiGraphId] = useState<string | null>(null);
  const [apiGraphNamedIri, setApiGraphNamedIri] = useState<string | null>(null);
  const [apiGraphTriples, setApiGraphTriples] = useState<number | null>(null);
  const [apiGraphVersion, setApiGraphVersion] = useState<number>(-1);

  const [reasoningProfile, setReasoningProfile] = useState<ReasoningProfile>('rdfs');
  const [reasoningResultFormat, setReasoningResultFormat] = useState<ReasoningResultFormat>('application/n-triples');
  const [reasoningJobId, setReasoningJobId] = useState<string | null>(null);
  const [reasoningJobStatus, setReasoningJobStatus] = useState('n/a');
  const [inferredGraph, setInferredGraph] = useState<GraphData | null>(null);

  const [shapesId, setShapesId] = useState<string | null>(null);
  const [shaclJobId, setShaclJobId] = useState<string | null>(null);
  const [shaclJobStatus, setShaclJobStatus] = useState('n/a');
  const [shaclReport, setShaclReport] = useState<ApiShaclReportResponse | null>(null);
  const [invalidNodeIds, setInvalidNodeIds] = useState<Set<string>>(new Set());
  const [isShaclReportPaneOpen, setIsShaclReportPaneOpen] = useState(false);
  const [shaclFocusNodeId, setShaclFocusNodeId] = useState<string | null>(null);
  const [shaclFocusPredicate, setShaclFocusPredicate] = useState<string | null>(null);

  const graphIndex = useMemo(() => buildGraphIndex(fullGraph), [fullGraph]);

  const resetGraphInteractions = useCallback(() => {
    setExpandedNodes(new Set());
    setSelectedNodeId(null);
    setSelectedNode(null);
    setFocusMode(false);
    setLastExpandedNodeId(null);
    setExpansionRevision((v) => v + 1);
    setInvalidNodeIds(new Set());
    setShaclReport(null);
    setIsShaclReportPaneOpen(false);
    setShaclFocusNodeId(null);
    setShaclFocusPredicate(null);
  }, []);

  const runAnalyzeAction = useCallback(async (label: string, fn: () => Promise<void>) => {
    setAnalyzeBusy(true);
    setAnalyzeMessage(`${label}...`);
    try {
      await fn();
      setAnalyzeMessage(`${label} completed`);
    } catch (err) {
      const msg = toErrorMessage(err);
      setAnalyzeMessage(`${label} failed: ${msg}`);
      setError(msg);
    } finally {
      setAnalyzeBusy(false);
    }
  }, []);

  const ensureCurrentGraphUploaded = useCallback(async () => {
    if (fullGraph.edges.length === 0) throw new Error('Graph is empty. Import data first.');
    if (apiGraphId && apiGraphVersion === graphVersion) return apiGraphId;

    const format: RdfMimeType = sourceFormat === 'application/ld+json' ? 'application/ld+json' : 'text/turtle';
    const payload = await rdfService.serializeGraph(fullGraph, format, true);
    const response = await kgApiService.createGraph(apiBaseUrl, payload, format);
    setApiGraphId(response.graphId);
    setApiGraphNamedIri(response.namedGraphIri);
    setApiGraphTriples(response.stats?.triples ?? null);
    setApiGraphVersion(graphVersion);
    return response.graphId;
  }, [apiBaseUrl, apiGraphId, apiGraphVersion, fullGraph, graphVersion, sourceFormat]);

  const handleImport = async (file: File) => {
    setIsLoading(true);
    setError(null);
    setInfoMessage(null);
    try {
      const { data, format } = await rdfService.parseFile(file);
      const loadPolicy = deriveInitialPredicatePolicy(data, {
        tripleThreshold: LARGE_GRAPH_TRIPLE_THRESHOLD,
        maxActivePredicates: LARGE_GRAPH_MAX_ACTIVE_PREDICATES
      });
      setFullGraph(data);
      setSourceFormat(format);
      setFilterSettings((prev) => ({
        ...prev,
        selectedClasses: [],
        searchTerm: '',
        selectedPredicates: loadPolicy.selectedPredicates
      }));
      if (loadPolicy.isLimited) {
        setShowNodeLabels(false);
        setShowEdgeLabels(false);
      } else {
        setShowNodeLabels(true);
        setShowEdgeLabels(true);
      }
      if (loadPolicy.summary) {
        setInfoMessage(`${loadPolicy.summary} Labels were disabled automatically for faster rendering.`);
      }
      setCommunitySettings((s) => ({ ...s, enabled: false }));
      setInferredGraph(null);
      resetGraphInteractions();
      setGraphVersion((v) => v + 1);
    } catch (err: any) {
      setError(`Failed to parse file: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadDemo = async () => {
    setIsLoading(true);
    setError(null);
    setInfoMessage(null);
    try {
      const data = await rdfService.parseRdf(DEMO_TTL, 'text/turtle');
      const loadPolicy = deriveInitialPredicatePolicy(data, {
        tripleThreshold: LARGE_GRAPH_TRIPLE_THRESHOLD,
        maxActivePredicates: LARGE_GRAPH_MAX_ACTIVE_PREDICATES
      });
      setFullGraph(data);
      setSourceFormat('text/turtle');
      setFilterSettings((prev) => ({
        ...prev,
        selectedClasses: [],
        searchTerm: '',
        selectedPredicates: loadPolicy.selectedPredicates
      }));
      if (loadPolicy.isLimited) {
        setShowNodeLabels(false);
        setShowEdgeLabels(false);
      } else {
        setShowNodeLabels(true);
        setShowEdgeLabels(true);
      }
      if (loadPolicy.summary) {
        setInfoMessage(`${loadPolicy.summary} Labels were disabled automatically for faster rendering.`);
      }
      setCommunitySettings((s) => ({ ...s, enabled: false }));
      setInferredGraph(null);
      resetGraphInteractions();
      setGraphVersion((v) => v + 1);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportGraph = useCallback(async (format: RdfMimeType) => {
    try {
      const serialized = await rdfService.serializeGraph(fullGraph, format, true);
      const ext = format === 'application/ld+json' ? 'jsonld' : format === 'application/n-triples' ? 'nt' : 'ttl';
      downloadFile(`graph-export.${ext}`, serialized, format);
    } catch (err) {
      setError(toErrorMessage(err));
    }
  }, [fullGraph]);

  const handleExportInferredJsonLd = useCallback(async () => {
    if (!inferredGraph) {
      setError('No inferred graph available to export.');
      return;
    }
    try {
      const serialized = await rdfService.serializeGraph(inferredGraph, 'application/ld+json', true);
      downloadFile('inferred-graph.jsonld', serialized, 'application/ld+json');
    } catch (err) {
      setError(toErrorMessage(err));
    }
  }, [inferredGraph]);

  const filteredGraph = useMemo<GraphData>(
    () => (fullGraph.nodes.length === 0 ? EMPTY_GRAPH : buildFilteredGraph(fullGraph, filterSettings)),
    [fullGraph, filterSettings]
  );

  const expandedGraph = useMemo(() => buildExpandedGraph(graphIndex, expandedNodes), [expandedNodes, graphIndex]);

  const mergedGraph = useMemo(
    () => mergeFilteredWithExpanded(filteredGraph, expandedGraph, expandedNodes),
    [filteredGraph, expandedGraph, expandedNodes]
  );

  const renderGraph = useMemo(() => {
    const activePredicates = new Set(filterSettings.selectedPredicates);
    const policyGraph = enforcePredicateVisibilityPolicy(mergedGraph, activePredicates, selectedNodeId);
    return {
      ...policyGraph,
      nodes: policyGraph.nodes.map((node) => ({
        ...node,
        isInvalid: invalidNodeIds.has(node.id)
      }))
    };
  }, [mergedGraph, filterSettings.selectedPredicates, selectedNodeId, invalidNodeIds]);

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

  const getNeighborCount = useCallback((nodeId: string) => computeNeighborCount(graphIndex, nodeId), [graphIndex.edgesByNode]);

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
        const shouldExpand = window.confirm(`This node has ${neighborCount} direct neighbors. Expanding may impact performance. Continue?`);
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
      const communities = detectCommunities(renderGraph.nodes, renderGraph.edges);
      const newNodes = fullGraph.nodes.map((n) => ({ ...n, community: communities.get(n.id) }));
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
      cyInstance.zoom({ level: cyInstance.zoom() * 1.2, renderedPosition: { x: cyInstance.width() / 2, y: cyInstance.height() / 2 } });
    }
  };

  const handleZoomOut = () => {
    if (cyInstance) {
      cyInstance.zoom({ level: cyInstance.zoom() * 0.8, renderedPosition: { x: cyInstance.width() / 2, y: cyInstance.height() / 2 } });
    }
  };

  const handleLayoutChange = useCallback((nextLayout: LayoutType) => {
    setLayout((prev) => {
      if (prev === nextLayout) setLayoutRunNonce((n) => n + 1);
      return nextLayout;
    });
  }, []);

  // API handlers
  const handlePersistApiBaseUrl = useCallback(() => {
    localStorage.setItem(STORAGE_API_BASE_URL_KEY, apiBaseUrl);
    setAnalyzeMessage('API base URL saved.');
  }, [apiBaseUrl]);

  const handleTestApiHealth = useCallback(() => runAnalyzeAction('Health check', async () => {
    const health = await kgApiService.health(apiBaseUrl);
    setApiHealthStatus(`${health.status} (reachable=${String(health.agraph.reachable)}, repo=${health.agraph.repository})`);
  }), [apiBaseUrl, runAnalyzeAction]);

  const handleFetchGraphStats = useCallback(() => runAnalyzeAction('Fetch graph stats', async () => {
    const graphId = await ensureCurrentGraphUploaded();
    const stats = await kgApiService.graphStats(apiBaseUrl, graphId);
    setApiGraphNamedIri(stats.namedGraphIri);
    setApiGraphTriples(stats.triples);
  }), [apiBaseUrl, ensureCurrentGraphUploaded, runAnalyzeAction]);

  const handleDeleteGraph = useCallback(() => runAnalyzeAction('Delete graph', async () => {
    if (!apiGraphId) throw new Error('No graph_id available.');
    await kgApiService.deleteGraph(apiBaseUrl, apiGraphId);
    setApiGraphId(null);
    setApiGraphNamedIri(null);
    setApiGraphTriples(null);
    setApiGraphVersion(-1);
    setReasoningJobId(null);
    setReasoningJobStatus('n/a');
  }), [apiBaseUrl, apiGraphId, runAnalyzeAction]);

  const handleCreateReasoningJob = useCallback(() => runAnalyzeAction('Create reasoning job', async () => {
    const graphId = await ensureCurrentGraphUploaded();
    const response = await kgApiService.createReasoningJob(apiBaseUrl, {
      graphId,
      profile: reasoningProfile,
      options: {},
      resultFormat: reasoningResultFormat
    });

    setReasoningJobId(response.jobId);
    setReasoningJobStatus('queued');

    let completed = false;
    for (let i = 0; i < JOB_MAX_POLLS; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, JOB_POLL_INTERVAL_MS));
      const status = await kgApiService.reasoningJob(apiBaseUrl, response.jobId);
      setReasoningJobStatus(status.status);
      setAnalyzeMessage(`Reasoning job is ${status.status}...`);

      if (status.status === 'failed') {
        throw new Error(status.error?.message || 'Reasoning job failed.');
      }
      if (status.status === 'succeeded') {
        completed = true;
        break;
      }
    }

    if (!completed) throw new Error('Reasoning job timed out.');

    const resultText = await kgApiService.reasoningResult(apiBaseUrl, response.jobId, reasoningResultFormat);
    const parsed = await rdfService.parseRdf(resultText, inferMimeTypeFromResultFormat(reasoningResultFormat));
    setInferredGraph(parsed);
    setAnalyzeMessage('Reasoning completed. Inferred results are ready.');
  }), [apiBaseUrl, ensureCurrentGraphUploaded, reasoningProfile, reasoningResultFormat, runAnalyzeAction]);

  const handleRunReasoningDirect = useCallback(() => runAnalyzeAction('Run direct reasoning', async () => {
    const graphId = await ensureCurrentGraphUploaded();
    const resultText = await kgApiService.reasoningRun(apiBaseUrl, {
      graphId,
      profile: reasoningProfile,
      options: {},
      resultFormat: reasoningResultFormat
    }, reasoningResultFormat);

    const parsed = await rdfService.parseRdf(resultText, inferMimeTypeFromResultFormat(reasoningResultFormat));
    setInferredGraph(parsed);
  }), [apiBaseUrl, ensureCurrentGraphUploaded, reasoningProfile, reasoningResultFormat, runAnalyzeAction]);

  const handleMergeInferred = useCallback(() => {
    if (!inferredGraph) {
      setError('No inferred graph available. Retrieve reasoning result first.');
      return;
    }
    setFullGraph((prev) => rdfService.mergeGraphs(prev, inferredGraph));
    setInferredGraph(null);
    setGraphVersion((v) => v + 1);
    setAnalyzeMessage('Merged inferred triples into working graph.');
  }, [inferredGraph]);

  const handleUploadShapes = useCallback((file: File) => {
    runAnalyzeAction('Upload shapes', async () => {
      const format = rdfService.detectFormatFromFilename(file.name);
      if (format !== 'text/turtle' && format !== 'application/ld+json') {
        throw new Error('Shapes must be TTL or JSON-LD.');
      }
      const body = await file.text();
      const response = await kgApiService.uploadShapes(apiBaseUrl, body, format);
      setShapesId(response.shapesId);
      setShaclJobId(null);
      setShaclJobStatus('n/a');
    });
  }, [apiBaseUrl, runAnalyzeAction]);

  const handleDeleteShapes = useCallback(() => runAnalyzeAction('Delete shapes', async () => {
    if (!shapesId) throw new Error('No shapes_id available.');
    await kgApiService.deleteShapes(apiBaseUrl, shapesId);
    setShapesId(null);
  }), [apiBaseUrl, shapesId, runAnalyzeAction]);

  const handleCreateShaclJob = useCallback(() => runAnalyzeAction('Run SHACL validation', async () => {
    const graphId = await ensureCurrentGraphUploaded();
    if (!shapesId) throw new Error('No shapes_id available. Upload shapes first.');

    const response = await kgApiService.createShaclJob(apiBaseUrl, {
      graphId,
      shapesId,
      options: {}
    });

    setShaclJobId(response.jobId);
    setShaclJobStatus('queued');
    let completed = false;
    for (let i = 0; i < JOB_MAX_POLLS; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, JOB_POLL_INTERVAL_MS));
      const status = await kgApiService.shaclJob(apiBaseUrl, response.jobId);
      setShaclJobStatus(status.status);
      setAnalyzeMessage(`SHACL job is ${status.status}...`);

      if (status.status === 'failed') {
        throw new Error(status.error?.message || 'SHACL job failed.');
      }
      if (status.status === 'succeeded') {
        completed = true;
        break;
      }
    }

    if (!completed) throw new Error('SHACL job timed out.');

    const report = await kgApiService.shaclReport(apiBaseUrl, response.jobId);
    setShaclReport(report);
    setIsShaclReportPaneOpen(true);
    const invalid = new Set((report.report.violations || []).map((v) => v.focusNode).filter(Boolean) as string[]);
    setInvalidNodeIds(invalid);
    setShaclFocusNodeId(null);
    setShaclFocusPredicate(null);
    setAnalyzeMessage('SHACL validation completed. Report is ready.');
  }), [apiBaseUrl, ensureCurrentGraphUploaded, shapesId, runAnalyzeAction]);

  const handleFetchShaclReport = useCallback(() => runAnalyzeAction('Fetch SHACL report', async () => {
    if (!shaclJobId) throw new Error('No SHACL job_id available.');
    const report = await kgApiService.shaclReport(apiBaseUrl, shaclJobId);
    setShaclReport(report);
    setIsShaclReportPaneOpen(true);
    const invalid = new Set((report.report.violations || []).map((v) => v.focusNode).filter(Boolean) as string[]);
    setInvalidNodeIds(invalid);
    setShaclFocusNodeId(null);
    setShaclFocusPredicate(null);
  }), [apiBaseUrl, shaclJobId, runAnalyzeAction]);

  const handleDownloadShaclReport = useCallback(() => {
    if (!shaclReport) {
      setError('No SHACL report available.');
      return;
    }
    downloadFile('shacl-report.json', JSON.stringify(shaclReport.report, null, 2), 'application/json');
  }, [shaclReport]);

  const handleFocusShaclViolation = useCallback((violation: ShaclViolation) => {
    const focusNode = violation.focusNode || null;
    const resultPath = violation.resultPath || null;

    setShaclFocusNodeId(focusNode);
    setShaclFocusPredicate(resultPath);

    if (focusNode) {
      setSelectedNodeId(focusNode);
      setSelectedNode(resolveSelectedNode(focusNode, renderGraph.nodes, fullGraph.nodes));
      setFocusMode(true);
    }
  }, [renderGraph.nodes, fullGraph.nodes]);

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

      if (e.key.toLowerCase() === 'm' && !e.ctrlKey && !e.metaKey) setIsMinimapOpen((prev) => !prev);
      if (e.key.toLowerCase() === 'r' && !e.ctrlKey && !e.metaKey) handleResetView();
      if (e.key.toLowerCase() === 'e' && !e.ctrlKey && !e.metaKey && selectedNodeId) toggleNodeExpansion(selectedNodeId);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleResetView, selectedNodeId, toggleNodeExpansion]);

  useEffect(() => {
    setSelectedNode(resolveSelectedNode(selectedNodeId, renderGraph.nodes, fullGraph.nodes));
  }, [selectedNodeId, renderGraph.nodes, fullGraph.nodes]);

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-200 overflow-hidden relative selection:bg-blue-500/30">
      <header className="h-14 border-b border-white/10 glass-panel flex items-center px-4 justify-between z-30 relative">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-1.5 rounded-lg shadow-lg shadow-blue-500/20"><Network className="text-white" size={20} /></div>
          <h1 className="font-bold text-lg tracking-tight text-white">RDF Explorer</h1>
        </div>

        <div className="flex items-center gap-2">
          {expandedNodes.size > 0 && (
            <button onClick={collapseAllExpanded} className="hidden sm:flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-amber-500/20 text-amber-200 hover:bg-amber-500/30 rounded-md transition-colors border border-amber-400/30" title="Collapse all temporary 1-hop expansions">
              <Layers size={14} /> Collapse Expanded ({expandedNodes.size})
            </button>
          )}
          <button onClick={handleResetView} className="hidden sm:flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-white/5 hover:bg-white/10 rounded-md transition-colors border border-white/5" title="Reset View (R)">
            <RotateCcw size={14} /> Reset View
          </button>
          <div className="w-px h-6 bg-white/10 mx-2 hidden sm:block"></div>
          <div className="flex items-center gap-4 text-xs font-medium text-slate-400">
            <span className="hidden lg:inline">Ctrl+B Sidebar | E Expand</span>
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-white/10 rounded-md transition-colors"><Menu size={20} /></button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        <div className={`absolute inset-y-0 left-0 z-20 w-80 glass-panel border-r border-white/10 transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <Sidebar
            onImport={handleImport}
            onExportGraph={handleExportGraph}
            onLoadDemo={handleLoadDemo}
            graphStats={{ nodes: fullGraph.nodes.length, edges: fullGraph.edges.length }}
            layout={layout}
            setLayout={handleLayoutChange}
            colorSettings={colorSettings}
            setColorSettings={setColorSettings}
            showNodeLabels={showNodeLabels}
            setShowNodeLabels={setShowNodeLabels}
            showEdgeLabels={showEdgeLabels}
            setShowEdgeLabels={setShowEdgeLabels}
            communitySettings={communitySettings}
            setCommunitySettings={setCommunitySettings}
            onRunCommunityDetection={runCommunityDetection}
            filterSettings={filterSettings}
            setFilterSettings={setFilterSettings}
            availableClasses={availableClasses}
            availablePredicates={availablePredicates}

            apiBaseUrl={apiBaseUrl}
            onApiBaseUrlChange={setApiBaseUrl}
            onPersistApiBaseUrl={handlePersistApiBaseUrl}
            onTestApiHealth={handleTestApiHealth}
            apiHealthStatus={apiHealthStatus}

            apiGraphId={apiGraphId}
            apiGraphNamedIri={apiGraphNamedIri}
            apiGraphTriples={apiGraphTriples}
            onDeleteGraph={handleDeleteGraph}

            reasoningProfile={reasoningProfile}
            setReasoningProfile={setReasoningProfile}
            reasoningResultFormat={reasoningResultFormat}
            setReasoningResultFormat={setReasoningResultFormat}
            reasoningJobId={reasoningJobId}
            reasoningJobStatus={reasoningJobStatus}
            onRunReasoningWorkflow={handleCreateReasoningJob}
            onMergeInferred={handleMergeInferred}
            onExportInferredJsonLd={handleExportInferredJsonLd}
            inferredTriplesCount={inferredGraph?.edges.length || 0}
            assertedTriplesCount={fullGraph.edges.length}

            shapesId={shapesId}
            onUploadShapes={handleUploadShapes}
            shaclJobId={shaclJobId}
            shaclJobStatus={shaclJobStatus}
            onRunShaclWorkflow={handleCreateShaclJob}
            onDownloadShaclReport={handleDownloadShaclReport}
            onDeleteShapes={handleDeleteShapes}
            shaclReport={shaclReport}
            onOpenShaclReport={() => setIsShaclReportPaneOpen(true)}

            analyzeBusy={analyzeBusy}
            analyzeMessage={analyzeMessage}
          />
        </div>

        <div className={`flex-1 relative transition-all duration-300 ${isSidebarOpen ? 'ml-80' : 'ml-0'}`}>
          <div className="absolute inset-0 bg-slate-950 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px]">
            {fullGraph.nodes.length > 0 ? (
              <GraphViewer
                nodes={renderGraph.nodes}
                edges={renderGraph.edges}
                layout={layout}
                colorSettings={colorSettings}
                showNodeLabels={showNodeLabels}
                showEdgeLabels={showEdgeLabels}
                onNodeClick={(node) => {
                  const next = applyNodeClickSelection(node, renderGraph.nodes, fullGraph.nodes, focusMode);
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
                shaclFocusNodeId={shaclFocusNodeId}
                shaclFocusPredicate={shaclFocusPredicate}
                setCyInstance={setCyInstance}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-4">
                <Network size={64} className="opacity-20" />
                <p>Upload a TTL/JSON-LD file or load the demo to begin.</p>
                <button onClick={handleLoadDemo} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md transition-colors">Load Demo Graph</button>
              </div>
            )}
          </div>

          {fullGraph.nodes.length > 0 && (
            <div className="absolute bottom-4 left-4 z-40 flex flex-col gap-2">
              <div className="glass-panel p-1 rounded-lg flex flex-col gap-1 shadow-xl">
                <button onClick={handleZoomIn} className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded transition-colors" title="Zoom In"><ZoomIn size={18} /></button>
                <button onClick={handleZoomOut} className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded transition-colors" title="Zoom Out"><ZoomOut size={18} /></button>
                <div className="h-px bg-white/10 mx-1"></div>
                <button onClick={handleResetView} className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded transition-colors" title="Reset View (R)"><RotateCcw size={18} /></button>
              </div>
              <button onClick={() => setIsMinimapOpen(!isMinimapOpen)} className={`glass-panel p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors shadow-xl ${isMinimapOpen ? 'text-blue-400 bg-blue-500/10 border-blue-500/30' : ''}`} title="Toggle Minimap (M)"><MapIcon size={18} /></button>
            </div>
          )}

          <Minimap cy={cyInstance} isOpen={isMinimapOpen} onClose={() => setIsMinimapOpen(false)} />

          {isLoading && (
            <div className="absolute inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center">
              <div className="flex flex-col items-center gap-3"><Loader2 size={40} className="animate-spin text-blue-500" /><span className="text-blue-200 font-medium">Processing Graph...</span></div>
            </div>
          )}

          {error && (
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-red-500/10 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg flex items-center gap-3 shadow-xl backdrop-blur-md max-w-lg z-50">
              <AlertCircle size={20} className="text-red-400" />
              <p className="text-sm">{error}</p>
              <button onClick={() => setError(null)} className="ml-auto hover:text-white"><span className="sr-only">Dismiss</span>x</button>
            </div>
          )}

          {infoMessage && !error && (
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-blue-500/10 border border-blue-500/50 text-blue-100 px-4 py-3 rounded-lg flex items-center gap-3 shadow-xl backdrop-blur-md max-w-2xl z-50">
              <AlertCircle size={20} className="text-blue-300" />
              <p className="text-sm">{infoMessage}</p>
              <button onClick={() => setInfoMessage(null)} className="ml-auto hover:text-white"><span className="sr-only">Dismiss</span>x</button>
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
              setSelectedNode(resolveSelectedNode(nodeId, renderGraph.nodes, fullGraph.nodes));
            }}
            rightOffsetPx={isShaclReportPaneOpen ? 416 : 0}
          />
        )}

        <ShaclReportPanel
          report={shaclReport}
          isOpen={isShaclReportPaneOpen}
          onClose={() => setIsShaclReportPaneOpen(false)}
          onFocusViolation={handleFocusShaclViolation}
        />
      </div>
    </div>
  );
}

export default App;
