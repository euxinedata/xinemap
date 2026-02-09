import { useCallback, useEffect } from 'react'
import { ReactFlow, Controls, Background, BackgroundVariant, Panel } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useDiagramStore, type LayoutDirection } from '../store/useDiagramStore'
import { useEditorStore } from '../store/useEditorStore'
import { parseResultToFlow } from '../parser/dbmlToFlow'
import { layoutNodes } from './layoutEngine'
import { TableNode } from './TableNode'
import { EnumNode } from './EnumNode'

const nodeTypes = { tableNode: TableNode, enumNode: EnumNode }

export function DiagramPanel() {
  const { nodes, edges, setNodes, setEdges, onNodesChange, onEdgesChange, layoutDirection, setLayoutDirection } = useDiagramStore()
  const parseResult = useEditorStore((s) => s.parseResult)

  useEffect(() => {
    if (!parseResult) {
      setNodes([])
      setEdges([])
      return
    }
    const { nodes: flowNodes, edges: flowEdges } = parseResultToFlow(parseResult)
    const laid = layoutNodes(flowNodes, flowEdges, layoutDirection)
    setNodes(laid)
    setEdges(flowEdges)
  }, [parseResult, layoutDirection, setNodes, setEdges])

  const handleAutoLayout = useCallback(() => {
    if (nodes.length === 0) return
    const laid = layoutNodes(nodes, edges, layoutDirection)
    setNodes(laid)
  }, [nodes, edges, layoutDirection, setNodes])

  const toggleDirection = useCallback(() => {
    const next: LayoutDirection = layoutDirection === 'LR' ? 'TB' : 'LR'
    setLayoutDirection(next)
  }, [layoutDirection, setLayoutDirection])

  return (
    <div className="h-full bg-gray-950">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
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
        </Panel>
      </ReactFlow>
    </div>
  )
}
