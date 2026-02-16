export interface RdfNode {
  id: string;
  label: string;
  type: 'resource' | 'literal' | 'bnode';
  curie?: string;
  classes: string[]; // rdf:type values
  community?: number;
  val?: number; // for degrees
}

export interface RdfEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  curie?: string;
  predicate: string;
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
