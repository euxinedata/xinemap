# Shared View Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the view-mode cycle button and the group filter into a shared `ViewControlsBar` rendered at the top of the right pane, and make the group filter apply to relational and conceptual views as well as tabular.

**Architecture:** Lift `groupFilter` state into `useDiagramStore` so it persists across view switches. Add a `ViewControlsBar` component used by `App.tsx`. `TabularPanel` reads the filter from the store (its local dropdown disappears). `DiagramPanel` trims `parseResult.tables` and `refs` by group before invoking the existing converters.

**Tech Stack:** TypeScript, React 19, Zustand. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-04-27-shared-view-controls-design.md`

**Branch:** `tabular`

---

## File Structure

| Path | Action | Purpose |
|------|--------|---------|
| `src/store/useDiagramStore.ts` | modify | Add `groupFilter` + `setGroupFilter` |
| `src/components/ViewControlsBar.tsx` | create | Shared strip: group dropdown + cycle button + visible-count |
| `src/App.tsx` | modify | Render `<ViewControlsBar />` above the conditional view; remove floating-overlay cycle button |
| `src/tabular/TabularPanel.tsx` | modify | Remove local filter state + header dropdown + count; read filter from store |
| `src/diagram/DiagramPanel.tsx` | modify | Apply group filter to tables + refs before converter |

---

## Important Existing-Code Notes

1. **Filter sentinel.** `UNGROUPED` (`src/tabular/filterTablesByGroup.ts`) is the existing sentinel used to filter tables with no group. Reuse it everywhere — don't introduce a parallel sentinel.

2. **Filter helper reused.** `filterTablesByGroup(tables, groupFilter)` and `listGroups(tables)` already exist and are unit-tested. The bar and the diagram both use them.

3. **Diagram filter implementation point.** The effect at `src/diagram/DiagramPanel.tsx:181-232` converts `parseResult` into nodes/edges. Filter `parseResult` *before* calling the converter rather than after — converters expect refs to point to existing tables.

4. **Sticky notes are not tables.** They live on `parseResult.stickyNotes`, not on `tables`. They must NOT be filtered.

5. **Layout persistence still keys by `viewMode`.** No change to `StoredLayout` is needed; the filter doesn't affect node position storage.

6. **App.tsx currently renders a floating `<ViewModeCycleButton />`** as `absolute top-2 right-2` overlay only when `viewMode === 'tabular'`. The floating overlay is fully replaced by the bar — delete it and the conditional render around it.

7. **DiagramPanel currently renders `<ViewModeCycleButton />` inside its own toolbar** (added in the tabular feature). Remove that instance; the bar is the single home for the button.

---

## Task 1: Add `groupFilter` to `useDiagramStore`

**Files:**
- Modify: `src/store/useDiagramStore.ts`

- [ ] **Step 1: Extend the store**

Open `src/store/useDiagramStore.ts`. In the `DiagramState` interface, add:

```ts
groupFilter: string | null
setGroupFilter: (groupFilter: string | null) => void
```

Place them near the existing `viewMode` / `setViewMode` lines for visual grouping.

In the `create<DiagramState>()` body, add the initial value:

```ts
groupFilter: null,
```

next to the other initial values, and add the setter:

```ts
setGroupFilter: (groupFilter) => set({ groupFilter }),
```

next to the other setters.

- [ ] **Step 2: Verify build**

```
npm run build
```
Expected: build passes.

- [ ] **Step 3: Commit**

```
git add src/store/useDiagramStore.ts
git commit -m "feat: add groupFilter to useDiagramStore"
```

Use commit trailer: `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`

---

## Task 2: Create `ViewControlsBar`

**Files:**
- Create: `src/components/ViewControlsBar.tsx`

- [ ] **Step 1: Implement the bar**

Create `src/components/ViewControlsBar.tsx` with this EXACT content:

```tsx
import { useMemo } from 'react'
import { useEditorStore } from '../store/useEditorStore'
import { useDiagramStore } from '../store/useDiagramStore'
import { ViewModeCycleButton } from './ViewModeCycleButton'
import { filterTablesByGroup, listGroups, UNGROUPED } from '../tabular/filterTablesByGroup'

