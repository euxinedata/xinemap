# Shared View Controls — Design

**Date:** 2026-04-27
**Branch:** `tabular`
**Status:** Approved, pending implementation plan

## Summary

Replace the floating cycle-button overlay (used only in tabular mode) with a thin, always-rendered control strip at the top of the right pane. Move the view-mode cycle button and the group filter into this strip so they live in a single, persistent location across all three views. The group filter becomes a global filter that hides non-matching tables in every view.

## Goals

- One predictable location for cross-cutting view controls.
- One group filter that applies consistently across relational, conceptual, and tabular.
- Filter state persists across view switches.

## Non-Goals

- Moving view-specific controls (layout mode, browse panel, alignment/distribution palette) — they stay inside `DiagramPanel`'s existing toolbars.
- Adding new filter dimensions beyond `group`.
- Persisting the filter to disk (it's session state, like other view state).

## UI Layout

A new `<ViewControlsBar />` component renders as a thin strip inside the right `Allotment.Pane`, above the view (DiagramPanel or TabularPanel). Approximate layout:

```
┌─ right pane ──────────────────────────────────────────────┐
│  [Group: All groups ▾]   [N tables]              [Tabular]│  ← ViewControlsBar
├──────────────────────────────────────────────────────────┤
│                                                          │
│   <DiagramPanel /> or <TabularPanel />                   │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

- **Left:** Group filter dropdown (existing options: "All groups", every unique group name, "Ungrouped"). Plus a small `N tables` count showing how many tables are visible after filtering.
- **Right:** the existing `<ViewModeCycleButton />`.
- Styling: matches the existing app — `--c-bg-1` background, `--c-border-s` bottom border, ~32px tall.

## State

Add to `useDiagramStore`:

```ts
groupFilter: string | null   // null = "All groups"; string = group name; UNGROUPED sentinel for ungrouped tables
setGroupFilter: (g: string | null) => void
```

`groupFilter` persists across view switches (no reset). It is **not** persisted to project storage (matches other in-memory diagram state like sort/filter in the tabular view).

## Filter Behavior

The existing helper `filterTablesByGroup` (`src/tabular/filterTablesByGroup.ts`) is reused as the single source of truth for "which tables match the current filter".

### Tabular view
- `TabularPanel` reads `groupFilter` from `useDiagramStore` instead of holding it locally.
- The local `useState` for the filter is removed.
- The local Group dropdown in `TabularPanel`'s header is **removed** (now lives in `ViewControlsBar`).
- The `N tables` count moves to the bar (or is shown in both — simpler to drop from the panel and show only in the bar).

### Relational and Conceptual views
- `DiagramPanel` filters the node list by `groupFilter` before passing it to `parseResultToFlow` / `parseResultToConceptualFlow`.
- Sticky notes are unaffected by the filter.
- Edges with a hidden source or target are dropped.
- The filter applies to the existing `parseResult.tables`; it does not change parsing — purely a render-time filter.

### Implementation point

The cleanest hook is in `DiagramPanel`'s effect that builds nodes/edges (the `useEffect` around line 181). Before invoking `parseResultToFlow` / `parseResultToConceptualFlow`, filter the table set:

```ts
const visibleTableIds = new Set(filterTablesByGroup(parseResult.tables, groupFilter).map(t => t.id))
const filteredResult: ParseResult = {
  ...parseResult,
  tables: parseResult.tables.filter(t => visibleTableIds.has(t.id)),
  refs: parseResult.refs.filter(r => visibleTableIds.has(r.fromTable) && visibleTableIds.has(r.toTable)),
}
const { nodes, edges } = convert(filteredResult)
```

Pass `filteredResult` to the existing converter; everything downstream (layout, edge handles, etc.) works unchanged.

### Tabular view
Continues to work via the same `filterTablesByGroup` helper, just reading state from the store rather than local React state.

## Files Touched (anticipated)

- `src/store/useDiagramStore.ts` — add `groupFilter` + `setGroupFilter`.
- `src/components/ViewControlsBar.tsx` — new shared strip component.
- `src/App.tsx` — render `<ViewControlsBar />` above the conditional view; remove the floating cycle-button overlay.
- `src/diagram/DiagramPanel.tsx` — remove `<ViewModeCycleButton />` from the inner toolbar; apply `groupFilter` to nodes/edges before conversion.
- `src/tabular/TabularPanel.tsx` — remove local `groupFilter` state, dropdown, and count from the header; read filter from store.

## Out of Scope / Deferred

- Multi-select group filter (multiple groups at once).
- Filter chips beyond group (schema, DV2 type, name regex).
- Persisting filter state in the project file.
- Animating node enter/exit transitions when the filter changes.
