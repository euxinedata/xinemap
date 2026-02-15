# UX Design Document: XineMap Data Vault 2.0 Modelling Tool

---

## 1. Editing Paradigm: Text-First with Diagram Shortcuts

**Recommendation: Keep DBML editor as the single source of truth. Add targeted diagram interactions that generate DBML.**

The editor (Monaco with DBML syntax highlighting, error markers, `Ctrl+S` save) is already solid. DV2.0 practitioners are comfortable with code. Two-way sync (diagram mutations writing back to DBML) would be architecturally expensive and fragile — the parser currently flows one way (`dbml -> parseResult -> flow nodes`), and reversing that mapping reliably is a significant engineering effort for limited gain.

Instead, add these diagram-side shortcuts that **append DBML to the editor** (not edit in place):

- **Right-click context menu on diagram canvas**: "New Hub...", "New Link...", "New Satellite..." — opens a minimal inline form (name + business keys), generates the DBML snippet, and appends it to the editor. The editor cursor moves to the new block so the user can refine.
- **Right-click on a conceptual hub node**: "Add Satellite..." — pre-fills the hub's hash key reference in the generated satellite DBML.

This preserves the one-way data flow (`editor -> parse -> diagram`) while eliminating the tedium of typing boilerplate. The editor remains authoritative; the diagram is a convenient entry point.

---

## 2. View Mode State Machine: Tabs, Not a Toggle

**Recommendation: Replace the current toggle button with a tab bar. Add a third "Split" option for side-by-side.**

Current state: a single button cycles between "Relational" and "Conceptual" in `DiagramPanel`. The expert's workflow alternates between these views during the "Flesh Out Relational Model" phase.

Design:

```
[Conceptual] [Relational] [Split]     [Auto Layout] [LR/TB]
```

- **Conceptual tab**: Current conceptual view (hubs, sats, links, notes as shaped nodes).
- **Relational tab**: Current relational view (table nodes with columns, ER edges).
- **Split tab**: Vertical split — conceptual on top, relational on bottom (or side by side depending on viewport). Both views are synchronized: clicking a hub in the conceptual view highlights and scrolls to the corresponding table in the relational view (and vice versa).

**View state preservation**: When switching tabs, each view remembers its own zoom/pan position (store separate `viewport` per view mode in `useDiagramStore`). When a user switches from Conceptual to Relational, if they had a node selected, the Relational view auto-pans to center that node's table equivalent.

---

## 3. DV2.0 Scaffolding UX: Command Palette

**Recommendation: A `Cmd+K` command palette that generates DBML snippets from templates.**

Why not a syntax extension: DBML is a standard format. Extending its syntax creates compatibility issues with `@dbml/core`. Why not a dialog: dialogs are heavy for what is essentially "insert a snippet."

Design:

- **Trigger**: `Cmd+K` (Mac) / `Ctrl+K` opens a floating palette at the top center of the editor pane (like VS Code's command palette).
- **Commands**:
  - `scaffold hub <name>` — generates hub table with `hk_<name>`, `load_date`, `record_source`, plus a placeholder business key
  - `scaffold satellite <name> for <hub>` — generates sat with `hk_<hub>`, `load_date`, `hash_diff`, plus a `Ref:` back to the hub
  - `scaffold link <name> between <hub1> <hub2>` — generates link table with both hash keys plus refs
  - `scaffold effectivity <name> for <link>` — generates effectivity satellite
- **Template customization**: A `Settings` panel (gear icon in toolbar) where users can set default hash key type (`binary` vs `varchar`), timestamp type, whether to include `record_source` in satellites, etc. These are stored in `localStorage` alongside projects.
- **Visual distinction**: Scaffolded blocks are inserted with a leading comment `// [scaffolded] — review and customize` to signal what was auto-generated. No runtime tracking needed; the comment is just a visual cue.

The palette also doubles as the entity search (see section 5), making it the single keyboard-driven interaction point.

---

## 4. Validation Panel: Expandable Status Bar

**Recommendation: Expand the existing StatusBar into a collapsible bottom panel. Do not add a sidebar.**

The current `StatusBar` already shows parse error count and table/ref/enum counts. Extend it:

- **Default state**: Single-line bar (as today), showing a validation summary. Example: `3 warnings, 1 error | 12 tables, 8 refs`
- **Click to expand**: Clicking the status bar expands upward into a panel (200px height, resizable via Allotment), showing a scrollable list of validation messages.
- **Keyboard shortcut**: `Cmd+Shift+M` toggles the panel (same as VS Code's Problems panel).
- **Message format**: Each row shows `[Error|Warning|Info] icon | Entity name | Message | Line number`
- **Click-to-navigate**: Clicking a message does two things simultaneously:
  1. Scrolls the Monaco editor to the relevant line and highlights it
  2. Pans the diagram to center the relevant node and applies a brief highlight pulse (blue glow, fading over 1s)
- **Severity levels**:
  - **Error** (red): Structural DV2.0 violations — hub without business key, satellite without hash key reference, link with fewer than 2 hub references, missing `load_date` or `record_source` on hubs/links
  - **Warning** (amber): Orphan satellites (no ref to a hub), hub with no satellites, hash key type mismatches across refs
  - **Info** (gray): Missing notes on tables, naming convention suggestions (e.g., satellite not starting with `sat_`)
- **When validation runs**: On every successful parse (the `useParseEffect` hook already runs on `dbml` changes). Validation is a pure function over `ParseResult` — fast and synchronous. A manual "Re-validate" button in the panel header provides a forcing function.

---

## 5. Entity Search/Navigation: Unified Command Palette

**Recommendation: The same `Cmd+K` palette from section 3, with search as the default mode.**

When the palette opens, it defaults to search mode. The user types and gets fuzzy-matched results across:
- Table names
- Column names (shown as `TableName.column_name`)
- Group names (with a `group:` prefix badge)
- Note content (truncated)

**Result selection behavior**:
1. Highlights the matching node in the diagram (blue border pulse)
2. Pans/zooms the diagram to center on that node
3. Scrolls the editor to the line where that table's DBML definition begins
4. Briefly highlights the editor line (yellow flash, 1s fade)

For large models (80+ tables), the palette shows the first 15 results with a scroll indicator. Results are ranked: exact prefix match > fuzzy name match > column match > note match.

This unified palette means one keyboard shortcut, one interaction pattern for both scaffolding and navigation.

---

## 6. Notes and Detail Display

### Relational View (TableNode)

**Recommendation: Icon-triggered tooltips, not always-visible text.**

- **Table notes**: Add a small `i` icon (gray, 10px) at the right edge of the table header. Hovering shows the note text in a tooltip styled as a dark popover (bg-gray-900, border-gray-600, max-width 280px). The data is already available in `TableInfo.note`.
- **Column notes**: Same pattern — a faint `i` icon appears on hover at the right of any column row that has a `note` property. Tooltip shows the note.
- Notes should never expand the node size. They are discoverably present but do not add visual noise.

### Conceptual View (Hub/Satellite/Link Nodes)

**Recommendation: Click-to-expand detail card.**

Currently, conceptual nodes only show `data.label`. Extend the data passed to conceptual nodes (in `conceptualToFlow.ts`) to include business keys, satellite count, and notes.

- **Hover**: Shows a lightweight tooltip with entity type + note (if present). Example: `Hub | Core customer entity`
- **Click**: Expands the node into a detail card (below the node shape, same width) showing:
  - Business keys (for hubs)
  - Hash key references (for sats/links)
  - Connected satellite names (for hubs) with count
  - Connected hub names (for links)
  - Note text (full)
- **Click again or click elsewhere**: Collapses back to the compact shape.

This supports the expert's "Iterate Conceptual Model" phase where they need to inspect details without switching to the relational view.

---

## 7. Presentation Mode

**Recommendation: `F11` or toolbar button enters a distraction-free full-diagram mode.**

Design:

- **Entry**: Button in toolbar labeled "Present" (or `Cmd+Shift+F` / `F11`). Also accessible from `Cmd+K` palette as `presentation mode`.
- **What changes**:
  - Editor pane hides (Allotment pane collapses to 0)
  - Toolbar compresses to a minimal floating bar: project name + "Exit" button, semi-transparent, at the top center
  - Status bar hides
  - Diagram occupies full viewport
  - Background dots become more subtle (lower opacity)
  - React Flow Controls remain (zoom/pan are essential during presentation)
- **Node interaction in presentation mode**:
  - Click on a node shows the detail card (same as conceptual click-to-expand, but available in both views)
  - No editing, no right-click menus
- **Exit**: `Escape` key, or click "Exit" in the floating bar.

This is deliberately simple. The goal is stakeholder walkthroughs, not a slide deck system. The presenter navigates by panning/zooming and clicking nodes to show details.

---

## 8. Model Statistics: StatusBar Integration

**Recommendation: Part of the expanded StatusBar panel, as a "Statistics" tab.**

The validation panel (section 4) gets a second tab: "Statistics."

Contents (displayed as a clean two-column grid, label left, value right):

| Metric | Value |
|---|---|
| Hubs | 5 |
| Links | 3 |
| Satellites | 12 |
| Effectivity Sats | 1 |
| Notes | 4 |
| Hub-to-Satellite ratio | 1:2.4 |
| Total columns | 87 |
| Orphan entities | 2 (warning color, clickable) |
| Tables without notes | 6 (info color, clickable) |

Clicking "Orphan entities" or "Tables without notes" switches to the Validation tab filtered to those messages.

This keeps stats discoverable without adding yet another panel. The StatusBar summary line always shows a compact version: `5H / 3L / 12S | 87 cols`

---

## Summary of Interaction Map

| Action | Trigger | Location |
|---|---|---|
| Scaffold DV2.0 entity | `Cmd+K` > type command | Command palette |
| Search entities | `Cmd+K` > type name | Command palette |
| Add entity from diagram | Right-click canvas | Context menu |
| Add satellite to hub | Right-click hub node | Context menu |
| View validation | Click status bar or `Cmd+Shift+M` | Bottom panel |
| View statistics | Status bar panel > Statistics tab | Bottom panel |
| Switch view mode | Tab bar above diagram | Diagram panel |
| Enter presentation | Toolbar "Present" or `Cmd+Shift+F` | Full screen |
| View notes | Hover `i` icon (relational) or click node (conceptual) | In-diagram |

All new interactions use exactly two patterns: (1) the command palette and (2) click/hover on existing elements. No new panels, sidebars, or floating windows beyond the expandable status bar. This keeps the interface clean and learnable.