export function ViewControlsBar() {
  const { parseResult } = useEditorStore()
  const { groupFilter, setGroupFilter } = useDiagramStore()

  const tables = useMemo(() => parseResult?.tables ?? [], [parseResult])
  const groups = useMemo(() => listGroups(tables), [tables])
  const visibleCount = useMemo(
    () => filterTablesByGroup(tables, groupFilter).length,
    [tables, groupFilter],
  )

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[var(--c-border-s)] bg-[var(--c-bg-1)]">
      <label className="text-xs text-[var(--c-text-3)]">Group:</label>
      <select
        value={groupFilter ?? ''}
        onChange={(e) => setGroupFilter(e.target.value === '' ? null : e.target.value)}
        className="bg-[var(--c-bg-3)] border border-[var(--c-border-s)] text-[var(--c-text-1)] text-xs px-2 py-1 rounded"
      >
        <option value="">All groups</option>
        {groups.map((g) => (
          <option key={g} value={g}>
            {g === UNGROUPED ? 'Ungrouped' : g}
          </option>
        ))}
      </select>
      <span className="text-xs text-[var(--c-text-4)]">
        {visibleCount} {visibleCount === 1 ? 'table' : 'tables'}
      </span>
      <div className="ml-auto">
        <ViewModeCycleButton />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

```
npm run build
```
Expected: build passes.

- [ ] **Step 3: Commit**

```
git add src/components/ViewControlsBar.tsx
git commit -m "feat: add shared ViewControlsBar component"
```

Use commit trailer: `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`

---

## Task 3: Wire `ViewControlsBar` into `App.tsx`; remove floating overlay

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Replace the right pane structure**

Open `src/App.tsx`. Currently the file imports `ViewModeCycleButton` and renders it as a floating overlay only in tabular mode. Replace with `ViewControlsBar` rendered above the view in all modes.

(a) **Update imports.** Remove `import { ViewModeCycleButton } from './components/ViewModeCycleButton'`. Add `import { ViewControlsBar } from './components/ViewControlsBar'`.

(b) **Replace the inner right-pane block.** The current block (post-Task-7 of the previous plan) looks like:

```tsx
<div className="relative w-full h-full">
  {viewMode === 'tabular' ? <TabularPanel /> : <DiagramPanel />}
  {viewMode === 'tabular' && (
    <div className="absolute top-2 right-2 z-20">
      <ViewModeCycleButton />
    </div>
  )}
  <button
    onClick={toggleEditor}
    className="editor-toggle-handle"
    title={editorVisible ? 'Hide editor' : 'Show editor'}
  >
    <svg ...>{...}</svg>
  </button>
</div>
```

Replace with:

```tsx
<div className="relative w-full h-full flex flex-col">
  <ViewControlsBar />
  <div className="flex-1 min-h-0 relative">
    {viewMode === 'tabular' ? <TabularPanel /> : <DiagramPanel />}
    <button
      onClick={toggleEditor}
      className="editor-toggle-handle"
      title={editorVisible ? 'Hide editor' : 'Show editor'}
    >
      <svg width="10" height="16" viewBox="0 0 10 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        {editorVisible
          ? <polyline points="7,2 2,8 7,14" />
          : <polyline points="3,2 8,8 3,14" />}
      </svg>
    </button>
  </div>
</div>
```

Notes:
- The outer `relative` wrapper becomes a vertical flex so the bar stays at the top and the view fills the remainder.
- The `editor-toggle-handle` button stays inside the inner `relative` wrapper so its absolute positioning still works against the view area (not the bar).
- The floating cycle-button overlay is gone.

- [ ] **Step 2: Verify build**

```
npm run build
```
Expected: build passes — no unused-import errors.

- [ ] **Step 3: Commit**

```
git add src/App.tsx
git commit -m "feat: render ViewControlsBar above the view; drop floating cycle button"
```

Use commit trailer: `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`

---

## Task 4: TabularPanel reads filter from store; remove local UI

**Files:**
- Modify: `src/tabular/TabularPanel.tsx`

- [ ] **Step 1: Update imports and remove local state**

Open `src/tabular/TabularPanel.tsx`.

(a) Add `useDiagramStore` import:
```ts
import { useDiagramStore } from '../store/useDiagramStore'
```

(b) Drop unused imports if they become unused after the edits below. Keep `useMemo`. **Remove** `useState` from the imports (only used for `groupFilter` today). **Remove** `UNGROUPED` import — no longer referenced in this file.

(c) Inside the component, replace:
```ts
const [groupFilter, setGroupFilter] = useState<string | null>(null)
```
with:
```ts
const groupFilter = useDiagramStore((s) => s.groupFilter)
```

(d) Drop `setGroupFilter` references — it was only used by the local dropdown which is being removed.

(e) Drop the `groups` derivation that's no longer used here:
```ts
const groups = useMemo(() => listGroups(tables), [tables])
```

(f) Update the `listGroups` import to remove that name:
```ts
import { filterTablesByGroup } from './filterTablesByGroup'
```

- [ ] **Step 2: Remove the dropdown header**

In the `return`, replace the entire header block:

```tsx
<div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--c-border-s)]">
  <label className="text-xs text-[var(--c-text-3)]">Group:</label>
  <select
    value={groupFilter ?? ''}
    onChange={(e) => setGroupFilter(e.target.value === '' ? null : e.target.value)}
    className="bg-[var(--c-bg-3)] border border-[var(--c-border-s)] text-[var(--c-text-1)] text-xs px-2 py-1 rounded"
  >
    <option value="">All groups</option>
    {groups.map((g) => (
      <option key={g} value={g}>
        {g === UNGROUPED ? 'Ungrouped' : g}
      </option>
    ))}
  </select>
  <span className="text-xs text-[var(--c-text-4)] ml-auto">
    {rows.length} {rows.length === 1 ? 'table' : 'tables'}
  </span>
</div>
<div className="flex-1 min-h-0">
  <TableGrid data={rows} columns={columns} onRowClick={handleRowClick} />
</div>
```

with the simpler:

```tsx
<div className="flex-1 min-h-0">
  <TableGrid data={rows} columns={columns} onRowClick={handleRowClick} />
</div>
```

The wrapping `<div className="w-full h-full flex flex-col bg-[var(--c-bg-1)]">` stays.

- [ ] **Step 3: Verify build**

```
npm run build
```
Expected: build passes — no unused-variable warnings (`groups`, `listGroups`, `UNGROUPED`, `setGroupFilter`, `useState` should all be cleaned up).

- [ ] **Step 4: Commit**

```
git add src/tabular/TabularPanel.tsx
git commit -m "feat: TabularPanel reads groupFilter from store; remove local header"
```

Use commit trailer: `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`

---

## Task 5: Apply group filter in DiagramPanel

**Files:**
- Modify: `src/diagram/DiagramPanel.tsx`

- [ ] **Step 1: Locate the conversion effect**

In `src/diagram/DiagramPanel.tsx`, find the effect that builds nodes/edges from the parsed DBML. After the previous plans it should be around line 181 and start with:

```ts
useEffect(() => {
  if (!parseResult) {
    setNodes([])
    setEdges([])
    return
  }
  const convert = viewMode === 'conceptual' ? parseResultToConceptualFlow : parseResultToFlow
  ...
```

The `convert(parseResult)` call (or equivalent) is the integration point.

- [ ] **Step 2: Add imports**

At the top of the file:

```ts
import { filterTablesByGroup } from '../tabular/filterTablesByGroup'
```

If not already imported, also add the type import for `ParseResult`:

```ts
import type { ParseResult } from '../types'
```

- [ ] **Step 3: Read groupFilter and pass a filtered ParseResult to the converter**

(a) In the destructure from `useDiagramStore`, add `groupFilter`:

```ts
const { nodes, edges, setNodes, setEdges, onNodesChange, onEdgesChange, layoutMode, setLayoutMode, viewMode, storedLayout, setStoredLayout, groupFilter } = useDiagramStore()
```

(Keep the other fields exactly as they are.)

(b) Inside the conversion `useEffect`, **before** calling `convert(...)`, derive a filtered `ParseResult`:

```ts
const visibleTableIds = new Set(
  filterTablesByGroup(parseResult.tables, groupFilter).map((t) => t.id),
)
const filteredResult: ParseResult = {
  ...parseResult,
  tables: parseResult.tables.filter((t) => visibleTableIds.has(t.id)),
  refs: parseResult.refs.filter(
    (r) => visibleTableIds.has(r.fromTable) && visibleTableIds.has(r.toTable),
  ),
}
```

(c) Replace the existing `convert(parseResult)` call (and any other usage inside this effect that reads `parseResult.tables` / `parseResult.refs`) with `convert(filteredResult)`. **Inside this effect only** — do not change other usages of `parseResult` elsewhere in the file unless they too feed the layout/conversion. Specifically, `dv2Metadata` access stays on `parseResult.dv2Metadata` (or use `filteredResult.dv2Metadata`, equivalent — they share the same Map reference).

(d) Add `groupFilter` to the effect's dependency array. The deps line currently reads:

```ts
}, [parseResult, viewMode, collapsedHubs, setNodes, setEdges, fitView])
```

Update to:

```ts
}, [parseResult, viewMode, collapsedHubs, setNodes, setEdges, fitView, groupFilter])
```

- [ ] **Step 4: Apply the same filter to the auto-layout button handler**

There is a second effect / callback around line 303-330 that re-runs layout when the layout mode is changed. It also calls `convert(...)`. Apply the **same** filtering pattern there:

(a) Compute the same `visibleTableIds` and `filteredResult` at the top of that callback (before `convert`).

(b) Pass `filteredResult` to `convert` instead of `parseResult`.

(c) Make sure the dependency array of that `useCallback` already includes `groupFilter` — if not, add it.

If you find any third site inside this file that calls `convert` or relies on `parseResult.tables` / `parseResult.refs` for rendering, apply the same fix.

- [ ] **Step 5: Remove the inline `<ViewModeCycleButton />` from DiagramPanel's toolbar**

Find the JSX in `DiagramPanel.tsx` that renders `<ViewModeCycleButton />` inside the panel's own controls area (added in the tabular plan). Delete that single JSX line. Remove the `ViewModeCycleButton` import if it becomes unused.

- [ ] **Step 6: Verify build**

```
npm run build
```
Expected: build passes — no unused-import errors.

- [ ] **Step 7: Run all tests**

```
npm run test
```
Expected: 47/47 pass.

- [ ] **Step 8: Commit**

```
git add src/diagram/DiagramPanel.tsx
git commit -m "feat: apply groupFilter to diagram views; drop inline cycle button"
```

Use commit trailer: `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`

---

## Task 6: Manual verification

**No file changes — runtime behavior check.**

- [ ] **Step 1: Start the dev server**

```
npm run dev
```

Open http://localhost:5173.

- [ ] **Step 2: Verify the bar layout**

In every view mode (relational, conceptual, tabular):
- The bar appears at the top of the right pane with `Group:` dropdown on the left, table count, and the cycle button on the right.
- The bar does not jump or disappear when switching views.
- Cycling through Relational → Conceptual → Tabular → Relational keeps the bar pinned in place.

- [ ] **Step 3: Verify filter persistence**

- In tabular mode, select a non-default group from the dropdown. The grid filters to that group; the count updates.
- Switch to relational. Only the tables in that group are visible. Edges to filtered-out tables disappear (because their endpoints don't exist).
- Switch to conceptual. Same — only the matching tables are nodes.
- Switch back to tabular. The filter is still applied; same filtered table count.

- [ ] **Step 4: Verify "Ungrouped"**

- Select "Ungrouped". Verify all three views show only tables that have no `TableGroup` (or none at all in your DBML — the count should match what you'd expect).

- [ ] **Step 5: Verify "All groups"**

- Select "All groups". All tables come back in every view.

- [ ] **Step 6: Sticky notes unaffected**

- If your DBML has sticky notes, they remain visible regardless of group filter. (Diagram views only.)

- [ ] **Step 7: Tabular's local header gone**

- Confirm the tabular pane no longer has its own group dropdown / count above the grid — that UI is now consolidated in the bar.

- [ ] **Step 8: Run full test suite & lint**

```
npm run test
NODE_OPTIONS="--max-old-space-size=8192" npx eslint src/components/ViewControlsBar.tsx src/tabular src/diagram/DiagramPanel.tsx src/App.tsx
```

Expected: tests 47/47 pass; lint reports no NEW errors (the pre-existing `@dbml/core` `any`-typing errors and the TanStack-Table library-hook warning remain unchanged from earlier runs).

---

## Summary of Commits Expected

1. `feat: add groupFilter to useDiagramStore`
2. `feat: add shared ViewControlsBar component`
3. `feat: render ViewControlsBar above the view; drop floating cycle button`
4. `feat: TabularPanel reads groupFilter from store; remove local header`
5. `feat: apply groupFilter to diagram views; drop inline cycle button`

Task 6 is verification only — no commit.

---

## Self-Review Notes (writer)

- **Spec coverage:**
  - Persistent bar at top of right pane → Task 2 + 3.
  - Group filter in store, persists across views → Task 1 + 4 (read from store).
  - Filter applies to relational + conceptual → Task 5.
  - Sticky notes unaffected → Task 5 (we filter `tables` and `refs`, not `stickyNotes`).
  - Tabular's local UI removed → Task 4.
  - Floating cycle-button overlay gone → Task 3.
  - Inline cycle button in DiagramPanel removed → Task 5 step 5.

- **Type/symbol consistency:** `groupFilter` / `setGroupFilter` defined in Task 1 are used identically in Tasks 2, 4, 5. `filterTablesByGroup` and `UNGROUPED` are existing exports, used consistently.

- **Placeholder scan:** No TBDs or hand-waving. The "third site" caveat in Task 5 step 4 is bounded — the implementer is told what to look for and what pattern to apply.
