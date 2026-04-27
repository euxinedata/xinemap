# DV2 Note Markers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace TableGroup-prefix and TablePartial-name DV2 classification with explicit table-note markers (`**HUB**`, `**SAT**`, `**LNK**`, `**REF**`), recolor Reference to orange, and route unmarked tables through the existing neutral `ConceptNode` rendering.

**Architecture:** Add a pure `entityTypeFromNote` helper to the parser, rewire `parseDbml.ts` Pass-1 to populate `dv2Metadata` only for marker-tagged tables, switch `conceptualToFlow.ts` from group-prefix routing to `dv2Metadata` lookup, and update `dv2Colors.ts`. Sparseness in `dv2Metadata` (no entry → unmarked) is the new representation of "unclassified".

**Tech Stack:** TypeScript, Vitest. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-04-27-dv2-note-markers-design.md`

**Branch:** `tabular` (continues from the tabular view feature; can be split if you prefer)

---

## File Structure

| Path | Action | Purpose |
|------|--------|---------|
| `src/parser/entityTypeFromNote.ts` | create | Pure helper — regex-match marker in note string, return `DV2EntityType \| null` |
| `src/parser/entityTypeFromNote.test.ts` | create | Vitest tests for the helper |
| `src/parser/parseDbml.ts` | modify | Drop `entityTypeFromPartials`, `entityTypeFromGroup`, `entityHintMap`; rewire Pass-1 to use the new helper |
| `src/parser/conceptualToFlow.ts` | modify | Replace `nodeTypeFromGroup` with `nodeTypeFromEntity` driven by `dv2Metadata` |
| `src/diagram/dv2Colors.ts` | modify | Update `reference` color trio from slate gray to orange |

---

## Important Existing-Code Notes (for the implementer)

1. **Two classification sites today, not one.** Both must change:
   - `src/parser/parseDbml.ts:13-30` — `entityTypeFromPartials` + `entityTypeFromGroup`. Used in Pass-1 at line 205.
   - `src/parser/conceptualToFlow.ts:5-12` — `nodeTypeFromGroup`. Used at line 21 to pick which React Flow node type renders each table in conceptual view.

2. **Column-level markers (`**hk**`, `**bk**`, etc.) are unrelated and must be preserved.** They live in column notes, parsed by `parseDV2Role(field.note)` at `parseDbml.ts:110`. This change only affects table-level entity classification.

3. **`dv2Metadata` becomes sparse.** Today every table has an entry (defaults to `reference`). After this change, only marker-tagged tables have an entry. Existing call sites already use the safe pattern `dv2Metadata.get(id)?.entityType` and treat `undefined` correctly:
   - `dv2EdgeColor` at `src/diagram/dv2Colors.ts:10-17` — already handles `undefined`.
   - `parseResultToFlow` and friends use the optional-chained form.
   - `TabularPanel` in `src/tabular/TabularPanel.tsx` already uses `... ?? ''`.
   No additional defensive code is needed at consumers.

4. **`ConceptNode.tsx` already renders neutrally** (uses `var(--c-bg-3)`, `var(--c-border-s)`, `var(--c-text-1)`). No changes needed there — once `nodeTypeFromEntity` returns `'conceptNode'` for unmarked tables, they automatically get the gray-styled rendering the spec calls for.

5. **`partials` extraction in `parseDbml.ts:62`** (`const partials = (table as any).partials ?? []`) is currently used only by `entityTypeFromPartials`. Remove it along with `entityHintMap` to avoid dead code.

6. **Group still has uses.** Don't delete `groupMap` or the `group?` field on `TableInfo` — they're used by the tabular view's group filter and the diagram's tooling. Only the *DV2-classification* role of `group` goes away.

---

## Task 1: Pure `entityTypeFromNote` helper with TDD tests

**Files:**
- Create: `src/parser/entityTypeFromNote.ts`
- Create: `src/parser/entityTypeFromNote.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/parser/entityTypeFromNote.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { entityTypeFromNote } from './entityTypeFromNote'

