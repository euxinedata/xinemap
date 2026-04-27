# Tabular View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a third view mode "Tabular" — a sortable, filterable grid of tables — alongside the existing Relational and Conceptual diagram views.

**Architecture:** New `TabularPanel` (sibling to `DiagramPanel`) renders a TanStack Table grid driven by `parseResult.tables`. `App.tsx` swaps between the two panels based on `useDiagramStore.viewMode`. The view-switcher button is extracted to a small shared component used by both panels, cycling through three modes.

**Tech Stack:** React 19, TypeScript, Zustand, **`@tanstack/react-table` v8** (new), Tailwind 4, Vitest. Existing CSS variables (`--c-bg-*`, `--c-text-*`, `--c-border-s`) handle theming.

**Spec:** `docs/superpowers/specs/2026-04-27-tabular-view-design.md`

**Branch:** `tabular`

---

## File Structure

| Path | Action | Purpose |
|------|--------|---------|
| `package.json` | modify | Add `@tanstack/react-table` dependency |
| `src/store/useDiagramStore.ts` | modify | Add `'tabular'` to `ViewMode` |
| `src/tabular/filterTablesByGroup.ts` | create | Pure helper — filter tables by group name (testable) |
| `src/tabular/filterTablesByGroup.test.ts` | create | Vitest tests for the helper |
| `src/tabular/TableGrid.tsx` | create | Thin TanStack Table wrapper with sort + per-column text filter |
| `src/tabular/TabularPanel.tsx` | create | Top-level pane: group dropdown, header, grid, row-click → editor |
| `src/components/ViewModeCycleButton.tsx` | create | Shared button cycling Relational → Conceptual → Tabular → Relational |
| `src/diagram/DiagramPanel.tsx` | modify | Replace inline 2-state toggle with `ViewModeCycleButton`; narrow `viewMode` for `StoredLayout` lookups |
| `src/App.tsx` | modify | Branch right-pane render on `viewMode === 'tabular'` |

---

## Important Existing-Code Notes (for the implementer)

These details matter and aren't obvious from a fresh read:

1. **`TableInfo` already has the data we need.** See `src/types/index.ts:37-50`. Fields used: `id`, `schema`, `name`, `columns`, `group`, `groupColor`, `note`, `line`.

2. **DV2 entity type lives on `parseResult.dv2Metadata`**, a `Map<tableId, { entityType: DV2EntityType, ... }>`. Look up with `parseResult.dv2Metadata.get(table.id)?.entityType`. Do **not** re-derive — the parser already does this.

3. **Editor reveal uses a store callback, not a ref.** `useEditorStore.scrollToLine(line)` is set by `EditorPanel` on mount (see `src/store/useEditorStore.ts:10` and `src/editor/EditorPanel.tsx:20`). Calling it from `TabularPanel` works the same way as `DiagramPanel.tsx:360` does today.

4. **`StoredLayout` is keyed by view mode** (`src/types/index.ts:163-168`) but only for views with positions. After adding `'tabular'` to `ViewMode`, TypeScript will complain at `DiagramPanel.tsx:190` and similar lines where `storedLayout?.[viewMode]` is indexed. Since `DiagramPanel` is **only rendered when `viewMode !== 'tabular'`** (per the new `App.tsx` switch), narrow the index expression with a cast: `storedLayout?.[viewMode as 'relational' | 'conceptual']`. Apply this consistently at every `storedLayout?.[viewMode]` and `[viewMode]: ...` site inside `DiagramPanel.tsx`.

5. **The existing toggle button** is at `DiagramPanel.tsx:590-599`. It is replaced wholesale (not augmented) by `<ViewModeCycleButton />` to keep the same visual footprint.

6. **No component-level testing infrastructure exists.** The repo's tests are pure-function vitest suites (see `src/export/exportDV4dbt.test.ts` for the pattern). Do **not** add `@testing-library/react` or `jsdom` — keep the testable logic in a pure helper (`filterTablesByGroup`) and verify components manually via `npm run dev`. This matches the project's "minimal dependencies" guidance.

---

## Task 1: Add TanStack Table dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install the package**

Run from repo root:
```bash
npm install @tanstack/react-table
```

