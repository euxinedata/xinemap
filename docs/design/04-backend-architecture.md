# DV2.0 Modelling Tool — Technical Architecture

---

## 1. Data Model Extensions

### New types in `src/types/index.ts`

```typescript
// --- DV2.0 Entity Classification ---

export type DV2EntityType = 'hub' | 'satellite' | 'link' | 'pit' | 'bridge' | 'reference'

export interface DV2Metadata {
  entityType: DV2EntityType
  /** For satellites/links: the parent hub table IDs */
  parentHubs: string[]
  /** For links: all hub table IDs this link connects */
  linkedHubs: string[]
}

// --- Validation ---

export type ValidationSeverity = 'error' | 'warning' | 'info'

export interface ValidationIssue {
  severity: ValidationSeverity
  rule: string            // e.g. 'hub-needs-satellite'
  message: string
  tableId?: string        // which table the issue applies to
  columnName?: string     // which column, if applicable
}

export interface ValidationResult {
  issues: ValidationIssue[]
  stats: ModelStats
}

// --- Model Statistics ---

export interface ModelStats {
  hubCount: number
  satelliteCount: number
  linkCount: number
  otherCount: number
  orphanHubs: string[]       // hubs with no satellites
  orphanSatellites: string[] // satellites with no ref to a hub
  hubToSatRatio: number      // satellites / hubs
}

// --- Project Metadata (from DBML Project block) ---

export interface ProjectMeta {
  name?: string
  databaseType?: string
  note?: string
}

// --- Search ---

export interface SearchMatch {
  type: 'table' | 'column' | 'note'
  tableId: string
  columnName?: string
  matchText: string
}
```

### ParseResult evolution

```typescript
export interface ParseResult {
  tables: TableInfo[]
  refs: RefInfo[]
  enums: EnumInfo[]
  stickyNotes: StickyNoteInfo[]
  errors: string[]
  // New fields:
  projectMeta: ProjectMeta | null
  dv2Metadata: Map<string, DV2Metadata>  // keyed by table ID
}
```

**No separate `DV2Model` intermediate representation.** The `dv2Metadata` map is computed inside `parseDbml` from the existing `groupMap` and `refs`. It enriches `ParseResult` without changing the downstream flow converters — they already branch on `table.group`. The validation engine reads `ParseResult` directly.

### How `dv2Metadata` is built (inside `parseDbml`)

After building `groupMap` and `refs`:
1. Iterate tables. Map group name to `DV2EntityType` using the same prefix logic as `conceptualToFlow.ts` (`hub*` → hub, `sat*` → satellite, `link*` → link, else `reference`).
2. For each satellite, scan refs to find which hub it references → populate `parentHubs`.
3. For each link, scan refs to find which hubs it references → populate `linkedHubs`.
4. Parse `exported.project` (if it exists) → `ProjectMeta`.

This keeps the parser as the single source of truth. No second pass needed.

---

## 2. Validation Engine

### Architecture

- **Location**: `src/validation/validateDV2.ts` — a pure synchronous function.
- **API**: `function validateDV2(result: ParseResult): ValidationResult`
- **Why synchronous**: The validation operates on an in-memory `ParseResult` with at most hundreds of tables. No I/O, no heavy computation. A web worker adds complexity for no gain.
- **When it runs**: Called inside `useParseEffect` immediately after `parseDbml` succeeds. The validation result is stored in the editor store.

### Store integration

Add to `useEditorStore`:

```typescript
interface EditorState {
  // existing...
  validationResult: ValidationResult | null
  setValidationResult: (result: ValidationResult | null) => void
}
```

In `useParseEffect`, after setting `parseResult`:
```typescript
const validation = validateDV2(result)
setValidationResult(validation)
```

### Validation rules (all rules, with severity)

