# DV2.0 Visual Design Specification

---

## Design Tokens (Reference)

Existing palette in active use:

| Token | Hex | Tailwind | Usage |
|-------|-----|----------|-------|
| bg-surface | `#030712` | gray-950 | Diagram canvas |
| bg-elevated | `#1f2937` | gray-800 | Nodes, panels |
| bg-chrome | `#111827` | gray-900 | Toolbar, StatusBar |
| border-default | `#4b5563` | gray-600 | Node borders |
| border-subtle | `#374151` | gray-700 | Dividers |
| text-primary | `#e5e7eb` | gray-200 | Headings |
| text-secondary | `#9ca3af` | gray-400 | Body text |
| text-muted | `#6b7280` | gray-500 | Metadata |
| hub-fill | `#fbbf24` | amber-400 | Hub nodes |
| hub-stroke | `#d97706` | amber-600 | Hub borders |
| sat-fill | `#4ade80` | green-400 | Satellite nodes |
| sat-stroke | `#16a34a` | green-600 | Satellite borders |
| note-fill | `#fef9c3` | yellow-100 | Note nodes |
| note-stroke | `#ca8a04` | yellow-600 | Note borders |
| pk-badge | `#a16207` | yellow-700 bg | PK badge |
| fk-badge | `#1d4ed8` | blue-700 bg | FK badge |

New tokens introduced:

| Token | Hex | Tailwind | Usage |
|-------|-----|----------|-------|
| bk-badge-bg | `#7c2d12` | orange-900 | BK badge background |
| bk-badge-text | `#fed7aa` | orange-200 | BK badge text |
| error-text | `#f87171` | red-400 | Validation errors |
| warn-text | `#fbbf24` | amber-400 | Validation warnings |
| info-text | `#60a5fa` | blue-400 | Validation info |
| same-as-stroke | `#a78bfa` | violet-400 | Same-as link edges |
| hier-stroke | `#f472b6` | pink-400 | Hierarchical link edges |
| highlight-ring | `#3b82f6` | blue-500 | Search selection ring |

---

## 1. Enhanced Conceptual Nodes

### 1a. HubNode with Hover Popover

**Base state** (unchanged):
- `rounded-lg border-2 px-6 py-3 min-w-[120px]`
- bg: `#fbbf24`, border: `#d97706`, text: `text-gray-900 text-sm font-semibold`

**Selected state** (when node matches search or is clicked):
- Add `ring-2 ring-blue-500 ring-offset-2 ring-offset-gray-950`
- Transition: `transition-shadow duration-150`

**Hover popover** (appears 300ms after mouseenter, disappears on mouseleave):
- Rendered via React Flow's `<NodeToolbar>` component, positioned `top`
- Container: `bg-gray-800 border border-gray-600 rounded-md shadow-xl p-3 min-w-[180px] max-w-[260px]`
- **Header row**: hub name in `text-sm font-semibold text-amber-300`
- **Business keys section**: label "Business Keys" in `text-[10px] uppercase tracking-wider text-gray-500 mb-1`, then each BK as `text-xs text-gray-300` on its own line
- **Stats row**: satellite count pill: `text-[10px] bg-green-900 text-green-300 px-1.5 py-0.5 rounded-full` showing e.g. "4 satellites"
- **Arrow**: 6px CSS triangle pointing down toward the node, color `#1f2937` to match bg-gray-800
- Z-index: `z-50` to float above other nodes

### 1b. SatelliteNode with Collapse

**Base state** (unchanged):
- `rounded-full border-2 w-[100px] h-[100px]`
- bg: `#4ade80`, border: `#16a34a`, text: `text-gray-900 text-sm font-semibold`

**Collapsed badge** (when hub has 5+ satellites, user toggles collapse via hub context menu or panel button):
- Individual satellite nodes are hidden (`display: none` on their React Flow nodes)
- A badge renders on the parent HubNode, bottom-right position: `absolute -bottom-2 -right-2`
- Badge: `w-6 h-6 rounded-full bg-green-600 border-2 border-green-400 text-[10px] font-bold text-white flex items-center justify-center shadow-md`
- Shows count (e.g. "7")
- On badge click: expand all satellites back, re-run layout

### 1c. LinkNode with Participating Hub Names

**Base state**: SVG diamond 120x80 (unchanged shape)

**Hub name labels**: Rendered as small text labels along the connecting edges, or as a subtitle inside the diamond below the link name.

Preferred approach -- subtitle inside diamond:
- Link name: `text-xs font-semibold text-gray-900` (existing)
- Below it, participating hub names: `text-[9px] text-gray-700 font-normal` e.g. "Customer - Order"
- If more than 2 hubs, diamond scales: `w-[160px] h-[100px]` with viewBox `0 0 160 100`