Expected: `@tanstack/react-table` (v8.x) added to `dependencies`. `package-lock.json` updates.

- [ ] **Step 2: Verify type-check still passes**

```bash
npm run build
```

Expected: TypeScript and Vite build succeed (no source changes yet).

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: add @tanstack/react-table dependency"
```

---

## Task 2: Extend `ViewMode` and patch `DiagramPanel` type narrowing

**Files:**
- Modify: `src/store/useDiagramStore.ts`
- Modify: `src/diagram/DiagramPanel.tsx`

- [ ] **Step 1: Extend the `ViewMode` union**

In `src/store/useDiagramStore.ts:6`, change:
```ts
export type ViewMode = 'relational' | 'conceptual'
```
to:
```ts
export type ViewMode = 'relational' | 'conceptual' | 'tabular'
```

- [ ] **Step 2: Run the type-check to find breakage**

```bash
npm run build
```

Expected: TypeScript errors at `src/diagram/DiagramPanel.tsx:190`, `:293`, `:303`, `:325` (and possibly the `toggleView` callback at `:340`) where `viewMode` is used as a `StoredLayout` index or compared to non-tabular literals.

- [ ] **Step 3: Narrow `viewMode` for `StoredLayout` lookups in `DiagramPanel.tsx`**

Inside `DiagramPanel.tsx`, every site that indexes `storedLayout` with `viewMode` must be cast to the diagram-only subset.

Add this local alias near the top of the component body (after the `useDiagramStore()` destructure, around line 99):
```ts
type DiagramViewMode = Exclude<ViewMode, 'tabular'>
const dvm = viewMode as DiagramViewMode
```

(Add the `ViewMode` import if not already present: `import type { ViewMode } from '../store/useDiagramStore'`.)

Replace every occurrence of `[viewMode]` used as a `StoredLayout` key with `[dvm]`. Specifically:
- Line ~190: `storedLayout?.[viewMode]` → `storedLayout?.[dvm]`
- Line ~227: `savePositions(laid, viewMode)` → `savePositions(laid, dvm)`
- Line ~232: `[parseResult, viewMode, ...]` deps → keep `viewMode` (still the source of truth for re-runs)
- Line ~293: `storedLayout?.[viewMode]` → `storedLayout?.[dvm]`
- Line ~303: `[viewMode]: undefined` → `[dvm]: undefined`
- Line ~325: `[viewMode]: positions` → `[dvm]: positions`

For `savePositions`, find its declaration and tighten its parameter type to `DiagramViewMode` (or `Exclude<ViewMode, 'tabular'>`) so the cast site is the only `as` cast.

For `toggleView` at lines ~337-342: this entire function is removed in **Task 6** and replaced by the shared cycle button — but for now, just patch the type so the build is green:
```ts
const toggleView = useCallback(() => {
  if (viewMode === 'tabular') return
  savePositions(useDiagramStore.getState().nodes, viewMode)
  const next: ViewMode = viewMode === 'relational' ? 'conceptual' : 'relational'
  setViewMode(next)
}, [viewMode, setViewMode, savePositions])
```

- [ ] **Step 4: Re-run the type-check**

```bash
npm run build
```

Expected: build passes.

- [ ] **Step 5: Commit**

```bash
git add src/store/useDiagramStore.ts src/diagram/DiagramPanel.tsx
git commit -m "feat: extend ViewMode with 'tabular'; narrow diagram-only key access"
```

---

## Task 3: Pure helper `filterTablesByGroup` with tests

**Files:**
- Create: `src/tabular/filterTablesByGroup.ts`
- Create: `src/tabular/filterTablesByGroup.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/tabular/filterTablesByGroup.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { filterTablesByGroup, listGroups, UNGROUPED } from './filterTablesByGroup'
import type { TableInfo } from '../types'

function t(name: string, group?: string): TableInfo {
  return {
    id: `public.${name}`,
    schema: 'public',
    name,
    columns: [],
    group,
  }
}

