import { useCallback, useEffect } from 'react'
import { ReactFlow, Controls, Background, BackgroundVariant, Panel } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useDiagramStore, type LayoutDirection, type ViewMode } from '../store/useDiagramStore'
import { useEditorStore } from '../store/useEditorStore'
import { parseResultToFlow } from '../parser/dbmlToFlow'
import { parseResultToConceptualFlow } from '../parser/conceptualToFlow'
import { layoutNodes } from './layoutEngine'
import { TableNode } from './TableNode'
import { EnumNode } from './EnumNode'
import { EREdge } from './EREdge'
import { HubNode } from './conceptual/HubNode'
import { SatelliteNode } from './conceptual/SatelliteNode'
import { LinkNode } from './conceptual/LinkNode'
import { NoteNode } from './conceptual/NoteNode'
import { ConceptNode } from './conceptual/ConceptNode'
import { CommandPalette } from '../components/CommandPalette'

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

export function DiagramPanel() {
  const { nodes, edges, setNodes, setEdges, onNodesChange, onEdgesChange, layoutDirection, setLayoutDirection, viewMode, setViewMode } = useDiagramStore()
  const parseResult = useEditorStore((s) => s.parseResult)

  useEffect(() => {
    if (!parseResult) {
      setNodes([])
      setEdges([])
      return
    }
    const convert = viewMode === 'conceptual' ? parseResultToConceptualFlow : parseResultToFlow
    const { nodes: flowNodes, edges: flowEdges } = convert(parseResult)
    const laid = layoutNodes(flowNodes, flowEdges, layoutDirection)
    setNodes(laid)
    setEdges(flowEdges)
  }, [parseResult, layoutDirection, viewMode, setNodes, setEdges])

  const handleAutoLayout = useCallback(() => {
    if (nodes.length === 0) return
    const laid = layoutNodes(nodes, edges, layoutDirection)
    setNodes(laid)
  }, [nodes, edges, layoutDirection, setNodes])

  const toggleDirection = useCallback(() => {
    const next: LayoutDirection = layoutDirection === 'LR' ? 'TB' : 'LR'
    setLayoutDirection(next)
  }, [layoutDirection, setLayoutDirection])

  const toggleView = useCallback(() => {
    const next: ViewMode = viewMode === 'relational' ? 'conceptual' : 'relational'
    setViewMode(next)
  }, [viewMode, setViewMode])

  return (
    <div className="h-full bg-gray-950">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
      >
        <Controls />
        <Background variant={BackgroundVariant.Dots} color="#374151" />
        <Panel position="top-right" className="flex gap-1">
          <button
            onClick={handleAutoLayout}
            className="bg-gray-800 border border-gray-600 text-gray-400 hover:text-gray-200 text-xs px-2 py-1 rounded"
          >
            Auto Layout
          </button>
          <button
            onClick={toggleDirection}
            className="bg-gray-800 border border-gray-600 text-gray-400 hover:text-gray-200 text-xs px-2 py-1 rounded"
          >
            {layoutDirection === 'LR' ? 'Horizontal' : 'Vertical'}
          </button>
          <button
            onClick={toggleView}
            className="bg-gray-800 border border-gray-600 text-gray-400 hover:text-gray-200 text-xs px-2 py-1 rounded"
          >
            {viewMode === 'relational' ? 'Relational' : 'Conceptual'}
          </button>
        </Panel>
        <CommandPalette />
      </ReactFlow>
    </div>
  )
}
