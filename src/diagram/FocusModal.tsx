import { useState, useEffect, useCallback } from 'react'
import { ReactFlow, ReactFlowProvider, Controls, Background, BackgroundVariant, applyNodeChanges, applyEdgeChanges, useReactFlow, type Node, type Edge, type NodeChange, type EdgeChange } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useEditorStore } from '../store/useEditorStore'
import { buildFocusGraph } from './focusGraph'
import { assignEdgeHandles } from './edgeHandles'
import { layoutFocusGraph } from './layoutEngine'
import { TableNode } from './TableNode'
import { StubNode } from './StubNode'
import { EREdge } from './EREdge'
import { FocusEditPanel } from './FocusEditPanel'

const nodeTypes = { tableNode: TableNode, stubNode: StubNode }
const edgeTypes = { erEdge: EREdge }

interface FocusModalProps {
  tableId: string
  onClose: () => void
}

function FocusModalInner({ tableId, onClose }: FocusModalProps) {
  const [currentTableId, setCurrentTableId] = useState(tableId)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [modalNodes, setModalNodes] = useState<Node[]>([])
  const [modalEdges, setModalEdges] = useState<Edge[]>([])
  const [editOpen, setEditOpen] = useState(false)
  const parseResult = useEditorStore((s) => s.parseResult)
  const { fitView } = useReactFlow()

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setModalNodes((nds) => applyNodeChanges(changes, nds))
  }, [])

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setModalEdges((eds) => applyEdgeChanges(changes, eds))
  }, [])

  const handleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => new Set([...prev, id]))
  }, [])

  const handleCollapse = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }, [])

  // Double-click any node → make it the center
  const handleNodeDoubleClick = useCallback((_: React.MouseEvent, node: Node) => {
    setCurrentTableId(node.id)
    setExpandedIds(new Set())
  }, [])

  // Reset when prop changes (e.g. opening focus on a different table from main view)
  useEffect(() => {
    setCurrentTableId(tableId)
    setExpandedIds(new Set())
  }, [tableId])

  // Build and layout the focus graph
  useEffect(() => {
    if (!parseResult) return
    const { nodes, edges } = buildFocusGraph(parseResult, currentTableId, expandedIds, handleExpand, handleCollapse)

    // Capture current positions so existing nodes don't jump on expand/collapse
    const prevPosMap = new Map(modalNodes.map((n) => [n.id, n.position]))
    const isInitial = prevPosMap.size === 0

    let laid: Node[]
    if (isInitial) {
      // First render or re-center: full radial layout
      laid = layoutFocusGraph(nodes, currentTableId)
    } else {
      // Expand/collapse: keep existing positions, radial-place only new nodes
      const radial = layoutFocusGraph(nodes, currentTableId)
      laid = radial.map((n) => {
        const pos = prevPosMap.get(n.id)
        return pos ? { ...n, position: pos } : n
      })
    }

    setModalNodes(laid)
    setModalEdges(assignEdgeHandles(laid, edges))
    if (isInitial) fitView({ padding: 0.2 })
  }, [parseResult, currentTableId, expandedIds, handleExpand, handleCollapse, fitView])

  // Escape closes modal
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const focusedTable = parseResult?.tables.find((t) => t.id === currentTableId)
  const displayName = focusedTable?.name ?? currentTableId

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--c-bg-2)]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-[var(--c-border-s)] bg-[var(--c-bg-1)]">
        <span className="text-sm font-semibold text-[var(--c-text-1)]">{displayName}</span>
        <div className="ml-auto flex gap-1">
          <button
            onClick={() => setEditOpen((o) => !o)}
            className={`text-xs px-2 py-1 rounded cursor-pointer ${
              editOpen
                ? 'bg-blue-600 text-white'
                : 'text-[var(--c-text-4)] hover:text-[var(--c-text-1)]'
            }`}
          >
            Edit
          </button>
          <button
            onClick={onClose}
            className="text-[var(--c-text-4)] hover:text-[var(--c-text-1)] text-xs px-2 py-1 cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>

      {/* Canvas + optional edit panel */}
      <div className="flex-1 min-h-0 flex">
        {editOpen && (
          <FocusEditPanel tableId={currentTableId} onClose={() => setEditOpen(false)} />
        )}
        <div className="flex-1 relative">
          <div className="absolute inset-0">
            <ReactFlow
              nodes={modalNodes}
              edges={modalEdges}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeDoubleClick={handleNodeDoubleClick}
              proOptions={{ hideAttribution: true }}
            >
              <Controls />
              <Background variant={BackgroundVariant.Dots} color="var(--c-dots)" />
            </ReactFlow>
          </div>
        </div>
      </div>
    </div>
  )
}

export function FocusModal(props: FocusModalProps) {
  return (
    <ReactFlowProvider>
      <FocusModalInner {...props} />
    </ReactFlowProvider>
  )
}
