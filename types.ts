export interface RdfNode {
  id: string;
  label: string;
  type: 'resource' | 'literal' | 'bnode';
  curie?: string;
  classes: string[]; // rdf:type values
  community?: number;
  val?: number; // for degrees
  isExpanded?: boolean;
  isExpandedSeed?: boolean;
  isInvalid?: boolean;
}

export interface RdfEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  curie?: string;
  predicate: string;
  isExpanded?: boolean;
}

export interface GraphData {
  nodes: RdfNode[];
  edges: RdfEdge[];
  prefixes: Record<string, string>;
}

export type LayoutType = 'force' | 'hierarchical' | 'radial' | 'circular' | 'grid';

export interface FilterSettings {
  showLiterals: boolean;
  selectedClasses: string[]; // if empty, show all
  selectedPredicates: string[]; // if empty, show all
  searchTerm: string;
}

export interface CommunitySettings {
  enabled: boolean;
  algorithm: 'lpa' | 'louvain'; // Simplified for this demo
  resolution: number; // for Louvain approx
}

export interface ColorSettings {
  mode: 'mono' | 'class' | 'community' | 'degree';
  baseColor: string;
}

export interface ParsedTriple {
  subject: string;
  predicate: string;
  object: string;
  subjectType: 'IRI' | 'BlankNode';
  objectType: 'IRI' | 'BlankNode' | 'Literal';
}

export type RdfMimeType = 'text/turtle' | 'application/ld+json' | 'application/n-triples';
export type ReasoningProfile = 'disabled' | 'rdfs' | 'owlrl';
export type ReasoningResultFormat = 'text/turtle' | 'application/n-triples' | 'application/ld+json';

export interface ApiHealthResponse {
  status: 'healthy' | 'degraded';
  agraph: {
    reachable: boolean;
    version: string | null;
    repository: string;
  };
}

export interface ApiCapabilitiesResponse {
  rdfInputFormats: string[];
  rdfOutputFormats: string[];
  reasoningProfiles: string[];
  shacl: {
    engines: string[];
    features: string[];
  };
}

export interface ApiGraphCreateResponse {
  graphId: string;
  namedGraphIri: string;
  repository: string;
  stats?: {
    triples?: number | null;
  };
}

export interface ApiGraphStatsResponse {
  graphId: string;
  namedGraphIri: string;
  repository: string;
  triples: number | null;
}

export interface GraphByReferenceRequest {
  repository: string;
  namedGraphIri: string;
}

export interface ReasoningJobCreateRequest {
  graphId: string;
  profile: ReasoningProfile;
  options: Record<string, unknown>;
  resultFormat: ReasoningResultFormat;
}

export interface ShaclJobCreateRequest {
  graphId: string;
  shapesId: string;
  options: Record<string, unknown>;
}

export interface ApiJobCreateResponse {
  jobId: string;
}

export interface ApiJobStatus {
  jobId: string;
  type: 'reasoning' | 'shacl';
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  error?: {
    code: string;
    message: string;
  } | null;
}

export interface ShaclViolation {
  id?: string;
  focusNode?: string;
  resultPath?: string;
  severity?: string;
  message?: string;
  sourceShape?: string;
  sourceConstraintComponent?: string;
}

export interface ApiShaclReportResponse {
  report: {
    conforms: boolean;
    violations: ShaclViolation[];
    counts?: {
      results?: number;
      bySeverity?: Record<string, number>;
    };
  };
  rdfReport: string;
}
