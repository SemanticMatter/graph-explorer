# AGENT.md

Project-specific guidance for future Codex sessions in this repository.

## Scope

Applies to the `graph_explorer` workspace root.

## Fast Start

- Install deps: `npm install`
- Dev server: `npm run dev` (binds `0.0.0.0:3000`)
- Build: `npm run build`
- Preview build: `npm run preview`

## Architecture Map

- Entry:
  - `index.tsx` mounts `App`
  - `index.html` contains Tailwind CDN config and base styles
- App orchestration:
  - `App.tsx`: top-level state, import/demo actions, filters, keyboard shortcuts, layout/color settings
- UI components:
  - `components/Controls/Sidebar.tsx`: tabs for data/view/analyze controls
  - `components/Graph/GraphViewer.tsx`: Cytoscape elements, style, layouts, focus behavior
  - `components/Graph/Minimap.tsx`: canvas minimap + interaction
  - `components/Inspector.tsx`: selected node details + relationship navigation
- Services:
  - `services/rdfService.ts`: Turtle parse + graph model generation
  - `services/communityService.ts`: community detection algorithm
- Shared types/constants:
  - `types.ts`, `constants.ts`

## Behavior Notes

- Upload accepts `.ttl` files only.
- Parser uses `n3` and builds nodes/edges from all triples.
- Labels resolve using this precedence:
  1. `rdfs:label`
  2. `skos:prefLabel`
  3. `foaf:name`
  4. CURIE
  5. local IRI segment
- Predicate filtering and text search are active.
- `selectedClasses` exists in state/types but is not currently applied to visible nodes.
- Community settings UI exposes `lpa` and `louvain`; service currently runs one label-propagation style algorithm.


## Working Rules for Edits

- Prefer targeted edits over broad rewrites.
- Keep TypeScript strictness intact; avoid adding `any` unless unavoidable.
- Keep UI behavior consistent with existing Tailwind class style and glassmorphism patterns.
- Do not introduce backend assumptions; this is a static client app.

## Validation Checklist

After non-trivial changes:

1. `npm run build` succeeds.
2. Manual smoke checks in dev or preview:
   - Demo graph loads.
   - TTL upload works.
   - Node selection opens inspector.
   - Minimap toggles (`M`) and reset view (`R`) works.
   - Predicate filter updates visible edges.

## Known Gaps / Candidate Improvements

- Implement class filtering based on `filterSettings.selectedClasses`.
- Align community algorithm selector with real backend algorithm variants.
- Remove unused env injection or add real API-backed features that consume it.
- Add automated tests (currently none).
