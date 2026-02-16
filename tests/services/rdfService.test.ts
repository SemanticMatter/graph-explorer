import test from 'node:test';
import assert from 'node:assert/strict';
import { RdfService } from '../../services/rdfService';

test('RdfService parses turtle, captures prefixes, and creates graph entities', async () => {
  const ttl = `
    @prefix ex: <http://example.org/> .
    @prefix foaf: <http://xmlns.com/foaf/0.1/> .
    ex:Alice a foaf:Person ;
      foaf:name "Alice" ;
      ex:knows ex:Bob .
    ex:Bob a foaf:Person .
  `;

  const svc = new RdfService();
  const graph = await svc.parseTurtle(ttl);

  assert.equal(graph.prefixes.ex, 'http://example.org/');
  assert.ok(graph.nodes.length >= 3);
  assert.equal(graph.edges.length, 4);

  const alice = graph.nodes.find((n) => n.id === 'http://example.org/Alice');
  assert.equal(alice?.label, 'Alice');
  assert.ok(alice?.classes.includes('foaf:Person'));
});

test('RdfService uses label precedence: rdfs:label over foaf:name', async () => {
  const ttl = `
    @prefix ex: <http://example.org/> .
    @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
    @prefix foaf: <http://xmlns.com/foaf/0.1/> .
    ex:X rdfs:label "Preferred Label" ;
         foaf:name "Fallback Name" .
  `;

  const svc = new RdfService();
  const graph = await svc.parseTurtle(ttl);

  const node = graph.nodes.find((n) => n.id === 'http://example.org/X');
  assert.equal(node?.label, 'Preferred Label');
});

test('RdfService handles blank nodes and literals with proper node types', async () => {
  const ttl = `
    @prefix ex: <http://example.org/> .
    ex:Root ex:hasPart _:b0 .
    _:b0 ex:value "literal value" .
  `;

  const svc = new RdfService();
  const graph = await svc.parseTurtle(ttl);

  const bnode = graph.nodes.find((n) => n.type === 'bnode');
  const literal = graph.nodes.find((n) => n.type === 'literal');

  assert.ok(Boolean(bnode));
  assert.equal(literal?.label, 'literal value');
});

test('RdfService rejects invalid turtle input', async () => {
  const svc = new RdfService();

  await assert.rejects(async () => {
    await svc.parseTurtle('this is not valid turtle . . .');
  });
});
