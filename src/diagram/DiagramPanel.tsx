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
  const [guides, setGuides] = useState<GuideLine[]>([])
  const menuRef = useRef<HTMLDivElement>(null)
  const browseRef = useRef<HTMLDivElement>(null)
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
    if (hasStoredPositions && !window.confirm('Recalculate layout? Manual positions will be lost.')) {
      return
    }
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

  const handleEdgeClick = useCallback((_: React.MouseEvent, edge: Edge) => {
    const line = (edge.data as any)?.line
    if (line) useEditorStore.getState().scrollToLine?.(line)
  }, [])

  const handleNodeDoubleClick = useCallback((_: React.MouseEvent, node: Node) => {
    setFocusedTableId(node.id)
  }, [])

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
              className="bg-[var(--c-bg-3)] border border-[var(--c-border-s)] text-[var(--c-text-3)] hover:text-[var(--c-text-1)] text-xs px-2 py-1 rounded"
            >
              Auto Layout
            </button>
            {layoutMenuOpen && (
              <div className="absolute top-full right-0 mt-1 bg-[var(--c-bg-1)] border border-[var(--c-border-s)] rounded shadow-lg z-10 min-w-[120px]">
                {([['snowflake', 'Snowflake'], ['dense', 'Dense']] as const).map(([mode, label]) => (
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
            className="bg-[var(--c-bg-3)] border border-[var(--c-border-s)] text-[var(--c-text-3)] hover:text-[var(--c-text-1)] text-xs px-2 py-1 rounded"
          >
            {viewMode === 'relational' ? 'Relational' : 'Conceptual'}
          </button>
          <div ref={browseRef} className="relative">
            <button
              onClick={() => setBrowseOpen((o) => !o)}
              className="bg-[var(--c-bg-3)] border border-[var(--c-border-s)] text-[var(--c-text-3)] hover:text-[var(--c-text-1)] text-xs px-2 py-1 rounded"
            >
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
        {selectedNodes.length >= 2 && (
          <Panel position="bottom-center" className="flex gap-1 bg-[var(--c-bg-1)] border border-[var(--c-border-s)] rounded px-2 py-1 shadow">
            {([['left', 'Align Left'], ['centerX', 'Center H'], ['right', 'Align Right'], ['top', 'Align Top'], ['centerY', 'Center V'], ['bottom', 'Align Bottom']] as const).map(([axis, label]) => (
              <button
                key={axis}
                onClick={() => alignNodes(axis)}
                className="text-[10px] px-2 py-1 rounded text-[var(--c-text-3)] hover:text-[var(--c-text-1)] hover:bg-[var(--c-bg-3)] cursor-pointer"
                title={label}
              >
                {label}
              </button>
            ))}
          </Panel>
        )}
        <CommandPalette onFocusTable={setFocusedTableId} />
      </ReactFlow>
      {focusedTableId && (
        <FocusModal tableId={focusedTableId} onClose={() => setFocusedTableId(null)} />
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