**Structural rules (error)**:
1. `hub-needs-satellite` — Every hub must have at least one satellite referencing it.
2. `satellite-needs-parent` — Every satellite must have a ref to exactly one hub.
3. `link-needs-two-hubs` — Every link must reference at least 2 distinct hubs.
4. `link-needs-satellite` — Every link should have at least one satellite (warning, not error).

**Column rules (error)**:
5. `hub-needs-hash-key` — Hub must have a column matching `hk_*` that is PK.
6. `hub-needs-load-date` — Hub must have `load_date` column, not null.
7. `hub-needs-record-source` — Hub must have `record_source` column, not null.
8. `hub-needs-business-key` — Hub must have at least one non-system column (business key).
9. `sat-needs-hash-diff` — Satellite must have `hash_diff` column.
10. `sat-needs-load-date` — Satellite must have `load_date` column (as part of PK or not null).
11. `sat-needs-parent-hk` — Satellite must have the parent hub's hash key column.
12. `link-needs-hash-key` — Link must have a `hk_*` PK column.
13. `link-needs-load-date` — Link must have `load_date`, not null.
14. `link-needs-record-source` — Link must have `record_source`, not null.
15. `link-needs-hub-hks` — Link must contain hash key columns for each referenced hub.

**Naming convention rules (warning)**:
16. `naming-hub-prefix` — Hub table names should not start with common prefixes like `sat_`, `lnk_`.
17. `naming-sat-prefix` — Satellite table names should start with `sat_` or belong to a satellites group.
18. `naming-link-prefix` — Link table names should start with `lnk_` or belong to a links group.

**Info rules**:
19. `hub-no-descriptive-columns` — Hub has columns beyond system columns (hk, load_date, record_source, business keys). Hubs should be lean.

### UI integration

Validation issues appear in:
1. **StatusBar** — summary count: "3 errors, 1 warning" replacing or appending to the current table/ref count.
2. **Editor markers** — validation warnings rendered as Monaco markers (yellow squiggles). This requires mapping `tableId` back to a line number in the DBML source. We do this by searching the DBML text for `Table <tableName>` with a simple regex match to get the line.
3. **A ValidationPanel** (collapsible sidebar or bottom panel) — lists all issues, clickable to jump to the relevant table in the editor. This is a later enhancement; the StatusBar + markers are the MVP.

---

## 3. Snowflake DDL Generator

### Approach: Build custom from ParseResult

**Why not extend @dbml/core**: The `@dbml/core` exporter takes a DBML string and targets a fixed set of dialects. Its internal export pipeline is not designed for pluggable dialects — there's no clean extension point. Writing a custom generator from `ParseResult` is simpler and gives us full control over Snowflake-specific syntax.

### Location: `src/export/exportSnowflake.ts`

### Type mapping

```typescript
const SNOWFLAKE_TYPE_MAP: Record<string, string> = {
  // Integers
  'integer': 'NUMBER(38,0)', 'int': 'NUMBER(38,0)', 'bigint': 'NUMBER(38,0)',
  'smallint': 'NUMBER(38,0)', 'tinyint': 'NUMBER(38,0)', 'serial': 'NUMBER(38,0)',
  // Strings
  'varchar': 'VARCHAR', 'char': 'VARCHAR', 'text': 'VARCHAR',
  'nvarchar': 'VARCHAR', 'ntext': 'VARCHAR',
  // Boolean
  'boolean': 'BOOLEAN', 'bool': 'BOOLEAN',
  // Date/Time
  'date': 'DATE', 'datetime': 'TIMESTAMP_NTZ', 'timestamp': 'TIMESTAMP_NTZ', 'time': 'TIME',
  // Float
  'float': 'FLOAT', 'double': 'FLOAT', 'decimal': 'NUMBER(38,6)',
  'numeric': 'NUMBER(38,6)', 'real': 'FLOAT',
  // Binary
  'binary': 'BINARY', 'varbinary': 'BINARY', 'bytea': 'BINARY', 'blob': 'BINARY',
  // JSON
  'json': 'VARIANT', 'jsonb': 'VARIANT',
  // UUID
  'uuid': 'VARCHAR(36)',
}
```

