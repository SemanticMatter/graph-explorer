import { DataFactory, Parser, Store, Writer } from 'n3';
import { GraphData, RdfEdge, RdfMimeType, RdfNode } from '../types';

const { namedNode, blankNode, literal, defaultGraph, quad } = DataFactory;

const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';

type JsonLdContext = {
  prefixes: Record<string, string>;
  terms: Record<string, string>;
  vocab?: string;
};

function isAbsoluteIri(value: string): boolean {
  return /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value);
}

function detectRdfMimeTypeFromFilename(fileName: string): RdfMimeType {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.ttl')) return 'text/turtle';
  if (lower.endsWith('.jsonld') || lower.endsWith('.json')) return 'application/ld+json';
  throw new Error('Unsupported file extension. Use .ttl, .jsonld, or .json');
}

function termFromJsonLdValue(raw: any, context: JsonLdContext, makeBNode: () => string): any {
  if (raw === null || raw === undefined) return literal('');

  if (typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean') {
    return literal(String(raw));
  }

  if (typeof raw === 'object') {
    if (typeof raw['@id'] === 'string') {
      const id = expandTerm(raw['@id'], context);
      return id.startsWith('_:') ? blankNode(id.slice(2)) : namedNode(id);
    }

    if (raw['@value'] !== undefined) {
      if (typeof raw['@language'] === 'string') {
        return literal(String(raw['@value']), raw['@language']);
      }
      if (typeof raw['@type'] === 'string') {
        return literal(String(raw['@value']), namedNode(expandTerm(raw['@type'], context)));
      }
      return literal(String(raw['@value']));
    }

    // Nested object node, reference via id (or generated blank node) and parse recursively.
    const nestedId = typeof raw['@id'] === 'string' ? expandTerm(raw['@id'], context) : makeBNode();
    return nestedId.startsWith('_:') ? blankNode(nestedId.slice(2)) : namedNode(nestedId);
  }

  return literal(String(raw));
}

function parseContextValue(contextValue: any, base: JsonLdContext): JsonLdContext {
  const merged: JsonLdContext = {
    prefixes: { ...base.prefixes },
    terms: { ...base.terms },
    vocab: base.vocab
  };

  const items = Array.isArray(contextValue) ? contextValue : [contextValue];

  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    for (const [key, value] of Object.entries(item)) {
      if (key === '@vocab' && typeof value === 'string') {
        merged.vocab = value;
        continue;
      }
      if (typeof value === 'string') {
        merged.terms[key] = value;
        if (isAbsoluteIri(value) && (value.endsWith('/') || value.endsWith('#'))) {
          merged.prefixes[key] = value;
        }
      }
    }
  }

  return merged;
}

function expandTerm(term: string, context: JsonLdContext): string {
  if (term.startsWith('@')) return term;
  if (term.startsWith('_:')) return term;
  if (context.terms[term]) return context.terms[term];
  if (isAbsoluteIri(term)) {
    if (!term.includes('://') && term.includes(':')) {
      const [prefix, suffix] = term.split(':', 2);
      if (context.prefixes[prefix]) return `${context.prefixes[prefix]}${suffix}`;
    }
    return term;
  }
  if (context.vocab) return `${context.vocab}${term}`;
  return term;
}

export class RdfService {
  private store: Store;
  private prefixes: Record<string, string> = {};
  private bnodeCounter = 0;

  constructor() {
    this.store = new Store();
  }

  detectFormatFromFilename(fileName: string): RdfMimeType {
    return detectRdfMimeTypeFromFilename(fileName);
  }

  async parseFile(file: File): Promise<{ data: GraphData; format: RdfMimeType }> {
    const format = this.detectFormatFromFilename(file.name);
    const text = await file.text();
    const data = await this.parseRdf(text, format);
    return { data, format };
  }

  async parseTurtle(turtle: string): Promise<GraphData> {
    return this.parseRdf(turtle, 'text/turtle');
  }

  async parseRdf(content: string, format: RdfMimeType): Promise<GraphData> {
    this.store = new Store();
    this.prefixes = {};
    this.bnodeCounter = 0;

    if (format === 'application/ld+json') {
      this.parseJsonLd(content);
      return this.buildGraphModel();
    }

    const parser = new Parser({ format: format === 'application/n-triples' ? 'N-Triples' : 'Turtle' });

    return new Promise((resolve, reject) => {
      const quads: any[] = [];
      parser.parse(content, (error, parsedQuad, parsedPrefixes) => {
        if (error) {
          reject(new Error(`Invalid ${format} content: ${error.message}`));
          return;
        }

        if (parsedPrefixes) {
          Object.assign(this.prefixes, parsedPrefixes);
        }

        if (parsedQuad) {
          quads.push(parsedQuad);
        } else {
          this.store.addQuads(quads);
          resolve(this.buildGraphModel());
        }
      });
    });
  }