describe('filterTablesByGroup', () => {
  const tables: TableInfo[] = [
    t('h_customer', 'raw_vault'),
    t('s_customer', 'raw_vault'),
    t('rep_sales'),
    t('dim_date', 'mart'),
  ]

  it('returns all tables when filter is null', () => {
    expect(filterTablesByGroup(tables, null)).toHaveLength(4)
  })

  it('filters by group name', () => {
    const result = filterTablesByGroup(tables, 'raw_vault')
    expect(result.map((x) => x.name)).toEqual(['h_customer', 's_customer'])
  })

  it('filters ungrouped tables via the UNGROUPED sentinel', () => {
    const result = filterTablesByGroup(tables, UNGROUPED)
    expect(result.map((x) => x.name)).toEqual(['rep_sales'])
  })

  it('returns empty when group not found', () => {
    expect(filterTablesByGroup(tables, 'nonexistent')).toEqual([])
  })
})

describe('listGroups', () => {
  const tables: TableInfo[] = [
    t('h_customer', 'raw_vault'),
    t('s_customer', 'raw_vault'),
    t('rep_sales'),
    t('dim_date', 'mart'),
  ]

  it('returns sorted unique group names plus the ungrouped marker when present', () => {
    expect(listGroups(tables)).toEqual(['mart', 'raw_vault', UNGROUPED])
  })

  it('omits the ungrouped marker when every table has a group', () => {
    const grouped = tables.filter((x) => x.group)
    expect(listGroups(grouped)).toEqual(['mart', 'raw_vault'])
  })

  it('returns an empty list when there are no tables', () => {
    expect(listGroups([])).toEqual([])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test -- filterTablesByGroup
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the helper**

Create `src/tabular/filterTablesByGroup.ts`:
```ts
import type { TableInfo } from '../types'

export const UNGROUPED = '__ungrouped__'

export function filterTablesByGroup(
  tables: TableInfo[],
  group: string | null,
): TableInfo[] {
  if (group === null) return tables
  if (group === UNGROUPED) return tables.filter((t) => !t.group)
  return tables.filter((t) => t.group === group)
}

export function listGroups(tables: TableInfo[]): string[] {
  const names = new Set<string>()
  let hasUngrouped = false
  for (const t of tables) {
    if (t.group) names.add(t.group)
    else hasUngrouped = true
  }
  const sorted = Array.from(names).sort()
  if (hasUngrouped) sorted.push(UNGROUPED)
  return sorted
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test -- filterTablesByGroup
```

Expected: PASS — all 7 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/tabular/filterTablesByGroup.ts src/tabular/filterTablesByGroup.test.ts
git commit -m "feat: add filterTablesByGroup helper with tests"
```

---

## Task 4: `TableGrid` — TanStack Table wrapper

**Files:**
- Create: `src/tabular/TableGrid.tsx`

- [ ] **Step 1: Implement `TableGrid`**

Create `src/tabular/TableGrid.tsx`:
```tsx
import { useState } from 'react'
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
} from '@tanstack/react-table'

interface TableGridProps<T> {
  data: T[]
  columns: ColumnDef<T>[]
  onRowClick?: (row: T) => void
}

export function TableGrid<T>({ data, columns, onRowClick }: TableGridProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  return (
    <div className="w-full h-full overflow-auto text-xs">
      <table className="w-full border-collapse">
        <thead className="sticky top-0 bg-[var(--c-bg-2)] z-10">
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id} className="border-b border-[var(--c-border-s)]">
              {hg.headers.map((h) => {
                const sortDir = h.column.getIsSorted()
                return (
                  <th
                    key={h.id}
                    className="text-left text-[var(--c-text-3)] font-medium px-2 py-1.5 select-none"
                  >
                    <div
                      className="flex items-center gap-1 cursor-pointer hover:text-[var(--c-text-1)]"
                      onClick={h.column.getToggleSortingHandler()}
                    >
                      {flexRender(h.column.columnDef.header, h.getContext())}
                      {sortDir === 'asc' && <span>↑</span>}
                      {sortDir === 'desc' && <span>↓</span>}
                    </div>
                    {h.column.getCanFilter() && (
                      <input
                        value={(h.column.getFilterValue() as string) ?? ''}
                        onChange={(e) => h.column.setFilterValue(e.target.value)}
                        placeholder="filter…"
                        className="mt-1 w-full bg-[var(--c-bg-1)] border border-[var(--c-border-s)] rounded px-1 py-0.5 text-[var(--c-text-1)] placeholder:text-[var(--c-text-4)]"
                        onClick={(e) => e.stopPropagation()}
                      />
                    )}
                  </th>
                )
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              className="border-b border-[var(--c-border-s)] hover:bg-[var(--c-bg-3)] cursor-pointer"
              onClick={() => onRowClick?.(row.original)}
            >
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="px-2 py-1 text-[var(--c-text-1)] align-top">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 2: Verify the build**

```bash
npm run build
```

Expected: build passes (component is exported but not yet used; no rendering errors).

- [ ] **Step 3: Commit**

```bash
git add src/tabular/TableGrid.tsx
git commit -m "feat: add TableGrid TanStack Table wrapper"
```

---

## Task 5: `TabularPanel` — full pane with group dropdown

**Files:**
- Create: `src/tabular/TabularPanel.tsx`

- [ ] **Step 1: Implement `TabularPanel`**

Create `src/tabular/TabularPanel.tsx`:
```tsx
import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { useEditorStore } from '../store/useEditorStore'
import { TableGrid } from './TableGrid'
import { filterTablesByGroup, listGroups, UNGROUPED } from './filterTablesByGroup'
import type { TableInfo, DV2EntityType } from '../types'

interface Row {
  id: string
  schema: string
  name: string
  type: DV2EntityType | ''
  group: string
  groupColor: string | null
  columnCount: number
  note: string
  line: number | null
}

export function TabularPanel() {
  const { parseResult } = useEditorStore()
  const [groupFilter, setGroupFilter] = useState<string | null>(null)

  const tables: TableInfo[] = parseResult?.tables ?? []
  const groups = useMemo(() => listGroups(tables), [tables])

  const filteredTables = useMemo(
    () => filterTablesByGroup(tables, groupFilter),
    [tables, groupFilter],
  )

  const rows: Row[] = useMemo(
    () =>
      filteredTables.map((t) => ({
        id: t.id,
        schema: t.schema,
        name: t.name,
        type: parseResult?.dv2Metadata.get(t.id)?.entityType ?? '',
        group: t.group ?? '',
        groupColor: t.groupColor ?? null,
        columnCount: t.columns.length,
        note: t.note ?? '',
        line: t.line ?? null,
      })),
    [filteredTables, parseResult],
  )

  const columns: ColumnDef<Row>[] = useMemo(
    () => [
      { accessorKey: 'schema', header: 'Schema' },
      { accessorKey: 'name', header: 'Name' },
      { accessorKey: 'type', header: 'Type' },
      {
        accessorKey: 'group',
        header: 'Group',
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5">
            {row.original.groupColor && (
              <span
                className="inline-block w-2.5 h-2.5 rounded-sm border border-[var(--c-border-s)]"
                style={{ background: row.original.groupColor }}
              />
            )}
            <span>{row.original.group}</span>
          </div>
        ),
      },
      {
        accessorKey: 'columnCount',
        header: 'Columns',
        cell: ({ getValue }) => <span className="tabular-nums">{getValue<number>()}</span>,
        enableColumnFilter: false,
      },
      {
        accessorKey: 'note',
        header: 'Note',
        cell: ({ getValue }) => {
          const v = getValue<string>()
          return (
            <span
              title={v}
              className="block max-w-[40ch] overflow-hidden text-ellipsis whitespace-nowrap text-[var(--c-text-3)]"
            >
              {v}
            </span>
          )
        },
      },
    ],
    [],
  )

  function handleRowClick(row: Row) {
    if (row.line != null) {
      useEditorStore.getState().scrollToLine?.(row.line)
    }
  }

  return (
    <div className="w-full h-full flex flex-col bg-[var(--c-bg-1)]">
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
    </div>
  )
}
```

- [ ] **Step 2: Verify the build**

```bash
npm run build
```

Expected: build passes.

- [ ] **Step 3: Commit**

```bash
git add src/tabular/TabularPanel.tsx
git commit -m "feat: add TabularPanel with group filter and row→editor reveal"
```

---

## Task 6: Shared `ViewModeCycleButton` and integration

**Files:**
- Create: `src/components/ViewModeCycleButton.tsx`
- Modify: `src/diagram/DiagramPanel.tsx`

- [ ] **Step 1: Implement the shared cycle button**

Create `src/components/ViewModeCycleButton.tsx`:
```tsx
import { useDiagramStore, type ViewMode } from '../store/useDiagramStore'

const ORDER: ViewMode[] = ['relational', 'conceptual', 'tabular']

const LABEL: Record<ViewMode, string> = {
  relational: 'Relational',
  conceptual: 'Conceptual',
  tabular: 'Tabular',
}

function Icon({ mode }: { mode: ViewMode }) {
  if (mode === 'relational') {
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="1" width="5" height="3" rx="0.5" />
        <rect x="8" y="1" width="5" height="3" rx="0.5" />
        <rect x="1" y="6" width="5" height="3" rx="0.5" />
        <rect x="8" y="10" width="5" height="3" rx="0.5" />
        <line x1="6" y1="2.5" x2="8" y2="2.5" />
        <line x1="3.5" y1="4" x2="3.5" y2="6" />
        <line x1="6" y1="7.5" x2="8" y2="12" />
      </svg>
    )
  }
  if (mode === 'conceptual') {
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="7" cy="4" r="2.5" />
        <rect x="1" y="9" width="4" height="2.5" rx="0.5" />
        <rect x="9" y="9" width="4" height="2.5" rx="0.5" />
        <line x1="5.5" y1="6" x2="3" y2="9" />
        <line x1="8.5" y1="6" x2="11" y2="9" />
      </svg>
    )
  }
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1.5" y="1.5" width="11" height="11" rx="0.5" />
      <line x1="1.5" y1="5" x2="12.5" y2="5" />
      <line x1="1.5" y1="8.5" x2="12.5" y2="8.5" />
      <line x1="5" y1="1.5" x2="5" y2="12.5" />
    </svg>
  )
}

export function ViewModeCycleButton() {
  const { viewMode, setViewMode } = useDiagramStore()
  const next = ORDER[(ORDER.indexOf(viewMode) + 1) % ORDER.length]
  return (
    <button
      onClick={() => setViewMode(next)}
      title={`Switch to ${LABEL[next]}`}
      className="flex items-center gap-1.5 bg-[var(--c-bg-3)] border border-[var(--c-border-s)] text-[var(--c-text-3)] hover:text-[var(--c-text-1)] text-xs px-2 py-1 rounded"
    >
      <Icon mode={viewMode} />
      {LABEL[viewMode]}
    </button>
  )
}
```

- [ ] **Step 2: Replace the inline toggle in `DiagramPanel.tsx`**

In `src/diagram/DiagramPanel.tsx`:

(a) Add the import near the top:
```ts
import { ViewModeCycleButton } from '../components/ViewModeCycleButton'
```

(b) Delete the existing `toggleView` `useCallback` declaration (lines ~337-342, including the whole function and the blank line after).

(c) Remove `setViewMode` from the destructure on line 98 if it is no longer used elsewhere in the file (check after deleting `toggleView`).

(d) Replace the inline button block at lines ~590-599:
```tsx
<button
  onClick={toggleView}
  className="..."
>
  {viewMode === 'relational' ? <svg.../> : <svg.../>}
  {viewMode === 'relational' ? 'Relational' : 'Conceptual'}
</button>
```
with:
```tsx
<ViewModeCycleButton />
```

- [ ] **Step 3: Verify the build**

```bash
npm run build
```

Expected: build passes; no `toggleView`-related errors and no unused-import warnings.

- [ ] **Step 4: Commit**

```bash
git add src/components/ViewModeCycleButton.tsx src/diagram/DiagramPanel.tsx
git commit -m "feat: add ViewModeCycleButton and use it in DiagramPanel"
```

---

## Task 7: Wire `TabularPanel` into `App.tsx`

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Branch the right pane render on `viewMode`**

In `src/App.tsx`:

(a) Add imports:
```ts
import { TabularPanel } from './tabular/TabularPanel'
import { ViewModeCycleButton } from './components/ViewModeCycleButton'
import { useDiagramStore } from './store/useDiagramStore'
```

(b) In the component body, before `return`, read the view mode:
```ts
const viewMode = useDiagramStore((s) => s.viewMode)
```

(c) Replace lines 36-49 (the inner `<div className="relative w-full h-full">…</div>` block) with:
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
    <svg width="10" height="16" viewBox="0 0 10 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {editorVisible
        ? <polyline points="7,2 2,8 7,14" />
        : <polyline points="3,2 8,8 3,14" />}
    </svg>
  </button>
</div>
```

Rationale: when in tabular mode, `DiagramPanel` is unmounted — so its toolbar (which contains the cycle button) is gone too. We render a floating cycle button in the same top-right area so the user can leave tabular mode. In diagram mode, the button stays inside `DiagramPanel`'s existing toolbar.

- [ ] **Step 2: Verify the build**

```bash
npm run build
```

Expected: build passes.

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: render TabularPanel when viewMode is tabular"
```

---

## Task 8: Manual verification

**No file changes — runtime behavior check.**

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

Open http://localhost:5173 in a browser.

- [ ] **Step 2: Verify cycle button works in all three states**

In DBML editor, paste a sample with table groups (or open an existing project). Click the cycle button repeatedly:

- Relational → Conceptual → Tabular → Relational → …

Expected:
- Each click changes the right-pane view.
- The button label and icon update to match the current view.

- [ ] **Step 3: Verify tabular view content**

In Tabular mode, confirm:

- One row per parsed table.
- Columns: Schema, Name, Type, Group (with color swatch), Columns, Note.
- "N tables" count in the header matches the row count.
- Per-column filter inputs filter rows live.
- Clicking a column header sorts asc, click again sorts desc.

- [ ] **Step 4: Verify group dropdown**

- Default is "All groups".
- Selecting a specific group filters rows to that group only.
- Selecting "Ungrouped" shows only tables with no group.
- Row count updates to match.

- [ ] **Step 5: Verify row click → editor reveal**

- Open the editor pane (if hidden, toggle it visible).
- Click any row in the tabular view.
- The Monaco editor scrolls to and centers that table's line.

- [ ] **Step 6: Verify theming**

- Toggle light/dark theme via the toolbar button.
- Tabular view (header, rows, dropdown, filter inputs, hover) recolors correctly using existing CSS variables.

- [ ] **Step 7: Verify diagram views still work**

- Switch back to Relational. Confirm diagram renders, layout persists, node click still reveals editor line, layout-mode controls still function.
- Switch to Conceptual. Confirm same.
- Switch back to Tabular. Confirm grid state was reset (sort/filters cleared) — this is expected per spec.

- [ ] **Step 8: Run full test suite**

```bash
npm run test
```

Expected: all tests pass (existing + new `filterTablesByGroup` tests).

- [ ] **Step 9: Run lint**

```bash
npm run lint
```

Expected: no new errors.

- [ ] **Step 10: Final commit (if any housekeeping)**

If steps 2-9 surfaced any small fixes, commit them here:

```bash
git add -u
git commit -m "fix: <describe issue>"
```

Otherwise skip. Push the branch when ready:

```bash
git push -u origin tabular
```

---

## Summary of Commits Expected

1. `feat: add @tanstack/react-table dependency`
2. `feat: extend ViewMode with 'tabular'; narrow diagram-only key access`
3. `feat: add filterTablesByGroup helper with tests`
4. `feat: add TableGrid TanStack Table wrapper`
5. `feat: add TabularPanel with group filter and row→editor reveal`
6. `feat: add ViewModeCycleButton and use it in DiagramPanel`
7. `feat: render TabularPanel when viewMode is tabular`
8. (optional) `fix: <housekeeping>` from manual verification

---

## Self-Review Notes (writer)

- Spec coverage: ✅ all spec sections (architecture, columns, filtering, interactions, switcher, theming, state, deferred items) map to tasks 1-8.
- Type narrowing for `StoredLayout` indexing is explicitly handled in Task 2.
- The "row click reveals editor line" mechanic uses the existing `useEditorStore.scrollToLine` callback — no new wiring needed.
- Tests are limited to the pure helper (`filterTablesByGroup`) per the project's existing test pattern; no new test infrastructure introduced.
- The cycle button is duplicated visually only when needed (floating in tabular mode); the canonical instance lives in `DiagramPanel`'s existing toolbar.
