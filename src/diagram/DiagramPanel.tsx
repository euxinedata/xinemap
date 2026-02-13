import { useCallback, useEffect, useRef, useState } from 'react'
import { ReactFlow, ReactFlowProvider, Controls, Background, BackgroundVariant, Panel, useReactFlow, type Node, type Edge } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useDiagramStore, type LayoutMode, type ViewMode } from '../store/useDiagramStore'
import { useEditorStore } from '../store/useEditorStore'
import { parseResultToFlow } from '../parser/dbmlToFlow'
import { parseResultToConceptualFlow } from '../parser/conceptualToFlow'
import { layoutNodes } from './layoutEngine'
import type { DV2Metadata } from '../types'
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
        if (pm?.entityType === 'hub') {
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

function DiagramPanelInner() {
  const { nodes, edges, setNodes, setEdges, onNodesChange, onEdgesChange, layoutMode, setLayoutMode, viewMode, setViewMode } = useDiagramStore()
  const collapsedHubs = useDiagramStore((s) => s.collapsedHubs)
  const parseResult = useEditorStore((s) => s.parseResult)
  const [focusedTableId, setFocusedTableId] = useState<string | null>(null)
  const [layoutMenuOpen, setLayoutMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const { fitView } = useReactFlow()

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

    layoutNodes(visibleNodes, visibleEdges, layoutMode).then((laid) => {
      if (!stale) {
        setNodes(laid)
        setEdges(visibleEdges)
        fitView({ padding: 0.2 })
      }
    })
    return () => { stale = true }
  }, [parseResult, layoutMode, viewMode, collapsedHubs, setNodes, setEdges, fitView])

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

  const handleLayoutSelect = useCallback((mode: LayoutMode) => {
    setLayoutMode(mode)
    setLayoutMenuOpen(false)
  }, [setLayoutMode])

  const toggleView = useCallback(() => {
    const next: ViewMode = viewMode === 'relational' ? 'conceptual' : 'relational'
    setViewMode(next)
  }, [viewMode, setViewMode])

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
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDoubleClick={handleNodeDoubleClick}
      >
        <Controls />
        <Background variant={BackgroundVariant.Dots} color="var(--c-dots)" />
        <Panel position="top-right" className="flex gap-1">
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
        <CommandPalette />
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
