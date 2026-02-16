export const DEMO_TTL = `
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix ex: <http://example.org/> .
@prefix schema: <http://schema.org/> .

ex:Alice a foaf:Person ;
    foaf:name "Alice" ;
    foaf:knows ex:Bob, ex:Charlie ;
    ex:worksAt ex:CompanyA ;
    rdfs:label "Alice Resource" .

ex:Bob a foaf:Person ;
    foaf:name "Bob" ;
    foaf:knows ex:Alice ;
    ex:worksAt ex:CompanyB .

ex:Charlie a foaf:Person ;
    foaf:name "Charlie" ;
    foaf:knows ex:Alice, ex:David .

ex:David a foaf:Person ;
    foaf:name "David" ;
    foaf:knows ex:Charlie .

ex:CompanyA a schema:Organization ;
    rdfs:label "Tech Corp" ;
    ex:locatedIn ex:CityX .

ex:CompanyB a schema:Organization ;
    rdfs:label "Biz Inc" .

ex:CityX a schema:City ;
    rdfs:label "Metropolis" .

# Taxonomy
ex:Manager rdfs:subClassOf foaf:Person .
ex:Director rdfs:subClassOf ex:Manager .

ex:Eve a ex:Director ;
    foaf:name "Eve" ;
    foaf:knows ex:Alice .
`;

export const COLOR_PALETTE = [
  '#3b82f6', // Blue
  '#ef4444', // Red
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#84cc16', // Lime
  '#f97316', // Orange
  '#6366f1', // Indigo
];

// Special marker for predicate filtering meaning "no predicates are active".
export const PREDICATE_NONE_SENTINEL = '__NONE__';