### Generation algorithm

```typescript
export interface SnowflakeExportOptions {
  database?: string
  transientTables: boolean        // use CREATE TRANSIENT TABLE
  clusterByHashKeys: boolean      // add CLUSTER BY on PK hash key columns
}

export function exportSnowflakeDDL(
  result: ParseResult,
  options: SnowflakeExportOptions
): string
```

Steps:
1. **Collect schemas**: Extract unique schema names from `result.tables`. Generate `CREATE SCHEMA IF NOT EXISTS` for each non-public schema.
2. **Dependency order**: Topological sort tables using `result.refs`. Tables referenced by FK come before tables that reference them. Use Kahn's algorithm on the ref graph. Cycles (which shouldn't exist in DV2.0 but could in general DBML) are broken arbitrarily.
3. **For each table** (in dependency order):
   - `CREATE [TRANSIENT] TABLE <schema>.<name> (`
   - For each column: `<name> <snowflakeType> [NOT NULL] [DEFAULT <val>]`
   - Primary key constraint: `CONSTRAINT pk_<table> PRIMARY KEY (<pk_cols>)`
   - Foreign key constraints from refs: `CONSTRAINT fk_<table>_<target> FOREIGN KEY (<cols>) REFERENCES <target>(<cols>)`
   - `);`
   - If `clusterByHashKeys` and table has `hk_*` PK columns: `ALTER TABLE <schema>.<name> CLUSTER BY (<hk_cols>);`
4. **Output**: Single string, semicolons terminated, UTF-8.

### UI integration

Add `'snowflake'` to the export dialog's dialect list. Since Snowflake export uses `ParseResult` (not `@dbml/core exporter`), the ExportDialog needs a separate code path:

```typescript
// In ExportDialog
if (dialect === 'snowflake') {
  const result = useEditorStore.getState().parseResult
  if (!result) { setError('Parse the DBML first'); return }
  setDdl(exportSnowflakeDDL(result, { transientTables: false, clusterByHashKeys: true }))
} else {
  setDdl(exportSql(dbml, dialect))
}
```

Update the `SqlDialect` type:
```typescript
export type SqlDialect = 'postgres' | 'mysql' | 'mssql' | 'oracle' | 'snowflake'
```

---

## 4. DV2.0 Scaffolding

### Approach: Editor action that inserts DBML text

**Why editor action, not post-parse transform**:
- Post-parse transforms would modify the in-memory `ParseResult` but the user would see unmodified DBML in the editor — confusing.
- A DBML preprocessor would mean maintaining a custom syntax layer above @dbml/core.
- An editor action that inserts DBML text at the cursor position is simple, visible, and the user retains full control. They see exactly what was generated and can edit it.

### Location: `src/editor/scaffolding.ts`

### Templates

```typescript
export type ScaffoldType = 'hub' | 'satellite' | 'link'

export function generateScaffold(type: ScaffoldType, name: string): string
```

**Hub template** (for name = "Customer"):
```dbml
Table Customer {
  hk_customer binary [pk, note: 'hash key']
  load_date timestamp [not null]
  record_source varchar [not null]
  // TODO: add business key columns
}
```

**Satellite template** (for name = "CustomerPII", parent hub = "Customer"):
```dbml
Table CustomerPII {
  hk_customer binary [pk]
  load_date timestamp [pk]
  hash_diff binary [not null]
  // TODO: add descriptive attributes
}

Ref: CustomerPII.hk_customer > Customer.hk_customer
```

**Link template** (for name = "CustomerCard", hubs = ["Customer", "Card"]):
```dbml
Table CustomerCard {
  hk_customer_card binary [pk, note: 'hash key']
  hk_customer binary [not null]
  hk_card binary [not null]
  load_date timestamp [not null]
  record_source varchar [not null]
}

Ref: CustomerCard.hk_customer > Customer.hk_customer
Ref: CustomerCard.hk_card > Card.hk_card
```

