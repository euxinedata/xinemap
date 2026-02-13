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
    → parseResultToFlow() converts to React Flow nodes/edges
    → layoutNodes() positions via ELK engine
    → DiagramPanel renders the graph
```

### State Management
Zustand stores (no Redux):
- `useEditorStore` — DBML text, parse results, validation errors
- `useDiagramStore` — nodes, edges, layout direction, view mode (relational/conceptual)
- `useProjectStore` — project persistence (localStorage + isomorphic-git)
- `useThemeStore` — light/dark theme
- `useSourceConfigStore` — dbt source configuration mappings

### Data Vault 2.0 Domain
- **Entity types**: hub, satellite, link, reference (`DV2EntityType`)
- **Column roles**: hk (hash key), bk (business key), mak (multi-active key), dk (driving key) (`DV2ColumnRole`)
- **Metadata extraction**: parsed from DBML note fields using `**bold**` markers (e.g., `**hk**`)
- **View modes**: Relational (standard ER) and Conceptual (DV2.0 entity-centric)

### Backend
FastAPI app in `dglml_server/` with SPA fallback routing. Endpoints for dbt project detection and DataVault4dbt model generation. Entry point: `dbt-dglml serve`.

### Key Files
- `src/types/index.ts` — all shared type definitions
- `src/parser/parseDbml.ts` — DBML parsing via `@dbml/core`, DV2 metadata extraction
- `src/parser/dbmlToFlow.ts` — ParseResult → React Flow nodes/edges conversion
- `src/diagram/layoutEngine.ts` — ELK graph layout
- `src/diagram/DiagramPanel.tsx` — main visualization component
- `src/store/*.ts` — Zustand stores

## Key Libraries
- **React Flow** (`@xyflow/react`) — diagram rendering
- **ELK** (`elkjs`) — automatic graph layout
- **Monaco Editor** (`@monaco-editor/react`) — code editor
- **@dbml/core** — DBML parsing
- **Allotment** — split pane layout
- **isomorphic-git** — browser-based git for version history
