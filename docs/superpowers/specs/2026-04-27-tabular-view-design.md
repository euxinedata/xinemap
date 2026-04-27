# Tabular View — Design

**Date:** 2026-04-27
**Branch:** `tabular`
**Status:** Approved, pending implementation plan

## Summary

Add a third view mode, **Tabular**, alongside the existing Relational and Conceptual views. The tabular view shows one row per table in a sortable, filterable grid driven by **TanStack Table** (`@tanstack/react-table`). Editor pane remains unchanged; the right pane swaps between the diagram and the grid based on the current view mode.

## Goals

- Provide a non-graph way to scan and filter the tables defined in the DBML source.
- Reuse the existing `ParseResult` — no parser changes.
- Match xinemap's lean style: minimal dependencies, native theming, no extra state stores.

## Non-Goals (v1)

- Editing tables/columns from the grid.
- Expandable per-row column drop-down (planned for a later iteration).
- Multi-select, bulk actions, persisted grid state across view switches.
- Virtualization (not needed at expected dataset sizes).

## Library Choice

**TanStack Table** (`@tanstack/react-table`).

Rationale: headless (~14KB) → markup uses xinemap's CSS variables directly, so light/dark theming requires no bridge. Built-in sort and per-column filter primitives cover all v1 needs. Considered alternatives: AG Grid Community (overkill for view+filter, ~1MB, theme-bridge needed); plain HTML table (would re-implement filter state).

## Architecture

### View mode

Extend the `ViewMode` union in `useDiagramStore` from `'relational' | 'conceptual'` to `'relational' | 'conceptual' | 'tabular'`.

### Components

- **`src/tabular/TabularPanel.tsx`** — top-level pane, sibling to `DiagramPanel`. Owns local sort/filter state, group-filter dropdown, and renders the grid.
- **`src/tabular/TableGrid.tsx`** — thin TanStack Table wrapper. Receives column defs and rows; emits row-click events. Models its API on kolkhis's `ResultsGrid` (a single component that hides library specifics from callers).

### Right-pane switch

Wherever `DiagramPanel` is currently rendered (e.g. `App.tsx` or its parent), branch on `viewMode`:
- `'relational' | 'conceptual'` → `<DiagramPanel />`
- `'tabular'` → `<TabularPanel />`

The editor pane and split layout are untouched.

### Data flow

```
useEditorStore.parseResult.tables (TableInfo[])
    → TabularPanel maps to grid rows
    → TableGrid renders via TanStack Table
    → row click → revealLineInCenter() on the editor
```

`TableInfo` already carries `schema`, `name`, `columns`, `group`, `groupColor`, `note`, and `line`. DV2 entity type is derived using the existing classification path used by `parseResultToConceptualFlow`.

## Grid Specification

### Columns (one row per table)

| # | Column   | Source                                | Notes                                  |
|---|----------|---------------------------------------|----------------------------------------|
| 1 | Schema   | `TableInfo.schema`                    | Sortable, filterable                   |
| 2 | Name     | `TableInfo.name`                      | Sortable, filterable                   |
| 3 | Type     | derived DV2 entity type               | Sortable, filterable; same classifier as the conceptual view |
| 4 | Group    | `TableInfo.group` (+ `groupColor`)    | Color swatch + name; sortable, filterable |
| 5 | Columns  | `TableInfo.columns.length`            | Sortable numeric                       |
| 6 | Note     | `TableInfo.note`                      | Truncated to one line via CSS ellipsis; full text via native `title` attribute (acceptable here — informational only, not a UI affordance) |

### Filtering

- **Primary — Group dropdown** above the grid. Single-select; default "All groups". Options computed from the unique set of `group` values across `parseResult.tables`. Tables without a group fall under an "Ungrouped" option.
- **Secondary — per-column filter inputs** in the column headers (TanStack's built-in `columnFilters` state). Text match for string columns, numeric compare for the count column.

### Sorting

Click column header to toggle asc/desc. Single-column sort.

### Row interaction

- **Click row** → `editorRef.revealLineInCenter(table.line)` + `editor.focus()`, mirroring the node-click behavior in `DiagramPanel`. No persistent selection state.

## View Switcher UI

Convert the existing single toggle button (currently flips Relational ↔ Conceptual) into a **3-state cycle button**:

- Relational → Conceptual → Tabular → Relational

Each state shows its own icon + label, matching the existing button's visual style. Same footprint, minimal markup change.

## Theming

TanStack Table is headless. The grid markup uses existing CSS variables:

- `--c-bg-1` / `--c-bg-2` for row stripes
- `--c-text-1` / `--c-text-3` for cell text and headers
- `--c-border-s` for separators
- Hover row → `--c-bg-3`

Light/dark theme switches automatically with `useThemeStore`.

## State

- `viewMode` — already in `useDiagramStore`; just add the third value.
- Sort and column filters — local `useState` inside `TabularPanel`, **not** persisted. Switching views or reloading resets the grid.
- Group filter — local `useState` inside `TabularPanel`.

No new Zustand store.

## Testing

- Unit: a small TanStack-driven component test that builds a `TableInfo[]` fixture, mounts `TabularPanel`, and asserts (a) all rows render, (b) selecting a group filters rows, (c) sorting by column reorders rows, (d) row click invokes the editor reveal handler (via injected callback).
- No backend changes; no Python tests.

## Out of Scope / Deferred

- **Per-row column drop-down** — expanding a row to show its `ColumnInfo[]`. Planned next iteration.
- **Editing from the grid.**
- **Persisted grid state** (sort/filter) across view switches.
- **Export / copy** of grid contents.
- **Virtualization** — only worth adding if a project ever exceeds a few thousand tables.

## Files Touched (anticipated)

- `src/store/useDiagramStore.ts` — extend `ViewMode`.
- `src/diagram/DiagramPanel.tsx` — replace 2-state toggle with 3-state cycle button.
- `src/tabular/TabularPanel.tsx` — new.
- `src/tabular/TableGrid.tsx` — new.
- `App.tsx` (or parent of `DiagramPanel`) — branch render on `viewMode`.
- `package.json` — add `@tanstack/react-table`.
- Test file alongside the new components.