### Monaco integration

Register a Monaco editor action (in `EditorPanel.tsx` `onMount`):
```typescript
editor.addAction({
  id: 'dv2-scaffold-hub',
  label: 'DV2: Insert Hub',
  contextMenuGroupId: 'dv2',
  run: (ed) => { /* prompt for name, insert at cursor */ }
})
```

For the name/parent prompt: use a Monaco `QuickInput` (input box) via `editor.getContribution('editor.contrib.quickInput')` or a simple `window.prompt` as MVP. A proper UI would be a small modal, but that's a UI concern — the backend just provides `generateScaffold()`.

### User customization

Not in MVP. Future: store templates in project metadata or a config file. For now, the templates are hardcoded constants in `scaffolding.ts`.

---

## 5. Two-Way Sync — Recommendation: Do NOT implement now

**Recommendation**: Stay text-first. The current architecture (DBML text → parse → diagram) is clean and unidirectional. Two-way sync introduces:
- AST serialization complexity (@dbml/core's AST is not designed for round-trip editing)
- Conflict resolution when diagram edits conflict with text edits
- Loss of user formatting, comments, and whitespace

Instead, provide **targeted text insertions** (scaffolding, described above) and **diagram-to-editor navigation** (click a node → highlight corresponding DBML in editor). This gives users the convenience of diagram interaction without the sync nightmare.

If two-way sync is ever needed, the approach should be: (b) AST patches — parse DBML to AST, mutate AST, serialize back. But this requires either forking @dbml/core or building a custom DBML serializer, which is a large undertaking.

---

## 6. State Management Evolution

### New store fields

**`useEditorStore`** — add:
```typescript
interface EditorState {
  // existing fields...
  validationResult: ValidationResult | null
  setValidationResult: (r: ValidationResult | null) => void
}
```

**`useDiagramStore`** — add search state:
```typescript
interface DiagramState {
  // existing fields...
  searchQuery: string
  searchMatches: SearchMatch[]
  selectedMatchIndex: number
  setSearchQuery: (query: string) => void
  setSearchMatches: (matches: SearchMatch[]) => void
  setSelectedMatchIndex: (index: number) => void
}
```

**No new stores needed.** Adding fields to existing stores keeps the architecture flat. Validation flows through `useEditorStore` (computed from parse result). Search flows through `useDiagramStore` (operates on diagram state).

### Data flow with validation

```
DBML text
  → useParseEffect (300ms debounce)
    → parseDbml() → ParseResult (with dv2Metadata, projectMeta)
    → validateDV2(result) → ValidationResult
    → store: parseResult, validationResult
      → DiagramPanel reacts to parseResult
      → StatusBar reacts to validationResult
      → EditorPanel reacts to validationResult (markers)
```

### Search flow

```
User types in search box (DiagramPanel top bar or Toolbar)
  → setSearchQuery(query)
  → useSearchEffect hook computes matches from parseResult
    → setSearchMatches(matches)
  → User clicks a match or presses Enter
    → setSelectedMatchIndex(n)
    → DiagramPanel useEffect: call reactFlowInstance.fitView({ nodes: [matchedNodeId] })
    → EditorPanel useEffect: if match has tableId, find line in DBML, editor.revealLine()
```

---

## 7. File Architecture

### New files

```
src/
├── types/
│   └── index.ts                    # Extended with new types (DV2Metadata, ValidationIssue, etc.)
├── parser/
│   └── parseDbml.ts                # Extended: compute dv2Metadata, parse Project block
├── validation/
│   └── validateDV2.ts              # NEW: pure function, all validation rules
├── export/
│   ├── exportPng.ts                # Existing
│   └── exportSnowflake.ts          # NEW: Snowflake DDL generator
├── editor/
│   ├── EditorPanel.tsx             # Extended: validation markers, scaffold actions
│   ├── dbmlLanguage.ts             # Existing
│   └── scaffolding.ts              # NEW: DV2 scaffold templates
├── hooks/
│   ├── useParseEffect.ts           # Extended: call validateDV2 after parse
│   └── useSearchEffect.ts          # NEW: compute search matches from parseResult
├── store/
│   ├── useEditorStore.ts           # Extended: validationResult
│   └── useDiagramStore.ts          # Extended: search state
├── components/
│   ├── StatusBar.tsx               # Extended: show validation summary + model stats
│   ├── Toolbar.tsx                 # Extended: search input, DBML file import/export buttons
│   ├── ExportDialog.tsx            # Extended: Snowflake dialect, DBML file export
│   ├── FileDialog.tsx              # Extended: .dbml file import (disk read)
│   └── SearchBar.tsx               # NEW: search input + match navigation (or inline in Toolbar)
├── diagram/
│   ├── DiagramPanel.tsx            # Extended: fitView on search match
│   └── ...                         # Existing node/edge components
└── parser/
    ├── dbmlToFlow.ts               # Extended: create NoteNodes from stickyNotes in relational view
    └── conceptualToFlow.ts         # Existing
```

### Summary of changes per existing file

| File | Change |
|------|--------|
| `types/index.ts` | Add DV2Metadata, ValidationIssue, ValidationResult, ModelStats, ProjectMeta, SearchMatch. Extend ParseResult. |
| `parser/parseDbml.ts` | Compute `dv2Metadata` map from groupMap + refs. Parse `exported.project` into ProjectMeta. |
| `parser/dbmlToFlow.ts` | Add NoteNode creation from `result.stickyNotes` (currently only in conceptual view). |
| `parser/exportSql.ts` | Update `SqlDialect` to include `'snowflake'`. |
| `hooks/useParseEffect.ts` | Call `validateDV2()` after successful parse, store result. |
| `store/useEditorStore.ts` | Add `validationResult` field + setter. |
| `store/useDiagramStore.ts` | Add `searchQuery`, `searchMatches`, `selectedMatchIndex` fields + setters. |
| `components/StatusBar.tsx` | Show validation summary (error/warning counts) and model stats. |
| `components/ExportDialog.tsx` | Add Snowflake to dialect list. Add DBML file download button. Branching logic for Snowflake vs @dbml/core dialects. |
| `components/Toolbar.tsx` | Add search input. Add DBML import/export buttons. |
| `editor/EditorPanel.tsx` | Register scaffold editor actions. Show validation issues as Monaco markers. |
| `diagram/DiagramPanel.tsx` | React to search selection — fitView on matched node. |

### New files

| File | Purpose |
|------|---------|
| `src/validation/validateDV2.ts` | All 19 validation rules, pure function |
| `src/export/exportSnowflake.ts` | Snowflake DDL generator from ParseResult |
| `src/editor/scaffolding.ts` | Hub/Sat/Link DBML templates |
| `src/hooks/useSearchEffect.ts` | Compute search matches against ParseResult |
| `src/components/SearchBar.tsx` | Search UI component (optional — could be inline in Toolbar) |

---

## Implementation Priority Order

1. **ParseResult extensions** (dv2Metadata, projectMeta) — foundation for everything else
2. **Validation engine** — highest user value, pure logic, easy to test
3. **Table/column note display** — trivial, data already parsed
4. **Notes in relational view** — one-line addition to `dbmlToFlow.ts`
5. **Snowflake DDL export** — self-contained module
6. **Entity search** — moderate complexity, high usability value
7. **DV2 scaffolding** — editor action integration
8. **Model statistics** — derived from validation stats, minimal code
9. **DBML file import/export** — File API calls, straightforward
10. **Source DDL import** — `@dbml/core importer`, needs UI only
11. **Project metadata display** — trivial once parsed
