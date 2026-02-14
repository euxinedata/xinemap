import { useCallback, useEffect, useRef, useState } from 'react'
import { ReactFlow, ReactFlowProvider, Controls, Background, BackgroundVariant, Panel, useReactFlow, useViewport, type Node, type Edge } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useDiagramStore, type LayoutMode, type ViewMode } from '../store/useDiagramStore'
import { useEditorStore } from '../store/useEditorStore'
import { useProjectStore } from '../store/useProjectStore'
import { parseResultToFlow } from '../parser/dbmlToFlow'
import { parseResultToConceptualFlow } from '../parser/conceptualToFlow'
import { layoutNodes } from './layoutEngine'
import * as storage from '../persistence/gitStorage'
import type { DV2Metadata, StoredLayout } from '../types'
import { assignEdgeHandles } from './edgeHandles'
import { DV2_COLORS } from './dv2Colors'
import { TableNode } from './TableNode'
import { EnumNode } from './EnumNode'
import { EREdge } from './EREdge'
import { HubNode } from './conceptual/HubNode'
import { SatelliteNode } from './conceptual/SatelliteNode'
import { LinkNode } from './conceptual/LinkNode'
import { NoteNode } from './conceptual/NoteNode'
import { ConceptNode } from './conceptual/ConceptNode'
import { CommandPalette } from '../components/CommandPalette'
import { FocusModal } from './FocusModal'
import { ConfirmDialog } from '../components/InlineDialog'
import { computeSnap, type GuideLine } from './snapAlign'

const nodeTypes = {
  tableNode: TableNode,
  enumNode: EnumNode,
  hubNode: HubNode,
  satelliteNode: SatelliteNode,
  linkNode: LinkNode,
  noteNode: NoteNode,
  conceptNode: ConceptNode,
}
const edgeTypes = { erEdge: EREdge }

function filterCollapsedSatellites(
  nodes: Node[],
  edges: Edge[],
  collapsedHubs: Set<string>,
  dv2Metadata: Map<string, DV2Metadata>,
): { nodes: Node[]; edges: Edge[] } {
  // Build satellite count per hub
  const satCountByHub = new Map<string, number>()
  for (const [, meta] of dv2Metadata) {
    if (meta.entityType === 'satellite') {
      for (const parentHub of meta.parentHubs) {
        const pm = dv2Metadata.get(parentHub)
        if (pm?.entityType === 'hub' || pm?.entityType === 'link') {
          satCountByHub.set(parentHub, (satCountByHub.get(parentHub) ?? 0) + 1)
        }
      }
    }
  }

  // Determine which satellite nodes to hide
  const hiddenNodeIds = new Set<string>()
  for (const [tableId, meta] of dv2Metadata) {
    if (meta.entityType === 'satellite' && meta.parentHubs.some((h) => collapsedHubs.has(h))) {
      hiddenNodeIds.add(tableId)
    }
  }

  // Annotate hub nodes and filter satellites
  const filteredNodes = nodes
    .filter((n) => !hiddenNodeIds.has(n.id))
    .map((n) => {
      const satCount = satCountByHub.get(n.id)
      if (satCount != null && satCount > 0) {
        return { ...n, data: { ...n.data, satelliteCount: satCount, isCollapsed: collapsedHubs.has(n.id) } }
      }
      return n
    })

  const filteredEdges = edges.filter((e) => !hiddenNodeIds.has(e.source) && !hiddenNodeIds.has(e.target))

  return { nodes: filteredNodes, edges: filteredEdges }
}

function SnapGuides({ guides }: { guides: GuideLine[] }) {
  const { x: vx, y: vy, zoom } = useViewport()
  if (guides.length === 0) return null
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden z-50">
      {guides.map((g, i) =>
        g.axis === 'x' ? (
          <div key={i} className="absolute top-0 h-full" style={{ left: g.pos * zoom + vx, width: 0, borderLeft: '1px dashed rgba(120,120,120,0.6)' }} />
        ) : (
          <div key={i} className="absolute left-0 w-full" style={{ top: g.pos * zoom + vy, height: 0, borderTop: '1px dashed rgba(120,120,120,0.6)' }} />
        ),
      )}
    </div>
  )
}

