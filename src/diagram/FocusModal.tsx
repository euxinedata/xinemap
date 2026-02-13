import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { ReactFlow, ReactFlowProvider, Controls, Background, BackgroundVariant, applyNodeChanges, applyEdgeChanges, useReactFlow, type Node, type Edge, type NodeChange, type EdgeChange } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useEditorStore } from '../store/useEditorStore'
import { buildFocusGraph } from './focusGraph'
import { layoutNodes } from './layoutEngine'
import { TableNode } from './TableNode'
import { StubNode } from './StubNode'
import { EREdge } from './EREdge'

const nodeTypes = { tableNode: TableNode, stubNode: StubNode }
const edgeTypes = { erEdge: EREdge }

interface FocusModalProps {
  tableId: string
  onClose: () => void
}

function FocusModalInner({ tableId, onClose }: FocusModalProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [modalNodes, setModalNodes] = useState<Node[]>([])
  const [modalEdges, setModalEdges] = useState<Edge[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [searchOpen, setSearchOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
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

  // Build and layout the focus graph
  useEffect(() => {
    if (!parseResult) return
    let stale = false
    const { nodes, edges } = buildFocusGraph(parseResult, tableId, expandedIds, handleExpand, handleCollapse)
    layoutNodes(nodes, edges, 'LR').then((laid) => {
      if (!stale) {
        setModalNodes(laid)
        setModalEdges(edges)
        fitView({ padding: 0.2 })
      }
    })
    return () => { stale = true }
  }, [parseResult, tableId, expandedIds, handleExpand, handleCollapse])

  // Search results
  const searchResults = useMemo(() => {
    if (!parseResult || !searchQuery) return []
    const q = searchQuery.toLowerCase()
    return parseResult.tables
      .filter((t) => t.name.toLowerCase().includes(q) && t.id !== tableId)
      .slice(0, 20)
  }, [parseResult, searchQuery, tableId])

  // Escape closes modal
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (searchOpen) {
          setSearchOpen(false)
          setSearchQuery('')
        } else {
          onClose()
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose, searchOpen])

  const handleSearchSelect = useCallback((id: string) => {
    setExpandedIds((prev) => new Set([...prev, id]))
    setSearchOpen(false)
    setSearchQuery('')
  }, [])

  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((i) => Math.min(i + 1, searchResults.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && searchResults.length > 0) {
      e.preventDefault()
      handleSearchSelect(searchResults[selectedIndex].id)
    }
  }, [searchResults, selectedIndex, handleSearchSelect])

  const focusedTable = parseResult?.tables.find((t) => t.id === tableId)
  const displayName = focusedTable?.name ?? tableId

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--c-bg-2)]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-[var(--c-border-s)] bg-[var(--c-bg-1)]">
        <span className="text-sm font-semibold text-[var(--c-text-1)]">{displayName}</span>
        <div className="relative ml-auto">
          <input
            ref={inputRef}
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setSelectedIndex(0); setSearchOpen(true) }}
            onFocus={() => setSearchOpen(true)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Bring in entity..."
            className="w-56 px-3 py-1.5 text-xs text-[var(--c-text-1)] bg-[var(--c-bg-3)] border border-[var(--c-border-s)] rounded outline-none placeholder-[var(--c-text-4)]"
          />
          {searchOpen && searchQuery && (
            <div className="absolute top-full left-0 w-full mt-1 bg-[var(--c-bg-1)] border border-[var(--c-border-s)] rounded shadow-lg max-h-60 overflow-y-auto z-10">
              {searchResults.map((t, i) => {
                const meta = parseResult?.dv2Metadata.get(t.id)
                return (
                  <div
                    key={t.id}
                    className={`px-3 py-1.5 text-xs cursor-pointer flex items-center gap-2 ${
                      i === selectedIndex ? 'bg-[var(--c-bg-3)] text-[var(--c-text-1)]' : 'text-[var(--c-text-3)]'
                    }`}
                    onClick={() => handleSearchSelect(t.id)}
                  >
                    <span className="truncate">{t.name}</span>
                    {meta?.entityType && (
                      <span className="ml-auto text-[9px] text-[var(--c-text-4)]">{meta.entityType}</span>
                    )}
                  </div>
                )
              })}
              {searchResults.length === 0 && (
                <div className="px-3 py-2 text-xs text-[var(--c-text-4)]">No results</div>
              )}
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-[var(--c-text-4)] hover:text-[var(--c-text-1)] text-sm px-2 py-1 cursor-pointer"
        >
          Close
        </button>
      </div>

      {/* ReactFlow canvas */}
      <div className="flex-1 min-h-0 relative">
        <div className="absolute inset-0">
        <ReactFlow
          nodes={modalNodes}
          edges={modalEdges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          proOptions={{ hideAttribution: true }}
        >
          <Controls />
          <Background variant={BackgroundVariant.Dots} color="var(--c-dots)" />
        </ReactFlow>
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