  async serializeGraph(graph: GraphData, format: RdfMimeType, pretty = true): Promise<string> {
    if (format === 'application/ld+json') {
      return this.serializeJsonLd(graph, pretty);
    }

    const writer = new Writer({
      prefixes: graph.prefixes,
      format: format === 'application/n-triples' ? 'N-Triples' : 'Turtle'
    });

    graph.edges.forEach((edge) => {
      const source = edge.source.startsWith('_:') ? blankNode(edge.source.slice(2)) : namedNode(edge.source);
      const predicate = namedNode(edge.predicate);

      const targetNode = graph.nodes.find((n) => n.id === edge.target);
      let object: any;
      if (targetNode?.type === 'literal') {
        object = literal(targetNode.label);
      } else if (edge.target.startsWith('_:')) {
        object = blankNode(edge.target.slice(2));
      } else {
        object = namedNode(edge.target);
      }

      writer.addQuad(quad(source, predicate, object));
    });

    return new Promise((resolve, reject) => {
      writer.end((error, result) => {
        if (error) {
          reject(new Error(`Failed to serialize graph: ${error.message}`));
          return;
        }
        resolve(result);
      });
    });
  }

  mergeGraphs(base: GraphData, additional: GraphData): GraphData {
    const nodeMap = new Map(base.nodes.map((n) => [n.id, n]));
    additional.nodes.forEach((node) => {
      if (!nodeMap.has(node.id)) nodeMap.set(node.id, node);
    });

    const edgeMap = new Map<string, RdfEdge>();
    const toKey = (edge: RdfEdge) => `${edge.source}|${edge.predicate}|${edge.target}`;

    base.edges.forEach((edge) => edgeMap.set(toKey(edge), edge));
    additional.edges.forEach((edge) => {
      const key = toKey(edge);
      if (!edgeMap.has(key)) edgeMap.set(key, edge);
    });

    return {
      nodes: Array.from(nodeMap.values()),
      edges: Array.from(edgeMap.values()),
      prefixes: { ...base.prefixes, ...additional.prefixes }
    };
  }

  private parseJsonLd(content: string) {
    let json: any;
    try {
      json = JSON.parse(content);
    } catch (error: any) {
      throw new Error(`Invalid JSON-LD: ${error.message}`);
    }

    const rootArray = Array.isArray(json) ? json : [json];
    const defaultContext: JsonLdContext = { prefixes: {}, terms: {} };

    rootArray.forEach((entry) => {
      this.walkJsonLdNode(entry, defaultContext);
    });
  }

  private walkJsonLdNode(node: any, inheritedContext: JsonLdContext) {
    if (!node || typeof node !== 'object') return;

    const context = node['@context'] ? parseContextValue(node['@context'], inheritedContext) : inheritedContext;
    Object.assign(this.prefixes, context.prefixes);

    if (Array.isArray(node['@graph'])) {
      node['@graph'].forEach((child: any) => this.walkJsonLdNode(child, context));
    }

    const rawId = typeof node['@id'] === 'string' ? expandTerm(node['@id'], context) : this.nextBlankNode();
    const subject = rawId.startsWith('_:') ? blankNode(rawId.slice(2)) : namedNode(rawId);

    const rawTypes = node['@type'] === undefined ? [] : Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
    rawTypes.forEach((rawType: any) => {
      if (typeof rawType !== 'string') return;
      const iri = expandTerm(rawType, context);
      const typeNode = iri.startsWith('_:') ? blankNode(iri.slice(2)) : namedNode(iri);
      this.store.addQuad(quad(subject, namedNode(RDF_TYPE), typeNode, defaultGraph()));
    });

    for (const [rawKey, rawValue] of Object.entries(node)) {
      if (rawKey === '@context' || rawKey === '@id' || rawKey === '@type' || rawKey === '@graph') continue;

      const predIri = expandTerm(rawKey, context);
      if (!predIri || predIri.startsWith('@')) continue;

      const values = Array.isArray(rawValue) ? rawValue : [rawValue];
      values.forEach((value) => {
        const object = termFromJsonLdValue(value, context, () => this.nextBlankNode());
        this.store.addQuad(quad(subject, namedNode(predIri), object, defaultGraph()));

        if (value && typeof value === 'object' && !Array.isArray(value) && !('@value' in value)) {
          this.walkJsonLdNode(value, context);
        }
      });
    }
  }

