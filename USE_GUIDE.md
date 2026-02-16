# RDF Graph Explorer User Guide

## Purpose

Use this app to inspect RDF data from Turtle (`.ttl`) files as an interactive graph.

## Quick Start

1. Open the app.
2. In the left sidebar (`Data` tab), either:
   - Upload a `.ttl` file, or
   - Click `Load Demo Graph`.
3. Explore nodes and edges in the main canvas.

## Main Areas

- Top bar: app title, reset view, sidebar toggle
- Left sidebar:
  - `Data`: import files, load demo, graph stats
  - `View`: layout, coloring, filters
  - `Analyze`: community detection
- Center canvas: graph visualization and interactions
- Right panel (Inspector): appears when you select a node
- Bottom-right minimap: overview and quick navigation

## Working with Data

### Import Turtle

- Click upload zone in `Data` tab and select a `.ttl` file.
- On parse success, graph nodes/edges appear.
- On failure, a red toast explains the parsing error.

### Load Demo Graph

- Click `Load Demo Graph` to instantly load a built-in sample dataset.

## Graph Navigation

- Pan: drag on empty canvas
- Zoom: mouse wheel or floating `+` / `-` buttons
- Reset view: `Reset View` button or `R` key
- Toggle minimap: map button or `M` key

## Selecting and Inspecting Nodes

- Click a node to open the right-side Inspector.
- Inspector shows:
  - Node label and CURIE/IRI
  - Types (`rdf:type` classes)
  - Outgoing and incoming links
- Click linked source/target IDs in Inspector to jump to that node.

## Focus Mode

- In Inspector, click `Focus Mode`.
- The selected node and immediate neighborhood are emphasized.
- Click `Exit Focus` to return to full graph emphasis.

## View Controls

### Layouts

From `View` tab, choose one:

- `Force Directed (Cose)`
- `Hierarchical (Tree)`
- `Radial`
- `Circular`
- `Grid`

Use `Re-run Layout` after switching if needed.

### Coloring Modes

- `mono`: single color for all nodes (customizable color picker)
- `class`: color by first RDF class on each node
- `community`: color by detected community
- `degree`: color by node degree bucket

### Filters

- Search: filters visible nodes by label, IRI, or CURIE text
- Predicates: show a subset of predicates

Tip: if the graph looks unexpectedly small, clear search and restore predicate selections.

## Community Detection

1. Go to `Analyze` tab.
2. Select algorithm (`Label Propagation` or `Louvain` label; implementation currently uses label-propagation style logic).
3. Click `Run Detection`.
4. App assigns community IDs and switches coloring mode to `community`.

## Keyboard Shortcuts

- `Ctrl+B` (or `Cmd+B` on macOS): toggle sidebar
- `M`: toggle minimap
- `R`: reset view

Shortcuts are ignored while typing in text inputs.

## Common Operating Patterns

### Pattern: Triage a large dataset

1. Import `.ttl`
2. Switch layout to `hierarchical` or `radial`
3. Use search to find a seed node
4. Open Inspector and enable `Focus Mode`
5. Run community detection and switch between class/community colors

### Pattern: Predicate-specific analysis

1. Open `View` tab
2. In `Predicates`, keep only relevant predicates checked
3. Use Inspector to validate incoming/outgoing relationships

## Limitations to Keep in Mind

- Class filtering UI state exists but class-based filtering is not currently applied in graph rendering.
- Community algorithm selection includes two labels, but backend logic currently uses one deterministic label-propagation implementation.
- Edge IDs include random suffixes; re-importing the same file can produce different edge IDs.
