# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**dglml** is a Data Vault 2.0 DBML diagram editor — a full-stack web app with a React/TypeScript frontend and a Python FastAPI backend. Users write DBML in a Monaco editor, and the app parses it into an interactive React Flow diagram with automatic ELK-based layout. The backend serves the built SPA and provides dbt project integration (model detection and generation via DataVault4dbt).

## Commands

### Frontend (npm)
```bash
npm install              # Install dependencies
npm run dev              # Vite dev server at http://localhost:5173
npm run build            # TypeScript check + Vite production build → dist/
npm run lint             # ESLint
npm run test             # Vitest
```

### Backend (Python)
```bash
pip install -e ".[dev]"  # Install with dev deps (pytest, httpx)
dbt-dglml serve          # Start FastAPI server at http://127.0.0.1:8000
```

### Testing
```bash
npm run test                                    # All frontend tests
python -m pytest tests/                         # All backend tests
python -m pytest tests/test_app.py::test_health # Single backend test
```

## Architecture

### Data Flow
```
Monaco Editor → DBML text
    → parseDbml() (300ms debounce via useParseEffect)
    → ParseResult {tables, refs, enums, stickyNotes, dv2Metadata, errors}
    → parseResultToFlow() / parseResultToConceptualFlow() converts to React Flow nodes/edges
    → layoutNodes() positions via ELK engine (spread or dense mode)
    → DiagramPanel renders the graph
```

### State Management
Zustand stores (no Redux):
- `useEditorStore` — DBML text, parse results, validation errors, dirty tracking (`lastSavedDbml`)
- `useDiagramStore` — nodes, edges, layout mode (`spread`/`dense`), view mode (`relational`/`conceptual`), collapsed hubs, stored layout positions
- `useProjectStore` — project CRUD, version history (isomorphic-git), layout/source config persistence
- `useThemeStore` — light/dark theme toggle
- `useSourceConfigStore` — dbt source configuration mappings

### Data Vault 2.0 Domain
- **Entity types**: hub, satellite, link, reference (`DV2EntityType`)
- **Column roles**: hk (hash key), bk (business key), mak (multi-active key), dk (driving key) (`DV2ColumnRole`)
- **Metadata extraction**: parsed from DBML note fields using `**bold**` markers (e.g., `**hk**`)
- **View modes**: Relational (standard ER) and Conceptual (DV2.0 entity-centric)
- **DV2 colors**: defined in `src/diagram/dv2Colors.ts` — each entity type has bg, border, handle colors

### Backend
FastAPI app in `dglml_server/` with SPA fallback routing. Endpoints for dbt project detection and DataVault4dbt model generation. Entry point: `dbt-dglml serve`.

## Key Files

### Stores
- `src/store/useEditorStore.ts` — DBML text, parse results, errors, dirty tracking
- `src/store/useDiagramStore.ts` — nodes/edges, layout mode, view mode, collapsed hubs
- `src/store/useProjectStore.ts` — project persistence, history, layout/source config save/load
- `src/store/useThemeStore.ts` — light/dark theme
- `src/store/useSourceConfigStore.ts` — dbt source mappings

### Parser
- `src/types/index.ts` — all shared type definitions
- `src/parser/parseDbml.ts` — DBML parsing via `@dbml/core`, DV2 metadata extraction
- `src/parser/dbmlToFlow.ts` — ParseResult → React Flow nodes/edges (relational view)
- `src/parser/conceptualToFlow.ts` — ParseResult → conceptual view nodes/edges

### Diagram
- `src/diagram/DiagramPanel.tsx` — main visualization component, selection, alignment/distribution, context menu, browse panel, layout controls
- `src/diagram/layoutEngine.ts` — ELK graph layout (`spread` = stress algorithm, `dense` = rectpacking), overlap removal
- `src/diagram/edgeHandles.ts` — assigns edge source/target handles (L/R column handles for relational, cardinal direction for conceptual)
- `src/diagram/TableNode.tsx` — relational table node with key column collapsing, selection outline
- `src/diagram/conceptual/HubNode.tsx` — ellipse hub node (auto-sizes to text)
- `src/diagram/conceptual/SatelliteNode.tsx` — rounded rectangle satellite node
- `src/diagram/conceptual/LinkNode.tsx` — rounded rectangle link node
- `src/diagram/conceptual/ConceptNode.tsx` — generic conceptual node
- `src/diagram/FocusModal.tsx` — focus mode: centers on a table, shows neighbors, radial layout
- `src/diagram/FocusEditPanel.tsx` — inline Monaco editor for editing a single table in focus mode
- `src/diagram/focusGraph.ts` — builds focus graph (full nodes + stub neighbors)
- `src/diagram/snapAlign.ts` — snap-to-guide alignment during drag
- `src/diagram/dv2Colors.ts` — DV2 entity type color definitions