function DiagramPanelInner() {
  const { nodes, edges, setNodes, setEdges, onNodesChange, onEdgesChange, layoutMode, setLayoutMode, viewMode, setViewMode, storedLayout, setStoredLayout } = useDiagramStore()
  const collapsedHubs = useDiagramStore((s) => s.collapsedHubs)
  const parseResult = useEditorStore((s) => s.parseResult)
  const [focusedTableId, setFocusedTableId] = useState<string | null>(null)
  const [layoutMenuOpen, setLayoutMenuOpen] = useState(false)
  const [browseOpen, setBrowseOpen] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null)
  const [guides, setGuides] = useState<GuideLine[]>([])
  const [pendingLayout, setPendingLayout] = useState<LayoutMode | null>(null)
  const [pendingDelete, setPendingDelete] = useState<{ nodeId: string; tableName: string } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const browseRef = useRef<HTMLDivElement>(null)
  const ctxMenuRef = useRef<HTMLDivElement>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { fitView } = useReactFlow()

  // Wrap onNodesChange to snap positions during drag
  const handleNodesChange = useCallback((changes: import('@xyflow/react').NodeChange[]) => {
    const modified = changes.map((change) => {
      if (change.type === 'position' && change.dragging && change.position) {
        const allNodes = useDiagramStore.getState().nodes
        const node = allNodes.find((n) => n.id === change.id)
        if (node) {
          const w = node.measured?.width ?? 250
          const h = node.measured?.height ?? 100
          const snap = computeSnap(change.id, change.position, { width: w, height: h }, allNodes)
          setGuides(snap.guides)
          return { ...change, position: { x: snap.x, y: snap.y } }
        }
      }
      if (change.type === 'position' && !change.dragging) {
        setGuides([])
      }
      return change
    })
    onNodesChange(modified)
  }, [onNodesChange])

  // Helper: save positions to storedLayout and persist to git
  const savePositions = useCallback((currentNodes: Node[]) => {
    const positions: Record<string, { x: number; y: number }> = {}
    for (const n of currentNodes) {
      positions[n.id] = { x: n.position.x, y: n.position.y }
    }
    const prev = useDiagramStore.getState().storedLayout
    const collapsed = useDiagramStore.getState().collapsedHubs
    const updated: StoredLayout = { ...prev, [viewMode]: positions, layoutMode, collapsedIds: [...collapsed] }
    setStoredLayout(updated)

    const projectId = useProjectStore.getState().currentProjectId
    if (projectId) {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        storage.saveLayout(projectId, updated)
      }, 500)
    }
  }, [viewMode, layoutMode, setStoredLayout])

  useEffect(() => {
    if (!parseResult) {
      setNodes([])
      setEdges([])
      return
    }
    let stale = false
    const convert = viewMode === 'conceptual' ? parseResultToConceptualFlow : parseResultToFlow
    const { nodes: flowNodes, edges: flowEdges } = convert(parseResult)

    const { nodes: visibleNodes, edges: visibleEdges } =
      viewMode === 'relational'
        ? filterCollapsedSatellites(flowNodes, flowEdges, collapsedHubs, parseResult.dv2Metadata)
        : { nodes: flowNodes, edges: flowEdges }

    // Check if we have stored positions for this view mode
    const stored = storedLayout?.[viewMode]
    if (stored && Object.keys(stored).length > 0) {
      // Apply stored positions
      const laid = visibleNodes.map((n) => {
        const pos = stored[n.id]
        return pos ? { ...n, position: { x: pos.x, y: pos.y } } : n
      })
      // Check if any nodes are missing positions (new tables added)
      const hasNewNodes = visibleNodes.some((n) => !stored[n.id])
      if (hasNewNodes) {
        // Run layout for all nodes, but only use positions for new ones
        layoutNodes(visibleNodes, visibleEdges, layoutMode).then((autoLaid) => {
          if (stale) return
          const merged = autoLaid.map((n) => {
            const pos = stored[n.id]
            return pos ? { ...n, position: { x: pos.x, y: pos.y } } : n
          })
          setNodes(merged)
          setEdges(assignEdgeHandles(merged, visibleEdges))
          requestAnimationFrame(() => fitView({ padding: 0.2 }))
          savePositions(merged)
        })
      } else {
        if (!stale) {
          setNodes(laid)
          setEdges(assignEdgeHandles(laid, visibleEdges))
          requestAnimationFrame(() => fitView({ padding: 0.2 }))
        }
      }
    } else {
      // No stored positions — run auto-layout
      layoutNodes(visibleNodes, visibleEdges, layoutMode).then((laid) => {
        if (!stale) {
          setNodes(laid)
          setEdges(assignEdgeHandles(laid, visibleEdges))
          requestAnimationFrame(() => fitView({ padding: 0.2 }))
          savePositions(laid)
        }
      })
    }
    return () => { stale = true }
  }, [parseResult, viewMode, collapsedHubs, setNodes, setEdges, fitView]) // Note: layoutMode intentionally excluded — auto-layout only on explicit click

  // Persist collapsed state when it changes
  useEffect(() => {
    const prev = useDiagramStore.getState().storedLayout
    if (!prev) return
    const updated: StoredLayout = { ...prev, collapsedIds: [...collapsedHubs] }
    setStoredLayout(updated)
    const projectId = useProjectStore.getState().currentProjectId
    if (projectId) {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        storage.saveLayout(projectId, updated)
      }, 500)
    }
  }, [collapsedHubs, setStoredLayout])

  // Close dropdown on outside click
  useEffect(() => {
    if (!layoutMenuOpen) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as HTMLElement)) {
        setLayoutMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [layoutMenuOpen])

  // Close browse dropdown on outside click
  useEffect(() => {
    if (!browseOpen) return
    const handler = (e: MouseEvent) => {
      if (browseRef.current && !browseRef.current.contains(e.target as HTMLElement)) {
        setBrowseOpen(false)
      }
    }
    document.addEventListener('mousedown', handler, true)
    return () => document.removeEventListener('mousedown', handler, true)
  }, [browseOpen])

  // Build grouped entity list for browse panel
  const browseGroups = (() => {
    if (!parseResult) return []
    const groups: { type: string; color: string; items: { id: string; name: string }[] }[] = [
      { type: 'Hubs', color: DV2_COLORS.hub.bg, items: [] },
      { type: 'Links', color: DV2_COLORS.link.bg, items: [] },
      { type: 'Satellites', color: DV2_COLORS.satellite.bg, items: [] },
    ]
    for (const table of parseResult.tables) {
      const et = parseResult.dv2Metadata.get(table.id)?.entityType
      const target = et === 'hub' ? groups[0] : et === 'link' ? groups[1] : et === 'satellite' ? groups[2] : null
      if (target) target.items.push({ id: table.id, name: table.name })
    }
    for (const g of groups) g.items.sort((a, b) => a.name.localeCompare(b.name))
    return groups.filter((g) => g.items.length > 0)
  })()

  // Auto Layout with confirmation
  const handleLayoutSelect = useCallback((mode: LayoutMode) => {
    setLayoutMenuOpen(false)
    const hasStoredPositions = storedLayout?.[viewMode] && Object.keys(storedLayout[viewMode]!).length > 0
    if (hasStoredPositions) {
      setPendingLayout(mode)
      return
    }
    applyLayout(mode)
  }, [storedLayout, viewMode])

  const applyLayout = useCallback((mode: LayoutMode) => {
    // Clear stored positions for current view, keep other view's positions
    const updated: StoredLayout = { ...storedLayout, [viewMode]: undefined, layoutMode: mode }
    setStoredLayout(updated)
    setLayoutMode(mode)

    // Run layout immediately
    if (!parseResult) return
    const convert = viewMode === 'conceptual' ? parseResultToConceptualFlow : parseResultToFlow
    const { nodes: flowNodes, edges: flowEdges } = convert(parseResult)
    const { nodes: visibleNodes, edges: visibleEdges } =
      viewMode === 'relational'
        ? filterCollapsedSatellites(flowNodes, flowEdges, collapsedHubs, parseResult.dv2Metadata)
        : { nodes: flowNodes, edges: flowEdges }

    layoutNodes(visibleNodes, visibleEdges, mode).then((laid) => {
      setNodes(laid)
      setEdges(assignEdgeHandles(laid, visibleEdges))
      requestAnimationFrame(() => fitView({ padding: 0.2 }))
      // Save new positions
      const positions: Record<string, { x: number; y: number }> = {}
      for (const n of laid) {
        positions[n.id] = { x: n.position.x, y: n.position.y }
      }
      const finalLayout: StoredLayout = { ...updated, [viewMode]: positions, layoutMode: mode }
      setStoredLayout(finalLayout)
      const projectId = useProjectStore.getState().currentProjectId
      if (projectId) storage.saveLayout(projectId, finalLayout)
    })
  }, [storedLayout, viewMode, parseResult, collapsedHubs, setStoredLayout, setLayoutMode, setNodes, setEdges, fitView])

  const handleLayoutConfirm = useCallback(() => {
    if (pendingLayout) applyLayout(pendingLayout)
    setPendingLayout(null)
  }, [pendingLayout, applyLayout])

  const toggleView = useCallback(() => {
    const next: ViewMode = viewMode === 'relational' ? 'conceptual' : 'relational'
    setViewMode(next)
  }, [viewMode, setViewMode])

  // Save positions and reassign edge handles on node drag stop
  const handleNodeDragStop = useCallback((_: React.MouseEvent, _node: Node, draggedNodes: Node[]) => {
    setGuides([])
    const currentNodes = useDiagramStore.getState().nodes
    const currentEdges = useDiagramStore.getState().edges
    const draggedMap = new Map(draggedNodes.map((n) => [n.id, n.position]))
    const updatedNodes = currentNodes.map((n) => {
      const pos = draggedMap.get(n.id)
      return pos ? { ...n, position: pos } : n
    })
    setEdges(assignEdgeHandles(updatedNodes, currentEdges))
    savePositions(updatedNodes)
  }, [savePositions, setEdges])

  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    const line = (node.data as any)?.line
    if (line) useEditorStore.getState().scrollToLine?.(line)
  }, [])

  // Alignment actions for multi-selected nodes
  const selectedNodes = nodes.filter((n) => n.selected)
  const alignNodes = useCallback((axis: 'left' | 'centerX' | 'right' | 'top' | 'centerY' | 'bottom') => {
    const sel = useDiagramStore.getState().nodes.filter((n) => n.selected)
    if (sel.length < 2) return
    let target: number
    if (axis === 'left') target = Math.min(...sel.map((n) => n.position.x))
    else if (axis === 'right') target = Math.max(...sel.map((n) => n.position.x + (n.measured?.width ?? 250)))
    else if (axis === 'centerX') { const xs = sel.map((n) => n.position.x + (n.measured?.width ?? 250) / 2); target = xs.reduce((a, b) => a + b, 0) / xs.length }
    else if (axis === 'top') target = Math.min(...sel.map((n) => n.position.y))
    else if (axis === 'bottom') target = Math.max(...sel.map((n) => n.position.y + (n.measured?.height ?? 100)))
    else { const ys = sel.map((n) => n.position.y + (n.measured?.height ?? 100) / 2); target = ys.reduce((a, b) => a + b, 0) / ys.length }

    const selIds = new Set(sel.map((n) => n.id))
    const updated = useDiagramStore.getState().nodes.map((n) => {
      if (!selIds.has(n.id)) return n
      const w = n.measured?.width ?? 250
      const h = n.measured?.height ?? 100
      let pos = n.position
      if (axis === 'left') pos = { ...pos, x: target }
      else if (axis === 'right') pos = { ...pos, x: target - w }
      else if (axis === 'centerX') pos = { ...pos, x: target - w / 2 }
      else if (axis === 'top') pos = { ...pos, y: target }
      else if (axis === 'bottom') pos = { ...pos, y: target - h }
      else pos = { ...pos, y: target - h / 2 }
      return { ...n, position: pos }
    })
    setNodes(updated)
    setEdges(assignEdgeHandles(updated, useDiagramStore.getState().edges))
    savePositions(updated)
  }, [setNodes, setEdges, savePositions])

  const distributeNodes = useCallback((mode: 'spaceH' | 'spaceV' | 'centerH' | 'centerV' | 'compactH' | 'compactV') => {
    const sel = useDiagramStore.getState().nodes.filter((n) => n.selected)
    if (sel.length < 3 && (mode === 'spaceH' || mode === 'spaceV' || mode === 'centerH' || mode === 'centerV')) return
    if (sel.length < 2) return

    const selIds = new Set(sel.map((n) => n.id))
    const posMap = new Map<string, { x: number; y: number }>()

    if (mode === 'spaceH' || mode === 'compactH') {
      const sorted = [...sel].sort((a, b) => a.position.x - b.position.x)
      const totalWidth = sorted.reduce((s, n) => s + (n.measured?.width ?? 250), 0)
      const span = sorted[sorted.length - 1].position.x + (sorted[sorted.length - 1].measured?.width ?? 250) - sorted[0].position.x
      const gap = mode === 'compactH' ? 0 : (span - totalWidth) / (sorted.length - 1)
      let x = sorted[0].position.x
      for (const n of sorted) {
        posMap.set(n.id, { x, y: n.position.y })
        x += (n.measured?.width ?? 250) + gap
      }
    } else if (mode === 'spaceV' || mode === 'compactV') {
      const sorted = [...sel].sort((a, b) => a.position.y - b.position.y)
      const totalHeight = sorted.reduce((s, n) => s + (n.measured?.height ?? 100), 0)
      const span = sorted[sorted.length - 1].position.y + (sorted[sorted.length - 1].measured?.height ?? 100) - sorted[0].position.y
      const gap = mode === 'compactV' ? 0 : (span - totalHeight) / (sorted.length - 1)
      let y = sorted[0].position.y
      for (const n of sorted) {
        posMap.set(n.id, { x: n.position.x, y })
        y += (n.measured?.height ?? 100) + gap
      }
    } else if (mode === 'centerH') {
      const sorted = [...sel].sort((a, b) => a.position.x - b.position.x)
      const firstCenter = sorted[0].position.x + (sorted[0].measured?.width ?? 250) / 2
      const lastCenter = sorted[sorted.length - 1].position.x + (sorted[sorted.length - 1].measured?.width ?? 250) / 2
      const step = (lastCenter - firstCenter) / (sorted.length - 1)
      for (let i = 0; i < sorted.length; i++) {
        const n = sorted[i]
        const cx = firstCenter + step * i
        posMap.set(n.id, { x: cx - (n.measured?.width ?? 250) / 2, y: n.position.y })
      }
    } else {
      const sorted = [...sel].sort((a, b) => a.position.y - b.position.y)
      const firstCenter = sorted[0].position.y + (sorted[0].measured?.height ?? 100) / 2
      const lastCenter = sorted[sorted.length - 1].position.y + (sorted[sorted.length - 1].measured?.height ?? 100) / 2
      const step = (lastCenter - firstCenter) / (sorted.length - 1)
      for (let i = 0; i < sorted.length; i++) {
        const n = sorted[i]
        const cy = firstCenter + step * i
        posMap.set(n.id, { x: n.position.x, y: cy - (n.measured?.height ?? 100) / 2 })
      }
    }

    const updated = useDiagramStore.getState().nodes.map((n) => {
      const pos = posMap.get(n.id)
      return pos ? { ...n, position: pos } : n
    })
    setNodes(updated)
    setEdges(assignEdgeHandles(updated, useDiagramStore.getState().edges))
    savePositions(updated)
  }, [setNodes, setEdges, savePositions])

  const handleEdgeClick = useCallback((_: React.MouseEvent, edge: Edge) => {
    const line = (edge.data as any)?.line
    if (line) useEditorStore.getState().scrollToLine?.(line)
  }, [])

  const handleNodeDoubleClick = useCallback((_: React.MouseEvent, node: Node) => {
    setFocusedTableId(node.id)
  }, [])

  const handleNodeContextMenu = useCallback((e: React.MouseEvent, node: Node) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, nodeId: node.id })
  }, [])

  const handleDeleteNode = useCallback(() => {
    if (!contextMenu) return
    const node = nodes.find((n) => n.id === contextMenu.nodeId)
    if (!node) return
    const tableName = (node.data as any)?.table?.name ?? (node.data as any)?.label ?? ''
    setContextMenu(null)
    setPendingDelete({ nodeId: contextMenu.nodeId, tableName })
  }, [contextMenu, nodes])

  const executeDelete = useCallback(() => {
    if (!pendingDelete) return
    const node = nodes.find((n) => n.id === pendingDelete.nodeId)
    if (!node) { setPendingDelete(null); return }
    const tableName = pendingDelete.tableName
    setPendingDelete(null)
    const line = (node.data as any)?.table?.line ?? (node.data as any)?.line
    if (!line) return

    const dbml = useEditorStore.getState().dbml
    const lines = dbml.split('\n')
    const startIdx = line - 1 // 1-indexed to 0-indexed

    // Find closing brace tracking depth
    let depth = 0
    let endIdx = startIdx
    for (let i = startIdx; i < lines.length; i++) {
      for (const ch of lines[i]) {
        if (ch === '{') depth++
        if (ch === '}') depth--
      }
      if (depth <= 0) { endIdx = i; break }
    }

    // Remove trailing blank line if present
    if (endIdx + 1 < lines.length && lines[endIdx + 1].trim() === '') endIdx++

    // Ref cleanup using qualified name
    const schemaName = (node.data as any)?.table?.schema
    const qualifiedName = schemaName && schemaName !== 'public' ? `${schemaName}.${tableName}` : tableName

    // Remove table block
    lines.splice(startIdx, endIdx - startIdx + 1)

    // Remove Ref lines and TableGroup entries that reference this table
    const cleaned = lines.filter((l) => {
      const trimmed = l.trim()
      if (trimmed.startsWith('Ref') && trimmed.includes(qualifiedName)) return false
      if (trimmed === qualifiedName || trimmed === tableName) return false
      return true
    })

    useEditorStore.getState().setDbml(cleaned.join('\n'))
  }, [pendingDelete, nodes])

  // Close context menu on click outside or escape
  useEffect(() => {
    if (!contextMenu) return
    const handleClose = (e: MouseEvent) => {
      if (ctxMenuRef.current && ctxMenuRef.current.contains(e.target as HTMLElement)) return
      setContextMenu(null)
    }
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setContextMenu(null) }
    document.addEventListener('mousedown', handleClose, true)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClose, true)
      document.removeEventListener('keydown', handleKey)
    }
  }, [contextMenu])

  return (
    <div className="h-full bg-[var(--c-bg-2)]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={handleNodeDragStop}
        onNodeClick={handleNodeClick}
        onEdgeClick={handleEdgeClick}
        onNodeDoubleClick={handleNodeDoubleClick}
        onNodeContextMenu={handleNodeContextMenu}
      >
        <Controls />
        <Background variant={BackgroundVariant.Dots} color="var(--c-dots)" />
        <SnapGuides guides={guides} />
        <Panel position="top-right" className="flex gap-1">
          <button
            onClick={() => useDiagramStore.getState().setSearchOpen(true)}
            className="bg-[var(--c-bg-3)] border border-[var(--c-border-s)] text-[var(--c-text-3)] hover:text-[var(--c-text-1)] text-xs px-2 py-1 rounded flex items-center gap-1"
            title="Search (⌘K)"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
            </svg>
            Search
          </button>
          <div ref={menuRef} className="relative">
            <button
              onClick={() => setLayoutMenuOpen((o) => !o)}
              className="flex items-center gap-1.5 bg-[var(--c-bg-3)] border border-[var(--c-border-s)] text-[var(--c-text-3)] hover:text-[var(--c-text-1)] text-xs px-2 py-1 rounded"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="1" width="4" height="4" rx="0.5" /><rect x="9" y="1" width="4" height="4" rx="0.5" /><rect x="5" y="9" width="4" height="4" rx="0.5" /><line x1="3" y1="5" x2="3" y2="7" /><line x1="11" y1="5" x2="11" y2="7" /><line x1="3" y1="7" x2="11" y2="7" /><line x1="7" y1="7" x2="7" y2="9" /></svg>
              Auto Layout
            </button>
            {layoutMenuOpen && (
              <div className="absolute top-full right-0 mt-1 bg-[var(--c-bg-1)] border border-[var(--c-border-s)] rounded shadow-lg z-10 min-w-[120px]">
                {([['spread', 'Spread'], ['dense', 'Dense']] as const).map(([mode, label]) => (
                  <div
                    key={mode}
                    onClick={() => handleLayoutSelect(mode)}
                    className={`px-3 py-1.5 text-xs cursor-pointer ${
                      layoutMode === mode ? 'text-[var(--c-text-1)] bg-[var(--c-bg-3)]' : 'text-[var(--c-text-3)]'
                    } hover:bg-[var(--c-bg-3)] hover:text-[var(--c-text-1)]`}
                  >
                    {label}
                  </div>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={toggleView}
            className="flex items-center gap-1.5 bg-[var(--c-bg-3)] border border-[var(--c-border-s)] text-[var(--c-text-3)] hover:text-[var(--c-text-1)] text-xs px-2 py-1 rounded"
          >
            {viewMode === 'relational'
              ? <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="1" width="5" height="3" rx="0.5" /><rect x="8" y="1" width="5" height="3" rx="0.5" /><rect x="1" y="6" width="5" height="3" rx="0.5" /><rect x="8" y="10" width="5" height="3" rx="0.5" /><line x1="6" y1="2.5" x2="8" y2="2.5" /><line x1="3.5" y1="4" x2="3.5" y2="6" /><line x1="6" y1="7.5" x2="8" y2="12" /></svg>
              : <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><circle cx="7" cy="4" r="2.5" /><rect x="1" y="9" width="4" height="2.5" rx="0.5" /><rect x="9" y="9" width="4" height="2.5" rx="0.5" /><line x1="5.5" y1="6" x2="3" y2="9" /><line x1="8.5" y1="6" x2="11" y2="9" /></svg>
            }
            {viewMode === 'relational' ? 'Relational' : 'Conceptual'}
          </button>
          <div ref={browseRef} className="relative">
            <button
              onClick={() => setBrowseOpen((o) => !o)}
              className="flex items-center gap-1.5 bg-[var(--c-bg-3)] border border-[var(--c-border-s)] text-[var(--c-text-3)] hover:text-[var(--c-text-1)] text-xs px-2 py-1 rounded"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><line x1="2" y1="3" x2="12" y2="3" /><line x1="2" y1="7" x2="12" y2="7" /><line x1="2" y1="11" x2="12" y2="11" /><circle cx="2" cy="3" r="0.5" fill="currentColor" /><circle cx="2" cy="7" r="0.5" fill="currentColor" /><circle cx="2" cy="11" r="0.5" fill="currentColor" /></svg>
              Browse
            </button>
            {browseOpen && browseGroups.length > 0 && (
              <div className="absolute top-full right-0 mt-1 bg-[var(--c-bg-1)] border border-[var(--c-border-s)] rounded shadow-lg z-10 min-w-[180px]">
                {browseGroups.map((group) => (
                  <div key={group.type}>
                    <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white" style={{ backgroundColor: group.color }}>
                      {group.type}
                    </div>
                    {group.items.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => {
                          fitView({ nodes: [{ id: item.id }], duration: 300, padding: 0.5 })
                          setBrowseOpen(false)
                        }}
                        className="px-3 py-1.5 text-xs cursor-pointer text-[var(--c-text-3)] hover:bg-[var(--c-bg-3)] hover:text-[var(--c-text-1)]"
                      >
                        {item.name}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </Panel>
        {selectedNodes.length === 1 && (
          <Panel position="bottom-center" className="bg-[var(--c-bg-1)] border border-[var(--c-border-s)] rounded px-2 py-1 shadow">
            <span className="text-[10px] text-[var(--c-text-4)]">{navigator.platform.includes('Mac') ? '\u2318' : 'Ctrl'}+Click to select more</span>
          </Panel>
        )}
        {selectedNodes.length >= 2 && (
          <Panel position="bottom-center" className="flex gap-1 bg-[var(--c-bg-1)] border border-[var(--c-border-s)] rounded px-2 py-1 shadow">
            {([
              ['left', 'Align Left', <svg key="left" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="2" y1="1" x2="2" y2="13" /><rect x="4" y="3" width="8" height="3" rx="0.5" fill="currentColor" opacity="0.3" /><rect x="4" y="8" width="5" height="3" rx="0.5" fill="currentColor" opacity="0.3" /></svg>],
              ['centerX', 'Center H', <svg key="centerX" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="7" y1="1" x2="7" y2="13" strokeDasharray="2 1" /><rect x="2" y="3" width="10" height="3" rx="0.5" fill="currentColor" opacity="0.3" /><rect x="3.5" y="8" width="7" height="3" rx="0.5" fill="currentColor" opacity="0.3" /></svg>],
              ['right', 'Align Right', <svg key="right" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="12" y1="1" x2="12" y2="13" /><rect x="2" y="3" width="8" height="3" rx="0.5" fill="currentColor" opacity="0.3" /><rect x="5" y="8" width="5" height="3" rx="0.5" fill="currentColor" opacity="0.3" /></svg>],
              ['top', 'Align Top', <svg key="top" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="1" y1="2" x2="13" y2="2" /><rect x="3" y="4" width="3" height="8" rx="0.5" fill="currentColor" opacity="0.3" /><rect x="8" y="4" width="3" height="5" rx="0.5" fill="currentColor" opacity="0.3" /></svg>],
              ['centerY', 'Center V', <svg key="centerY" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="1" y1="7" x2="13" y2="7" strokeDasharray="2 1" /><rect x="3" y="2" width="3" height="10" rx="0.5" fill="currentColor" opacity="0.3" /><rect x="8" y="3.5" width="3" height="7" rx="0.5" fill="currentColor" opacity="0.3" /></svg>],
              ['bottom', 'Align Bottom', <svg key="bottom" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="1" y1="12" x2="13" y2="12" /><rect x="3" y="2" width="3" height="8" rx="0.5" fill="currentColor" opacity="0.3" /><rect x="8" y="5" width="3" height="5" rx="0.5" fill="currentColor" opacity="0.3" /></svg>],
            ] as [string, string, React.ReactNode][]).map(([axis, label, icon]) => (
              <button
                key={axis}
                onClick={() => alignNodes(axis as any)}
                className="group relative p-1.5 rounded text-[var(--c-text-3)] hover:text-[var(--c-text-1)] hover:bg-[var(--c-bg-3)] cursor-pointer"
              >
                {icon}
                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-1.5 py-0.5 text-[10px] rounded bg-[var(--c-bg-3)] border border-[var(--c-border-s)] text-[var(--c-text-1)] whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none">{label}</span>
              </button>
            ))}
            <div className="w-px h-5 bg-[var(--c-border-s)] mx-1" />
            {([
              ['spaceH', 'Space Evenly H', <svg key="spaceH" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="4" width="2" height="6" rx="0.5" fill="currentColor" opacity="0.3" /><rect x="6" y="4" width="2" height="6" rx="0.5" fill="currentColor" opacity="0.3" /><rect x="11" y="4" width="2" height="6" rx="0.5" fill="currentColor" opacity="0.3" /><line x1="3.5" y1="7" x2="5.5" y2="7" strokeDasharray="1 1" /><line x1="8.5" y1="7" x2="10.5" y2="7" strokeDasharray="1 1" /></svg>],
              ['spaceV', 'Space Evenly V', <svg key="spaceV" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="4" y="1" width="6" height="2" rx="0.5" fill="currentColor" opacity="0.3" /><rect x="4" y="6" width="6" height="2" rx="0.5" fill="currentColor" opacity="0.3" /><rect x="4" y="11" width="6" height="2" rx="0.5" fill="currentColor" opacity="0.3" /><line x1="7" y1="3.5" x2="7" y2="5.5" strokeDasharray="1 1" /><line x1="7" y1="8.5" x2="7" y2="10.5" strokeDasharray="1 1" /></svg>],
              ['centerH', 'Equal Centers H', <svg key="centerH" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="3" width="2" height="8" rx="0.5" fill="currentColor" opacity="0.3" /><rect x="6" y="5" width="2" height="4" rx="0.5" fill="currentColor" opacity="0.3" /><rect x="11" y="3" width="2" height="8" rx="0.5" fill="currentColor" opacity="0.3" /><circle cx="2" cy="7" r="0.8" fill="currentColor" /><circle cx="7" cy="7" r="0.8" fill="currentColor" /><circle cx="12" cy="7" r="0.8" fill="currentColor" /></svg>],
              ['centerV', 'Equal Centers V', <svg key="centerV" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="1" width="8" height="2" rx="0.5" fill="currentColor" opacity="0.3" /><rect x="5" y="6" width="4" height="2" rx="0.5" fill="currentColor" opacity="0.3" /><rect x="3" y="11" width="8" height="2" rx="0.5" fill="currentColor" opacity="0.3" /><circle cx="7" cy="2" r="0.8" fill="currentColor" /><circle cx="7" cy="7" r="0.8" fill="currentColor" /><circle cx="7" cy="12" r="0.8" fill="currentColor" /></svg>],
              ['compactH', 'Compact H', <svg key="compactH" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="3" width="3" height="8" rx="0.5" fill="currentColor" opacity="0.3" /><rect x="5.5" y="4" width="3" height="6" rx="0.5" fill="currentColor" opacity="0.3" /><rect x="9" y="3" width="3" height="8" rx="0.5" fill="currentColor" opacity="0.3" /><line x1="1" y1="1" x2="1" y2="13" opacity="0.4" /><line x1="13" y1="1" x2="13" y2="13" opacity="0.4" /></svg>],
              ['compactV', 'Compact V', <svg key="compactV" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="2" width="8" height="3" rx="0.5" fill="currentColor" opacity="0.3" /><rect x="4" y="5.5" width="6" height="3" rx="0.5" fill="currentColor" opacity="0.3" /><rect x="3" y="9" width="8" height="3" rx="0.5" fill="currentColor" opacity="0.3" /><line x1="1" y1="1" x2="13" y2="1" opacity="0.4" /><line x1="1" y1="13" x2="13" y2="13" opacity="0.4" /></svg>],
            ] as [string, string, React.ReactNode][]).map(([mode, label, icon]) => (
              <button
                key={mode}
                onClick={() => distributeNodes(mode as any)}
                className="group relative p-1.5 rounded text-[var(--c-text-3)] hover:text-[var(--c-text-1)] hover:bg-[var(--c-bg-3)] cursor-pointer"
              >
                {icon}
                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-1.5 py-0.5 text-[10px] rounded bg-[var(--c-bg-3)] border border-[var(--c-border-s)] text-[var(--c-text-1)] whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none">{label}</span>
              </button>
            ))}
          </Panel>
        )}
        <CommandPalette onFocusTable={setFocusedTableId} />
      </ReactFlow>
      {contextMenu && (
        <div
          ref={ctxMenuRef}
          className="fixed z-50 bg-[var(--c-bg-1)] border border-[var(--c-border-s)] rounded shadow-lg py-1 min-w-[120px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <div
            onClick={handleDeleteNode}
            className="px-3 py-1.5 text-xs cursor-pointer text-red-400 hover:bg-[var(--c-bg-3)] hover:text-red-300"
          >
            Delete
          </div>
        </div>
      )}
      {focusedTableId && (
        <FocusModal tableId={focusedTableId} onClose={() => setFocusedTableId(null)} />
      )}
      {pendingLayout && (
        <ConfirmDialog
          message="Recalculate layout? Manual positions will be lost."
          confirmLabel="Recalculate"
          onConfirm={handleLayoutConfirm}
          onCancel={() => setPendingLayout(null)}
        />
      )}
      {pendingDelete && (
        <ConfirmDialog
          message={`Delete table "${pendingDelete.tableName}" and all its references?`}
          confirmLabel="Delete"
          danger
          onConfirm={executeDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  )
}

export function DiagramPanel() {
  return (
    <ReactFlowProvider>
      <DiagramPanelInner />
    </ReactFlowProvider>
  )
}