### 1d. Link Type Visual Variants

**Standard link** (default): solid border, `#fbbf24` fill, `#d97706` stroke (existing)

**Same-as link**:
- Fill: `#ede9fe` (violet-100), stroke: `#a78bfa` (violet-400)
- SVG polygon: `stroke-dasharray="6,3"` for dashed border
- Text color: `text-violet-900`
- Edge style: dashed, color `#a78bfa`

**Hierarchical link**:
- Fill: `#fce7f3` (pink-100), stroke: `#f472b6` (pink-400)
- SVG polygon: double border effect via two nested polygons -- outer with strokeWidth 4, inner with strokeWidth 1, 3px inset
- Text color: `text-pink-900`
- Edge style: solid, color `#f472b6`

---

## 2. Enhanced Relational Nodes (TableNode)

### 2a. BK Badge

Placed inline alongside existing PK/FK badges:
- `text-[9px] px-1 rounded bg-orange-900 text-orange-200 font-bold`
- Renders as: `BK`
- Order in row: column name, then PK (if applicable), then BK (if applicable), then FK (if applicable)
- BK status determined by the DV2 metadata attached to the column

### 2b. Note Indicator on Table Header

- Position: right side of the header bar, vertically centered
- Icon: small "i" in a circle -- rendered as inline SVG, 14x14px
  - Circle: `stroke="currentColor" fill="none" strokeWidth="1.5"`
  - Letter "i": `fill="currentColor"`, 7px tall
- Color: `text-white/50` (semi-transparent white, subtle)
- Hover: `text-white/90`, `cursor-pointer`
- On hover, show tooltip (see 2c)

### 2c. Column Note Tooltip

Triggered on hover over a column row that has a note:
- Indicator: small dot `w-1.5 h-1.5 rounded-full bg-gray-500` to the right of the column type text
- Tooltip container: `absolute left-full ml-2 top-1/2 -translate-y-1/2`
- Style: `bg-gray-900 border border-gray-600 rounded px-2 py-1.5 text-[11px] text-gray-300 shadow-lg max-w-[200px] whitespace-normal z-50`
- Arrow: 4px CSS triangle pointing left

Table-level note tooltip (from header icon):
- Same tooltip style but wider: `max-w-[280px]`
- Positioned below the header: `absolute top-full left-0 mt-1`

### 2d. Table Statistics Footer

- Appears as a final row in the table node, below columns
- Style: `px-3 py-1 text-[10px] text-gray-600 bg-gray-800/50 rounded-b-md border-t border-gray-700`
- Content: column count, e.g. "12 columns"
- Only shown when table has 6+ columns (avoids clutter on small tables)

---

## 3. Validation Panel

### Layout
- Position: bottom of the application, below the split pane, above the StatusBar
- Collapsible: default collapsed (hidden), toggled via toolbar button or StatusBar click
- Expanded height: `h-48` (192px), resizable via drag handle at the top edge
- Container: `bg-gray-900 border-t border-gray-700`

### Header bar
- `h-8 bg-gray-900 border-b border-gray-800 flex items-center px-3 gap-3`
- Title: "Validation" in `text-xs font-semibold text-gray-400`
- Severity filter pills (toggle each):
  - Error: `text-[10px] px-1.5 py-0.5 rounded-full` -- active: `bg-red-900/50 text-red-400`, inactive: `bg-gray-800 text-gray-600`
  - Warning: active `bg-amber-900/50 text-amber-400`, inactive same gray
  - Info: active `bg-blue-900/50 text-blue-400`, inactive same gray
- Each pill shows count: e.g. "3 errors"
- Close/collapse button: `ml-auto text-gray-600 hover:text-gray-400` -- a chevron-down icon

### Message rows
- Scrollable list: `overflow-y-auto`
- Each row: `px-3 py-1.5 flex items-start gap-2 hover:bg-gray-800/50 cursor-pointer text-xs`
- Severity icon (12x12 SVG):
  - Error: filled circle with "!" -- `text-red-400`
  - Warning: triangle with "!" -- `text-amber-400`
  - Info: circle with "i" -- `text-blue-400`
- Message text: `text-gray-300 flex-1`
- Location (right-aligned): `text-gray-600 whitespace-nowrap` e.g. "hub_customer, line 12"
- On click: navigate editor to relevant line, highlight relevant node in diagram with the selection ring

### Empty state
- Centered: checkmark circle icon `text-green-600` + "No issues found" in `text-sm text-gray-600`

---

## 4. Model Statistics

### Placement
- Extends the existing StatusBar (left section stays as-is with parse status)
- Statistics appear on the **right side** of the StatusBar
- StatusBar height unchanged at `h-6`

