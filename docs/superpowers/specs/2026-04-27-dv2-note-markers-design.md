# DV2 Note Markers — Design

**Date:** 2026-04-27
**Branch:** `tabular` (feature follow-up; can be split into its own branch)
**Status:** Approved, pending implementation plan

## Summary

Replace the current implicit Data Vault 2.0 entity classification (which relies on `TablePartial` injection name and `TableGroup` name prefix) with a single explicit, deterministic mechanism: a note marker on the table itself. Tables without a marker are no longer classified as DV2 entities — they render as generic, neutrally-styled tables. This frees `TableGroup` to be used for business-domain grouping.

## Goals

- Make DV2 classification **explicit** and **deterministic** — no convention-based inference.
- Make the mechanism **DBML-compatible** — anyone else's DBML tooling continues to read the file.
- **Free TableGroup** for its native semantic (a single domain partition per table).
- Stay consistent with xinemap's existing `**...**` marker convention used for column roles (`**hk**`, `**bk**`, `**mak**`, `**dk**`).

## Non-Goals

- A migration helper (the user will update DBML files manually).
- Backward compatibility with the old TableGroup-prefix and TablePartial-name classification (hard break).
- A separate `**dv2:HUB**` namespace prefix (the table-level scope is unambiguous; column markers don't collide).

## Markers

Four uppercase three-letter codes wrapped in DBML bold-marker syntax:

| Marker  | DV2 Entity   |
|---------|--------------|
| `**HUB**` | Hub          |
| `**SAT**` | Satellite    |
| `**LNK**` | Link         |
| `**REF**` | Reference    |

**Matching rules:**

- The marker must appear in the **table's `note`** field (not a column note).
- Position is anywhere in the note — convention is "at the start", but the parser does not enforce it.
- Match is **case-insensitive** (`**hub**`, `**Hub**`, `**HUB**` all work). Documentation shows the canonical uppercase form.
- The marker is detected per-table independently — no cross-table inference, no group-based fallback.
- If multiple markers appear in the same note, **the first match wins** (left-to-right scan). Authors are expected to use one marker per table; the rule simply makes the parser deterministic.

**Examples:**

```dbml
Table h_customer [note: '**HUB** Master entity for customers (party model).'] {
  customer_hk varchar [pk, note: '**hk**']
  customer_bk varchar [note: '**bk**']
  load_dts timestamp
  record_source varchar
}

Table s_customer_demographics [note: '**SAT** Customer demographics over time.'] {
  customer_hk varchar [ref: > h_customer.customer_hk, note: '**hk**']
  load_dts timestamp [pk]
  hash_diff varchar
  birth_date date
  gender varchar
}

Table l_customer_order [note: '**LNK**'] {
  ...
}

Table ref_country_codes [note: '**REF** ISO 3166-1 alpha-2.'] {
  ...
}

Table staging_customer {
  ...
}
```

In this example, `staging_customer` has no marker → unmarked, no DV2 type.

## Default Behavior for Unmarked Tables

A table without any marker:

- **Has no entry** in `parseResult.dv2Metadata`. (Current code uses `dv2Metadata.get(id)?.entityType` already, so undefined-tolerance is in place.)
- **Renders neutrally** in all views — see the per-view spec below.
- Is not silently classified as `reference`. Reference is now opt-in, like the other three.

## Per-View Behavior

### Relational view (`TableNode`)

- Marked tables: existing DV2 styling using the per-type colors from `dv2Colors.ts`.
- Unmarked tables: render with the existing non-DV2 default. (No `headerColor` from DV2 styling, just the base background defined by xinemap's CSS variables.)

### Conceptual view

- Marked tables: existing per-type rendering (`HubNode` ellipse, `SatelliteNode` / `LinkNode` rounded rects).
- Unmarked tables: render using the existing **`ConceptNode`** generic conceptual node, styled in **gray** (use `--c-bg-3` background, `--c-border` border, `--c-text-1` text). They participate in the conceptual graph (their refs still produce edges) but they don't get DV2-type-specific shape or color.

### Tabular view

- Marked tables: `Type` column shows `hub` / `satellite` / `link` / `reference`.
- Unmarked tables: `Type` column is empty (`''`). They still appear in the grid; they just have no Type value.

### Edges

`dv2EdgeColor` already handles `undefined` source/target types (returns `undefined`). No change needed — edges between unmarked tables fall back to the default edge color.

## Color Update

Change the **Reference** color from slate gray (`#5D6D7E`) to **orange** to make it visually distinct now that unmarked tables occupy the neutral-gray space.

| Type | Before | After |
|------|--------|-------|
| Reference bg     | `#5D6D7E` | `#E67E22` |
| Reference border | `#85929E` | `#F5B041` |
| Reference handle | `#4A5568` | `#B9770E` |

(Border is a lighter orange tint; handle is a darker orange shade — analogous to how Hub/Satellite/Link are constructed.)

## Parser Changes (`src/parser/parseDbml.ts`)

Drop:

- `entityTypeFromPartials(partials)` — entire function.
- `entityTypeFromGroup(group)` — entire function.
- The Pass-1 line `const entityType = hint ?? entityTypeFromGroup(group)` and its writeback to `dv2Metadata` for every table.
- The `entityHintMap` population in the table loop (the partials lookup).

Add:

- `entityTypeFromNote(note: string | undefined): DV2EntityType | null` — a regex `/(?:^|[^A-Za-z])\*\*(HUB|SAT|LNK|REF)\*\*(?:[^A-Za-z]|$)/i` (or simpler: `/\*\*(HUB|SAT|LNK|REF)\*\*/i`) that returns the matching `DV2EntityType` (mapping `'SAT'` → `'satellite'`, `'LNK'` → `'link'`, `'HUB'` → `'hub'`, `'REF'` → `'reference'`), or `null`.

Pass-1 becomes:

```ts
for (const table of tables) {
  const entityType = entityTypeFromNote(table.note)
  if (entityType !== null) {
    dv2Metadata.set(table.id, { entityType, parentHubs: [], linkedHubs: [] })
  }
}
```

Pass-2 (parent/linked hub resolution) is unchanged — it already iterates `dv2Metadata.entries()` and is therefore implicitly scoped to marked tables only.

## Types

`DV2EntityType` and `DV2Metadata` are unchanged. The map remains `Map<string, DV2Metadata>`; sparseness (no entry for unmarked tables) is the new representation of "unclassified".

## Out of Scope (Deferred)

- Migration helper — user handles DBML edits manually.
- New `unclassified` enum value — sparseness in the map already expresses it.
- Per-marker color theming overrides — `dv2Colors.ts` constants remain the single source of truth.

## Files Touched (anticipated)

- `src/parser/parseDbml.ts` — replace classification logic.
- `src/diagram/dv2Colors.ts` — update Reference color trio.
- `src/parser/conceptualToFlow.ts` — route unmarked tables through `ConceptNode` (gray styling).
- (Possibly) `src/diagram/conceptual/ConceptNode.tsx` — verify it renders correctly with neutral CSS variables when no DV2 type is supplied; small style tweak if not.
- A small parser test alongside `parseDbml.ts` if one doesn't already exist for classification (vitest, pure-function).

## Testing

- Unit: vitest test for `entityTypeFromNote` covering: each marker (case-sensitive + lower- and mixed-case), missing note, plain note (no marker), marker embedded mid-prose, two markers in one note (first one wins — document this).
- Manual: open a DBML file with all four marker types + at least one unmarked table; verify diagram colors, conceptual shapes, tabular Type column.