### Editor
- `src/editor/EditorPanel.tsx` — Monaco editor wrapper with `editContext: false` (Chrome/macOS spacebar fix), error markers
- `src/editor/dbmlLanguage.ts` — DBML language definition for Monaco (syntax highlighting, keywords)
- `src/editor/dbmlTableReplace.ts` — extract/replace table blocks in DBML text (used by focus edit)

### Components
- `src/components/Toolbar.tsx` — top menu bar with icons (New, Projects, Save, Import, Sources, Export, History, Light/Dark)
- `src/components/FileDialog.tsx` — project list dialog (Open/Delete)
- `src/components/HistoryDialog.tsx` — version history with change summaries, layout change filter
- `src/components/ExportDialog.tsx` — SQL export (Postgres, MySQL, MSSQL, Oracle, Snowflake)
- `src/components/SourceConfigDialog.tsx` — dbt source configuration
- `src/components/CommandPalette.tsx` — search/command palette
- `src/components/InlineDialog.tsx` — reusable `ConfirmDialog` and `PromptDialog` (themed, replaces native browser dialogs)

### Persistence
- `src/persistence/gitStorage.ts` — isomorphic-git based storage (projects, history, layout, source config)

### CSS / Theming
- `src/index.css` — CSS variables for light/dark themes, React Flow controls overrides (use `!important` to override RF defaults)
- Theme variables: `--c-bg-1/2/3`, `--c-text-1/2/3/4`, `--c-border`, `--c-border-s`, `--c-edge`, etc.

## UI Features

### Diagram Interactions
- **Node selection**: click selects (shows outline via `var(--c-text-1)`), click pane deselects. Cmd/Ctrl+Click for multi-select.
- **Multi-select panel** (bottom-center): 6 alignment icons + 6 distribution icons (space evenly, equal centers, compact — H and V), with instant CSS tooltips
- **Right-click context menu**: Delete action with styled confirm dialog, removes table + refs + TableGroup entries
- **Focus mode**: double-click a table to enter, shows neighbors as stubs, expand/collapse, inline editor auto-opens
- **Browse panel**: entity browser grouped by DV2 type, click to zoom-to-node
- **Editor sync**: clicking a node scrolls editor to that line (`revealLineInCenter` + `focus()`, no text selection)
- **Snap guides**: dashed alignment guides appear during drag

### Save/Dirty Tracking
- `lastSavedDbml` in editor store tracks dirty state
- Save button shows amber `Save *` when dirty
- Ctrl/Cmd+S quick-saves; prompts for name if new project (via styled `PromptDialog`)

### History
- Standalone `HistoryDialog` with expandable change summaries (table diffs between commits)
- "Hide layout changes" filter (default on) hides `Update layout` commits

### Monaco Editor
- `editContext: false` required on all Monaco instances to fix Chrome/macOS spacebar issue (both EditorPanel and FocusEditPanel)
- Custom DBML language with syntax highlighting
- Error markers from parse errors

## Key Libraries
- **React Flow** (`@xyflow/react`) — diagram rendering
- **ELK** (`elkjs`) — automatic graph layout
- **Monaco Editor** (`@monaco-editor/react`) — code editor
- **@dbml/core** — DBML parsing
- **Allotment** — split pane layout
- **isomorphic-git** — browser-based git for version history

## Important Patterns
- All inline SVG icons use `currentColor` for stroke/fill so they inherit text color and work in both themes
- Click-outside handlers on the ReactFlow canvas must use capture phase: `addEventListener('mousedown', handler, true)` — ReactFlow captures mousedown before bubbling
- Node components receive `selected` from React Flow's `NodeProps` — used for outline rendering
- Layout mode type is `'spread' | 'dense'` (not 'snowflake')
- Conceptual hub nodes are ellipses that auto-size to text width
- All confirm/prompt dialogs use `ConfirmDialog`/`PromptDialog` from `src/components/InlineDialog.tsx` — no `window.confirm` or `window.prompt`