  private serializeJsonLd(graph: GraphData, pretty = true): string {
    const context: Record<string, string> = { ...graph.prefixes };
    const nodesMap = new Map<string, any>();

    const ensureSubject = (id: string) => {
      if (!nodesMap.has(id)) {
        nodesMap.set(id, { '@id': id });
      }
      return nodesMap.get(id);
    };

    graph.nodes.forEach((node) => {
      const subject = ensureSubject(node.id);
      if (node.classes.length > 0) {
        subject['@type'] = node.classes.map((cls) => this.maybeCompact(cls, graph.prefixes));
      }
    });

    graph.edges.forEach((edge) => {
      const subject = ensureSubject(edge.source);
      const pred = this.maybeCompact(edge.predicate, graph.prefixes);
      const targetNode = graph.nodes.find((n) => n.id === edge.target);

      let object: any;
      if (targetNode?.type === 'literal') {
        object = { '@value': targetNode.label };
      } else {
        object = { '@id': edge.target };
      }

      if (!subject[pred]) subject[pred] = [];
      subject[pred].push(object);
    });

    const output = {
      '@context': context,
      '@graph': Array.from(nodesMap.values())
    };

    return JSON.stringify(output, null, pretty ? 2 : undefined);
  }

  private maybeCompact(iri: string, prefixes: Record<string, string>): string {
    for (const [prefix, ns] of Object.entries(prefixes)) {
      if (iri.startsWith(ns)) {
        return `${prefix}:${iri.slice(ns.length)}`;
      }
    }
    return iri;
  }

  private nextBlankNode() {
    const id = `_:b${this.bnodeCounter}`;
    this.bnodeCounter += 1;
    return id;
  }

  private getCurie(iri: string): string | undefined {
    for (const [prefix, namespace] of Object.entries(this.prefixes)) {
      if (iri.startsWith(namespace)) {
        return `${prefix}:${iri.slice(namespace.length)}`;
      }
    }
    return undefined;
  }

  private getLabel(iri: string, term: any): string {
    const labels = this.store.getObjects(term, namedNode('http://www.w3.org/2000/01/rdf-schema#label'), defaultGraph());
    if (labels.length > 0) return labels[0].value;

    const prefLabels = this.store.getObjects(term, namedNode('http://www.w3.org/2004/02/skos/core#prefLabel'), defaultGraph());
    if (prefLabels.length > 0) return prefLabels[0].value;

    const names = this.store.getObjects(term, namedNode('http://xmlns.com/foaf/0.1/name'), defaultGraph());
    if (names.length > 0) return names[0].value;

    const curie = this.getCurie(iri);
    if (curie) return curie;

    if (iri.includes('#')) return iri.split('#').pop() || iri;
    if (iri.includes('/')) return iri.split('/').pop() || iri;
    return iri;
  }

  private buildGraphModel(): GraphData {
    const nodeMap = new Map<string, RdfNode>();
    const edges: RdfEdge[] = [];

    this.store.forEach((storedQuad) => {
      const subj = storedQuad.subject;
      const pred = storedQuad.predicate;
      const obj = storedQuad.object;

      if (!nodeMap.has(subj.value)) {
        nodeMap.set(subj.value, {
          id: subj.value,
          label: this.getLabel(subj.value, subj),
          type: subj.termType === 'BlankNode' ? 'bnode' : 'resource',
          curie: subj.termType === 'NamedNode' ? this.getCurie(subj.value) : undefined,
          classes: [],
          val: 1
        });
      }

      if (!nodeMap.has(obj.value)) {
        nodeMap.set(obj.value, {
          id: obj.value,
          label: obj.termType === 'Literal' ? obj.value : this.getLabel(obj.value, obj),
          type: obj.termType === 'Literal' ? 'literal' : (obj.termType === 'BlankNode' ? 'bnode' : 'resource'),
          curie: obj.termType === 'NamedNode' ? this.getCurie(obj.value) : undefined,
          classes: [],
          val: 1
        });
      }

      if (pred.value === RDF_TYPE) {
        const node = nodeMap.get(subj.value);
        if (node) {
          const classCurie = this.getCurie(obj.value) || obj.value;
          if (!node.classes.includes(classCurie)) node.classes.push(classCurie);
        }
      }

      edges.push({
        id: `${subj.value}-${pred.value}-${obj.value}-${Math.random().toString(36).slice(2, 7)}`,
        source: subj.value,
        target: obj.value,
        predicate: pred.value,
        label: this.getCurie(pred.value) || pred.value.split('/').pop() || pred.value,
        curie: this.getCurie(pred.value)
      });
    }, null, null, null, null);

    const degreeMap = new Map<string, number>();
    edges.forEach((edge) => {
      degreeMap.set(edge.source, (degreeMap.get(edge.source) || 0) + 1);
      degreeMap.set(edge.target, (degreeMap.get(edge.target) || 0) + 1);
    });

    const nodes = Array.from(nodeMap.values()).map((node) => ({
      ...node,
      val: Math.max(1, Math.min(20, (degreeMap.get(node.id) || 1) * 2))
    }));

    return {
      nodes,
      edges,
      prefixes: this.prefixes
    };
  }
}

export const rdfService = new RdfService();