### Content and layout
- Container: `ml-auto flex items-center gap-4 text-[11px] text-gray-500`
- Each metric is a label-value pair: label in `text-gray-600`, value in `text-gray-400 font-medium`
- Metrics shown:
  - Hubs: count
  - Links: count
  - Satellites: count
  - Tables: count (relational view)
  - Refs: count
- Separator between parse status and stats: `border-l border-gray-700 h-3 mx-3`
- Only DV2-relevant metrics shown when in conceptual view; full table/ref counts in relational view

### Validation status indicator
- If validation errors exist: small red dot `w-1.5 h-1.5 rounded-full bg-red-400` before the stats section
- Click on the dot opens the validation panel
- If no errors: green dot `bg-green-600`

---

## 5. Search / Command Palette

### Overlay
- Trigger: `Cmd+K` (or toolbar search button)
- Centered horizontally, positioned `top-[20%]` of viewport
- Backdrop: `fixed inset-0 bg-black/40 z-40` with `backdrop-blur-sm`
- Container: `w-[480px] bg-gray-900 border border-gray-600 rounded-lg shadow-2xl z-50 overflow-hidden`
- Appear animation: `animate-in fade-in slide-in-from-top-2 duration-150`

### Search input
- `px-4 py-3 bg-transparent text-sm text-gray-200 placeholder-gray-600 w-full outline-none border-b border-gray-700`
- Placeholder: "Search entities..."
- Search icon (magnifying glass) `text-gray-600` left of input, 16x16
- `Esc` label hint: `text-[10px] text-gray-700 bg-gray-800 px-1 rounded` in the right corner of input

### Results list
- `max-h-[320px] overflow-y-auto`
- Each result row: `px-4 py-2 flex items-center gap-3 cursor-pointer`
- Default: `text-gray-400`
- Keyboard-focused/hovered: `bg-gray-800 text-gray-200`
- Entity type icon (left):
  - Hub: small amber dot `w-2.5 h-2.5 rounded-sm bg-amber-400`
  - Satellite: small green dot `w-2.5 h-2.5 rounded-full bg-green-400`
  - Link: small amber diamond (rotated square) `w-2.5 h-2.5 bg-amber-400 rotate-45`
  - Table: small gray rect `w-2.5 h-2.5 rounded-sm bg-gray-500`
  - Enum: small indigo rect `w-2.5 h-2.5 rounded-sm bg-indigo-500`
- Entity name: `text-sm text-gray-200 font-medium`
- Entity type label: `text-[10px] text-gray-600 ml-auto uppercase tracking-wider`
- Matched substring highlighted: `text-amber-300` (hub) or `text-blue-300` (general)

### Footer
- `px-4 py-2 border-t border-gray-700 flex items-center gap-4 text-[10px] text-gray-600`
- Keyboard hints: "Up/Down to navigate", "Enter to select", "Esc to close"

### Diagram effect on select
- Viewport pans to center on the selected node
- Selected node gets `ring-2 ring-blue-500 ring-offset-2 ring-offset-gray-950` for 3 seconds, then fades
- Transition: `transition-shadow duration-300`

---

## 6. Toolbar Enhancements

### Current layout
`h-10 bg-gray-900 border-b border-gray-700`, brand left, buttons center-left, project name right.

### Enhanced layout (left to right)

1. **Brand**: "XineMap" -- unchanged
2. **File group**: New | Projects | Export -- unchanged, existing `btnClass`
3. **Separator**: `border-l border-gray-700 h-4 mx-2`
4. **View mode segmented control**: replaces current toggle button
   - Container: `inline-flex bg-gray-800 rounded p-0.5 border border-gray-700`
   - Each segment: `text-xs px-3 py-1 rounded transition-colors duration-100`
   - Active: `bg-gray-700 text-gray-200 font-medium`
   - Inactive: `text-gray-500 hover:text-gray-400`
   - Labels: "Relational" | "Conceptual"
5. **Layout buttons**: Auto Layout, Direction toggle -- unchanged styling
6. **Separator**: same as above
7. **Search button**:
   - `text-gray-500 hover:text-gray-300 p-1.5 rounded hover:bg-gray-800`
   - Magnifying glass icon 16x16
   - Keyboard hint: `text-[9px] text-gray-700 ml-1` showing "Cmd+K"
8. **Validation toggle**:
   - `text-gray-500 hover:text-gray-300 p-1.5 rounded hover:bg-gray-800`
   - Checkmark-list icon 16x16
   - When panel open: `text-blue-400 bg-gray-800`
   - Error count badge (if >0): `absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-red-500 text-[8px] text-white flex items-center justify-center font-bold`
