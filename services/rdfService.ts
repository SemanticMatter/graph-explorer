import { Parser, Store, DataFactory } from 'n3';
import { RdfNode, RdfEdge, GraphData } from '../types';

const { namedNode, literal, defaultGraph, quad } = DataFactory;

export class RdfService {
  private store: Store;
  private prefixes: Record<string, string> = {};

  constructor() {
    this.store = new Store();
  }

  async parseTurtle(turtle: string): Promise<GraphData> {
    this.store = new Store();
    this.prefixes = {};

    const parser = new Parser({ format: 'Turtle' });

    return new Promise((resolve, reject) => {
      const quads: any[] = [];
      parser.parse(turtle, (error, quad, prefixes) => {
        if (error) {
          reject(error);
          return;
        }

        if (prefixes) {
          Object.assign(this.prefixes, prefixes);
        }

        if (quad) {
          quads.push(quad);
        } else {
          // Parsing complete
          this.store.addQuads(quads);
          const graphData = this.buildGraphModel();
          resolve(graphData);
        }
      });
    });
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
    // 1. Try rdfs:label
    const labels = this.store.getObjects(term, namedNode('http://www.w3.org/2000/01/rdf-schema#label'), defaultGraph());
    if (labels.length > 0) return labels[0].value;

    // 2. Try skos:prefLabel
    const prefLabels = this.store.getObjects(term, namedNode('http://www.w3.org/2004/02/skos/core#prefLabel'), defaultGraph());
    if (prefLabels.length > 0) return prefLabels[0].value;

    // 3. Try foaf:name
    const names = this.store.getObjects(term, namedNode('http://xmlns.com/foaf/0.1/name'), defaultGraph());
    if (names.length > 0) return names[0].value;

    // 4. Local name or CURIE
    const curie = this.getCurie(iri);
    if (curie) return curie;

    // 5. Fallback to full IRI part
    try {
      if (iri.includes('#')) return iri.split('#').pop() || iri;
      if (iri.includes('/')) return iri.split('/').pop() || iri;
    } catch (e) {}
    
    return iri;
  }

  private buildGraphModel(): GraphData {
    const nodeMap = new Map<string, RdfNode>();
    const edges: RdfEdge[] = [];

    // Iterate over all quads to find unique subjects and objects
    this.store.forEach((quad) => {
      const subj = quad.subject;
      const pred = quad.predicate;
      const obj = quad.object;

      // Add Subject Node
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

      // Add Object Node (Resources or Literals)
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

      // Capture rdf:type relationships for classes
      if (pred.value === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type') {
        const node = nodeMap.get(subj.value);
        if (node) {
          const classCurie = this.getCurie(obj.value) || obj.value;
          node.classes.push(classCurie);
        }
      }

      // Add Edge
      edges.push({
        id: `${subj.value}-${pred.value}-${obj.value}-${Math.random().toString(36).substr(2, 5)}`,
        source: subj.value,
        target: obj.value,
        predicate: pred.value,
        label: this.getCurie(pred.value) || pred.value.split('/').pop() || pred.value,
        curie: this.getCurie(pred.value)
      });
    }, null, null, null, null);

    // Calculate degrees
    const degreeMap = new Map<string, number>();
    edges.forEach(e => {
        degreeMap.set(e.source, (degreeMap.get(e.source) || 0) + 1);
        degreeMap.set(e.target, (degreeMap.get(e.target) || 0) + 1);
    });

    const nodes = Array.from(nodeMap.values()).map(n => ({
        ...n,
        val: Math.max(1, Math.min(20, (degreeMap.get(n.id) || 1) * 2)) // Scale for visualization
    }));

    return {
      nodes,
      edges,
      prefixes: this.prefixes
    };
  }
}

export const rdfService = new RdfService();
