# RDF Graph Explorer

Interactive RDF/Turtle (`.ttl`) graph visualization app built with React, TypeScript, Vite, Cytoscape, and N3.

## What It Does

- Imports Turtle RDF files and turns triples into an interactive graph
- Supports multiple layouts (`force`, `hierarchical`, `radial`, `circular`, `grid`)
- Provides multiple node coloring modes (`mono`, `class`, `community`, `degree`)
- Includes predicate filtering, text search, node inspector, focus mode, and minimap
- Runs community detection (label propagation implementation)

## Tech Stack

- React 19 + TypeScript
- Vite 6
- Cytoscape + `react-cytoscapejs`
- `n3` Turtle parser/store
- Tailwind classes via CDN script in `index.html`

## Prerequisites

- Node.js 18+ (Node.js 20 LTS recommended)
- npm 9+

## Project Structure

- `App.tsx`: app shell, state, filtering, keyboard shortcuts
- `components/Controls/Sidebar.tsx`: import/view/analyze controls
- `components/Graph/GraphViewer.tsx`: Cytoscape rendering, layouts, styles, selection
- `components/Graph/Minimap.tsx`: overview + pan/zoom helper
- `components/Inspector.tsx`: selected node details and neighborhood navigation
- `services/rdfService.ts`: Turtle parsing + graph model construction
- `services/communityService.ts`: community detection
- `vite.config.ts`: dev server config + environment variable injection

## Environment Variables

Create `.env.local` in the repo root:

```bash
GEMINI_API_KEY=your_value_here
```

Notes:

- The current codebase injects `GEMINI_API_KEY` in `vite.config.ts`.
- The app currently does not call Gemini APIs at runtime, so this variable is effectively optional for current behavior.
- Keep `.env.local` out of version control.

## Local Development

1. Install dependencies:

```bash
npm install
```

2. Start the dev server:

```bash
npm run dev
```

3. Open:

- `http://localhost:3000`

## Build

Build a production bundle into `dist/`:

```bash
npm run build
```

Preview the built bundle locally:

```bash
npm run preview
```

Default preview URL is shown by Vite (typically `http://localhost:4173`).

## Deploy

This is a static frontend app. Deploy the `dist/` folder to any static host.

### Option A: Netlify

1. Build command: `npm run build`
2. Publish directory: `dist`
3. If needed, set env var in Netlify UI:
   - `GEMINI_API_KEY`

### Option B: Vercel

1. Framework preset: `Vite`
2. Build command: `npm run build`
3. Output directory: `dist`
4. Add env var if required:
   - `GEMINI_API_KEY`

### Option C: GitHub Pages (artifact deploy)

1. Run locally or in CI:

```bash
npm ci
npm run build
```

2. Publish contents of `dist/` to your Pages branch/site.

If deploying under a subpath, configure Vite `base` in `vite.config.ts` before building.

### Option D: Nginx / S3 / CloudFront / Any CDN

- Upload `dist/` contents.
- Serve `index.html` for the root route.
- Use long cache for hashed assets in `dist/assets/`.

## Operational Guide

A full operator guide is in `USE_GUIDE.md`.

## Troubleshooting

- Parse errors when importing `.ttl`:
  - Verify Turtle syntax and prefixes.
  - Check browser error toast details.
- Empty or sparse graph:
  - Confirm uploaded file contains triples.
  - Clear predicate filters and search term.
- Layout appears cluttered:
  - Switch to `hierarchical` or `radial` and click `Re-run Layout`.
  - Use Focus Mode from inspector.
- Minimap missing:
  - Toggle via map button or press `M`.

## Scripts

- `npm run dev`: start development server (port 3000)
- `npm run build`: create production build in `dist/`
- `npm run preview`: serve production build locally
