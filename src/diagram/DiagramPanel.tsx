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
  const [guides, setGuides] = useState<GuideLine[]>([])
  const menuRef = useRef<HTMLDivElement>(null)
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
        </Panel>
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