describe('entityTypeFromNote', () => {
  it('returns null when note is undefined', () => {
    expect(entityTypeFromNote(undefined)).toBeNull()
  })

  it('returns null when note is empty', () => {
    expect(entityTypeFromNote('')).toBeNull()
  })

  it('returns null for note with no marker', () => {
    expect(entityTypeFromNote('Customer master entity')).toBeNull()
  })

  it('detects HUB marker', () => {
    expect(entityTypeFromNote('**HUB** Customer master.')).toBe('hub')
  })

  it('detects SAT marker', () => {
    expect(entityTypeFromNote('**SAT** Customer demographics.')).toBe('satellite')
  })

  it('detects LNK marker', () => {
    expect(entityTypeFromNote('**LNK** Order ↔ customer.')).toBe('link')
  })

  it('detects REF marker', () => {
    expect(entityTypeFromNote('**REF** ISO country codes.')).toBe('reference')
  })

  it('matches case-insensitively (lowercase)', () => {
    expect(entityTypeFromNote('**hub** lowercase form')).toBe('hub')
    expect(entityTypeFromNote('**sat** lowercase form')).toBe('satellite')
    expect(entityTypeFromNote('**lnk** lowercase form')).toBe('link')
    expect(entityTypeFromNote('**ref** lowercase form')).toBe('reference')
  })

  it('matches case-insensitively (mixed case)', () => {
    expect(entityTypeFromNote('**Hub** mixed case')).toBe('hub')
    expect(entityTypeFromNote('**SaT** mixed case')).toBe('satellite')
  })

  it('matches markers anywhere in the note', () => {
    expect(entityTypeFromNote('Customer master. **HUB** of the party model.')).toBe('hub')
    expect(entityTypeFromNote('Trailing marker **LNK**')).toBe('link')
  })

  it('returns the first marker when multiple are present', () => {
    expect(entityTypeFromNote('**SAT** then **HUB** later')).toBe('satellite')
    expect(entityTypeFromNote('**LNK** wins over **REF**')).toBe('link')
  })

  it('does not match partial words (e.g. **HUBS**)', () => {
    expect(entityTypeFromNote('**HUBS** plural form')).toBeNull()
    expect(entityTypeFromNote('**HUBA** typo')).toBeNull()
  })

  it('does not match without the asterisks', () => {
    expect(entityTypeFromNote('HUB without bold')).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail with module-not-found**

```
npm run test -- entityTypeFromNote
```
Expected: FAIL — module './entityTypeFromNote' not found.

- [ ] **Step 3: Implement the helper**

Create `src/parser/entityTypeFromNote.ts`:

```ts
import type { DV2EntityType } from '../types'

const MARKER_TO_TYPE: Record<string, DV2EntityType> = {
  HUB: 'hub',
  SAT: 'satellite',
  LNK: 'link',
  REF: 'reference',
}

const MARKER_REGEX = /\*\*(HUB|SAT|LNK|REF)\*\*/i

export function entityTypeFromNote(note: string | undefined): DV2EntityType | null {
  if (!note) return null
  const match = MARKER_REGEX.exec(note)
  if (!match) return null
  return MARKER_TO_TYPE[match[1].toUpperCase()] ?? null
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
npm run test -- entityTypeFromNote
```
Expected: PASS — all 13 tests green.

- [ ] **Step 5: Commit**

```
git add src/parser/entityTypeFromNote.ts src/parser/entityTypeFromNote.test.ts
git commit -m "feat: add entityTypeFromNote helper with tests"
```

Use commit trailer: `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`

---

## Task 2: Rewire `parseDbml.ts` Pass-1 to use the note marker

**Files:**
- Modify: `src/parser/parseDbml.ts`

- [ ] **Step 1: Add the import**

At the top of `src/parser/parseDbml.ts`, alongside the other imports, add:

```ts
import { entityTypeFromNote } from './entityTypeFromNote'
```

- [ ] **Step 2: Delete `entityTypeFromPartials` and `entityTypeFromGroup`**

Remove **lines 13-30** of `src/parser/parseDbml.ts` — the two helper functions and the blank line between them. After deletion, line 12's blank line should be followed directly by `export function parseDbml(source: string): ParseResult {`.

(The functions to delete are:
```ts
function entityTypeFromPartials(partials: any[]): DV2EntityType | null { ... }
function entityTypeFromGroup(group: string): DV2EntityType { ... }
```
)

- [ ] **Step 3: Remove `entityHintMap` and the partials extraction**

Inside `parseDbml`, locate and remove these two blocks:

(a) The map declaration (currently around line 52-53):
```ts
// Store entity type hints from partials (keyed by tableId)
const entityHintMap = new Map<string, DV2EntityType>()
```

(b) The hint population inside the table-loop (currently around lines 61-64):
```ts
// Extract entity type from TablePartial injections
const partials = (table as any).partials ?? []
const hint = entityTypeFromPartials(partials)
if (hint) entityHintMap.set(tableId, hint)
```

After deletion the loop body should start (after the `tableId` line) directly with the existing `const tableLine = ...` line.

- [ ] **Step 4: Replace Pass-1 classification**

Locate the Pass-1 block (currently lines 199-207). It looks like:
```ts
// Build DV2 metadata — two-pass approach
// Pass 1: classify all tables (partials take priority over groups)
const dv2Metadata = new Map<string, DV2Metadata>()
for (const table of tables) {
  const hint = entityHintMap.get(table.id)
  const group = table.group ?? ''
  const entityType = hint ?? entityTypeFromGroup(group)
  dv2Metadata.set(table.id, { entityType, parentHubs: [], linkedHubs: [] })
}
```

Replace it with:
```ts
// Build DV2 metadata — two-pass approach
// Pass 1: classify tables that carry an explicit note marker (**HUB** / **SAT** / **LNK** / **REF**).
// Tables without a marker are not classified and have no entry in dv2Metadata.
const dv2Metadata = new Map<string, DV2Metadata>()
for (const table of tables) {
  const entityType = entityTypeFromNote(table.note)
  if (entityType !== null) {
    dv2Metadata.set(table.id, { entityType, parentHubs: [], linkedHubs: [] })
  }
}
```

- [ ] **Step 5: Remove the now-unused `DV2EntityType` import (if applicable)**

If `DV2EntityType` is no longer referenced anywhere in `parseDbml.ts` after the deletions, remove it from the imports to avoid an unused-import lint warning. (Search the file: if no remaining references, remove from the import statement; if still referenced elsewhere — e.g. in metadata types — leave it.)

- [ ] **Step 6: Verify build**

```
npm run build
```
Expected: build passes — no TypeScript errors. Pass-2 (parent/linked hub resolution) is unchanged and continues to work because it iterates `dv2Metadata.entries()` which is now sparse.

- [ ] **Step 7: Run tests**

```
npm run test
```
Expected: all existing tests pass + the 13 new `entityTypeFromNote` tests pass.

- [ ] **Step 8: Commit**

```
git add src/parser/parseDbml.ts
git commit -m "feat: classify DV2 entity type from note marker only"
```

Use commit trailer: `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`

---

## Task 3: Switch `conceptualToFlow.ts` to dv2Metadata-driven node types

**Files:**
- Modify: `src/parser/conceptualToFlow.ts`

- [ ] **Step 1: Replace `nodeTypeFromGroup` with `nodeTypeFromEntity`**

Open `src/parser/conceptualToFlow.ts`. Replace the entire file with:

```ts
import type { Node, Edge } from '@xyflow/react'
import type { DV2EntityType, ParseResult } from '../types'
import { dv2EdgeColor } from '../diagram/dv2Colors'

function nodeTypeFromEntity(entityType: DV2EntityType | undefined): string {
  if (entityType === 'hub') return 'hubNode'
  if (entityType === 'satellite') return 'satelliteNode'
  if (entityType === 'link') return 'linkNode'
  return 'conceptNode'
}

export function parseResultToConceptualFlow(result: ParseResult): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = []
  const edges: Edge[] = []

  for (const table of result.tables) {
    const entityType = result.dv2Metadata.get(table.id)?.entityType
    nodes.push({
      id: table.id,
      type: nodeTypeFromEntity(entityType),
      position: { x: 0, y: 0 },
      data: { label: table.name, line: table.line },
    })
  }

  for (const note of result.stickyNotes) {
    nodes.push({
      id: note.id,
      type: 'noteNode',
      position: { x: 0, y: 0 },
      data: { label: note.name, content: note.content },
    })
  }

  // Two passes: first count pairs, then build edges with pairIndex/pairTotal
  const pairCount = new Map<string, number>()
  for (const ref of result.refs) {
    const pairKey = `${ref.fromTable}|${ref.toTable}`
    pairCount.set(pairKey, (pairCount.get(pairKey) ?? 0) + 1)
  }

  const pairSeen = new Map<string, number>()
  for (const ref of result.refs) {
    const strokeColor = dv2EdgeColor(result.dv2Metadata.get(ref.fromTable)?.entityType, result.dv2Metadata.get(ref.toTable)?.entityType) ?? '#9ca3af'
    const pairKey = `${ref.fromTable}|${ref.toTable}`
    const idx = pairSeen.get(pairKey) ?? 0
    pairSeen.set(pairKey, idx + 1)
    const total = pairCount.get(pairKey) ?? 1
    edges.push({
      id: ref.id,
      source: ref.fromTable,
      target: ref.toTable,
      type: 'erEdge',
      style: { stroke: strokeColor },
      data: { line: ref.line, pairIndex: idx, pairTotal: total },
    })
  }

  return { nodes, edges }
}
```

The only changes from the previous version are:

- `nodeTypeFromGroup(group?: string)` → `nodeTypeFromEntity(entityType: DV2EntityType | undefined)`.
- The function body now branches on the entity-type literal instead of a group-name prefix; reference is no longer a special case (refs are `'reference'` entity type, but they have no dedicated conceptual node — they fall through to `'conceptNode'` like unmarked tables).
- The call site reads `result.dv2Metadata.get(table.id)?.entityType` instead of passing `table.group`.

- [ ] **Step 2: Verify build**

```
npm run build
```
Expected: build passes.

- [ ] **Step 3: Commit**

```
git add src/parser/conceptualToFlow.ts
git commit -m "feat: route conceptual node type by dv2Metadata, not group prefix"
```

Use commit trailer: `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`

---

## Task 4: Recolor Reference to orange

**Files:**
- Modify: `src/diagram/dv2Colors.ts`

- [ ] **Step 1: Update the Reference color trio**

Open `src/diagram/dv2Colors.ts`. Change line 7 from:

```ts
  reference: { bg: '#5D6D7E', border: '#85929E', handle: '#4A5568' },
```

to:

```ts
  reference: { bg: '#E67E22', border: '#F5B041', handle: '#B9770E' },
```

(Background `#E67E22` is the canonical orange. Border `#F5B041` is a lighter orange tint, matching the analogous lightening for hub/sat/link borders. Handle `#B9770E` is a darker orange shade.)

- [ ] **Step 2: Verify build**

```
npm run build
```
Expected: build passes.

- [ ] **Step 3: Commit**

```
git add src/diagram/dv2Colors.ts
git commit -m "feat: recolor Reference DV2 type to orange"
```

Use commit trailer: `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`

---

## Task 5: Manual verification

**No file changes — runtime behavior check.**

This task validates the cross-cutting effects in the running app. The implementer is the user; the controller dispatches this only as a hand-off step.

- [ ] **Step 1: Start the dev server**

```
npm run dev
```
Open http://localhost:5173 in a browser.

- [ ] **Step 2: Prepare a test DBML**

Open or create a project with at least one table per category, for example:

```dbml
Table h_customer [note: '**HUB** Customer master.'] {
  customer_hk varchar [pk, note: '**hk**']
  customer_bk varchar [note: '**bk**']
  load_dts timestamp
}

Table s_customer_demo [note: '**SAT** Demographics.'] {
  customer_hk varchar [ref: > h_customer.customer_hk, note: '**hk**']
  load_dts timestamp [pk]
  hash_diff varchar
  birth_date date
}

Table l_customer_order [note: '**LNK** Customer ↔ order.'] {
  link_hk varchar [pk, note: '**hk**']
  customer_hk varchar [ref: > h_customer.customer_hk, note: '**hk**']
  order_hk varchar [note: '**hk**']
  load_dts timestamp
}

Table ref_country_codes [note: '**REF** ISO 3166-1 alpha-2.'] {
  code varchar [pk]
  name varchar
}

Table staging_customer {
  raw_id varchar
  payload varchar
}
```

- [ ] **Step 3: Verify Relational view**

- `h_customer` renders with red header (HUB color).
- `s_customer_demo` renders with blue header (SAT color).
- `l_customer_order` renders with green header (LNK color).
- `ref_country_codes` renders with **orange** header (REF color, the new color).
- `staging_customer` renders with the default neutral table style (no DV2 header color).

- [ ] **Step 4: Verify Conceptual view**

Switch to Conceptual via the cycle button.

- `h_customer` is an ellipse (hubNode).
- `s_customer_demo` is a rounded rectangle (satelliteNode).
- `l_customer_order` is a rounded rectangle (linkNode).
- `ref_country_codes` is a generic conceptNode (it goes through the conceptNode fallback — Reference does not have a dedicated conceptual node component).
- `staging_customer` is a generic conceptNode in **gray** (uses `--c-bg-3`).

- [ ] **Step 5: Verify Tabular view**

Switch to Tabular via the cycle button.

- All five tables appear as rows.
- Type column shows: `hub`, `satellite`, `link`, `reference`, *(blank)* respectively.
- Group filter still works if any of the tables has a `TableGroup` defined.

- [ ] **Step 6: Verify edges**

- Edges between marked tables are colored by the existing `dv2EdgeColor` rules.
- Edge into `staging_customer` (if you add a ref to it) falls back to the default color `#9ca3af`.

- [ ] **Step 7: Verify case-insensitivity in practice**

Edit one note to use `**hub**` (lowercase) instead of `**HUB**`. The table should still classify as a hub (red header / ellipse).

- [ ] **Step 8: Verify priority chain**

- Remove a marker from one table. It should immediately drop to neutral styling.
- Confirm that adding a `Partial(hub)` injection or a `TableGroup hubs { ... }` block does NOT classify the table as a hub anymore — only the note marker does.

- [ ] **Step 9: Run full test suite**

```
npm run test
```
Expected: all tests pass.

- [ ] **Step 10: Run lint on touched files**

```
NODE_OPTIONS="--max-old-space-size=8192" npx eslint src/parser src/diagram/dv2Colors.ts
```
Expected: no new errors. Pre-existing warnings (e.g. TanStack Table library-hook false-positive in `TableGrid.tsx`) are unrelated to this plan.

---

## Summary of Commits Expected

1. `feat: add entityTypeFromNote helper with tests`
2. `feat: classify DV2 entity type from note marker only`
3. `feat: route conceptual node type by dv2Metadata, not group prefix`
4. `feat: recolor Reference DV2 type to orange`

Task 5 is verification only — no commit.

---

## Self-Review Notes (writer)

- **Spec coverage check:**
  - Markers + case-insensitive + anywhere-match — Task 1 (regex flag `i`, no anchoring).
  - First-match-wins — Task 1 (single regex `exec`, returns first hit).
  - Unmarked → no entry in `dv2Metadata` — Task 2 (Pass-1 only writes when not null).
  - Reference recolor — Task 4.
  - Free TableGroup from DV2 role — Tasks 2 & 3 (both classification sites switched off the group).
  - Hard break, no migration — by omission (no migration task).
  - Conceptual view shows unmarked as gray ConceptNode — Task 3 (existing `ConceptNode` already gray-styled, fallthrough from `nodeTypeFromEntity`).
  - Tabular view Type column blank for unmarked — already the case via `parseResult?.dv2Metadata.get(t.id)?.entityType ?? ''`; no change required.

- **Type consistency:** `entityTypeFromNote` is referenced consistently in the helper file, test file, and parser import. `nodeTypeFromEntity` parameter type matches `DV2EntityType | undefined` (the actual type returned by `dv2Metadata.get(...)?.entityType`).

- **Placeholder scan:** No TBDs, no "implement later", no unspecified test code.

- **Symbol reference check:** `entityTypeFromNote`, `nodeTypeFromEntity`, `MARKER_TO_TYPE`, `MARKER_REGEX` defined in their tasks; no forward references.