9. **Presentation mode button**:
   - `text-gray-500 hover:text-gray-300 p-1.5 rounded hover:bg-gray-800`
   - Expand/maximize icon 16x16
10. **Right side**: project name -- unchanged

---

## 7. Presentation Mode

### Trigger
- Toolbar button or keyboard shortcut `Cmd+Shift+P`
- Enters/exits with `transition-opacity duration-300`

### What gets hidden
- Toolbar (full bar)
- StatusBar (full bar)
- Editor panel (left pane)
- Validation panel
- React Flow Controls
- Panel buttons (Auto Layout, etc.)
- Background dots become subtle: color changes from `#374151` to `#1f2937`

### What remains visible
- Diagram canvas fills entire viewport: `fixed inset-0 bg-gray-950 z-30`
- Nodes and edges (fully interactive: pan, zoom)
- Minimap (if enabled)

### Floating escape bar
- Appears at top-center after 2s of inactivity, fades in
- `fixed top-4 left-1/2 -translate-x-1/2 bg-gray-900/80 backdrop-blur-sm border border-gray-700 rounded-full px-4 py-1.5 z-40`
- Text: "Press Esc to exit" in `text-xs text-gray-500`
- Fades out on mouse move, reappears after 2s idle

### Node interaction in presentation
- Click on any node: shows a **detail card** floating beside the node
- Detail card: `bg-gray-900 border border-gray-600 rounded-lg shadow-2xl p-4 min-w-[220px] max-w-[300px] z-50`
- For Hub: name (amber), business keys, satellite list, link connections
- For Table: name, column list with types and badges
- For Satellite: name, parent hub, attribute list
- Click elsewhere or press Esc to dismiss
- Text styling: heading `text-sm font-semibold text-gray-200`, body `text-xs text-gray-400`, badges same as relational view

---

## 8. Minimap

### Activation
- Enabled by default, toggleable via a small button in diagram panel bottom-right corner
- Toggle button: `bg-gray-800 border border-gray-600 text-gray-500 hover:text-gray-300 p-1 rounded text-xs` with a map/grid icon

### Position and size
- Bottom-right corner of diagram canvas, `16px` from edges
- Default size: `w-[200px] h-[140px]`
- Uses React Flow's built-in `<MiniMap>` component

### Styling
- Container: `bg-gray-900/90 border border-gray-700 rounded-md overflow-hidden shadow-lg`
- Node colors map to entity types via `nodeColor` prop:
  - hubNode: `#fbbf24` (amber-400)
  - satelliteNode: `#4ade80` (green-400)
  - linkNode: `#d97706` (amber-600)
  - tableNode: `#374151` (gray-700)
  - enumNode: `#4338ca` (indigo-700)
  - noteNode: `#ca8a04` (yellow-600)
  - conceptNode: `#4b5563` (gray-600)
- Viewport indicator: `stroke: #3b82f6` (blue-500), `fill: #3b82f6/10`
- Background: `#0a0a0a` (near-black)
- `maskColor="rgb(0,0,0,0.7)"`

---

## Summary of Z-Index Layers

| Layer | Z-index | Content |
|-------|---------|---------|
| Diagram canvas | 0 | Nodes, edges, minimap |
| Hover popovers | 50 | Node detail tooltips |
| Toolbar/StatusBar | 10 | Fixed chrome |
| Validation panel | 20 | Collapsible bottom panel |
| Presentation mode | 30 | Full-screen diagram |
| Presentation escape bar | 40 | Floating hint |
| Command palette backdrop | 40 | Dimmed overlay |
| Command palette | 50 | Search dialog |
| Detail cards | 50 | Presentation mode detail |

---

## Animation Summary

| Element | Trigger | Animation |
|---------|---------|-----------|
| Hub popover | mouseenter (300ms delay) | `opacity 0->1, translateY 4px->0, duration-150` |
| Search palette | Cmd+K | `opacity 0->1, translateY -8px->0, duration-150` |
| Search highlight ring | entity selected | `ring appears, fades after 3s via duration-300` |
| Presentation enter | button click | `opacity 0->1 duration-300` |
| Presentation escape bar | 2s idle | `opacity 0->1 duration-500`, reverse on mouse move |
| Validation panel | toggle | `h-0 -> h-48, duration-200, ease-out` |
| Satellite collapse | toggle | satellites `opacity 1->0 scale-100->90 duration-200`, badge `scale-0->100 duration-200` |
| Segmented control | click | `bg-gray-700 slides via transition-colors duration-100` |

---

All dimensions use the project's existing text-xs/text-sm scale. All colors extend the gray-950..gray-200 dark palette already established. Interactive states follow the existing pattern of `hover:text-gray-200` against `text-gray-400` defaults. No new font families or external icon libraries required -- all icons are inline SVG.
