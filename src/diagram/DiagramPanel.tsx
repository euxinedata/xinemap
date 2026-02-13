import { useCallback, useEffect, useState } from 'react'
import { ReactFlow, ReactFlowProvider, Controls, Background, BackgroundVariant, Panel, useReactFlow, type Node, type Edge } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useDiagramStore, type LayoutDirection, type ViewMode } from '../store/useDiagramStore'
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
  const { nodes, edges, setNodes, setEdges, onNodesChange, onEdgesChange, layoutDirection, setLayoutDirection, viewMode, setViewMode } = useDiagramStore()
  const collapsedHubs = useDiagramStore((s) => s.collapsedHubs)
  const parseResult = useEditorStore((s) => s.parseResult)
  const [focusedTableId, setFocusedTableId] = useState<string | null>(null)
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

    layoutNodes(visibleNodes, visibleEdges, layoutDirection).then((laid) => {
      if (!stale) {
        setNodes(laid)
        setEdges(visibleEdges)
        fitView({ padding: 0.2 })
      }
    })
    return () => { stale = true }
  }, [parseResult, layoutDirection, viewMode, collapsedHubs, setNodes, setEdges, fitView])

  const handleAutoLayout = useCallback(() => {
    if (nodes.length === 0) return
    layoutNodes(nodes, edges, layoutDirection).then((laid) => {
      setNodes(laid)
      fitView({ padding: 0.2 })
    })
  }, [nodes, edges, layoutDirection, setNodes, fitView])

  const toggleDirection = useCallback(() => {
    const next: LayoutDirection = layoutDirection === 'LR' ? 'TB' : 'LR'
    setLayoutDirection(next)
  }, [layoutDirection, setLayoutDirection])

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
          <button
            onClick={handleAutoLayout}
            className="bg-[var(--c-bg-3)] border border-[var(--c-border-s)] text-[var(--c-text-3)] hover:text-[var(--c-text-1)] text-xs px-2 py-1 rounded"
          >
            Auto Layout
          </button>
          <button
            onClick={toggleDirection}
            className="bg-[var(--c-bg-3)] border border-[var(--c-border-s)] text-[var(--c-text-3)] hover:text-[var(--c-text-1)] text-xs px-2 py-1 rounded"
          >
            {layoutDirection === 'LR' ? 'Horizontal' : 'Vertical'}
          </button>
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
