import { create } from 'zustand'
import { type Node, type Edge, type NodeChange, type EdgeChange, applyNodeChanges, applyEdgeChanges } from '@xyflow/react'

export type LayoutDirection = 'LR' | 'TB'

interface DiagramState {
  nodes: Node[]
  edges: Edge[]
  layoutDirection: LayoutDirection
  setNodes: (nodes: Node[]) => void
  setEdges: (edges: Edge[]) => void
  setLayoutDirection: (dir: LayoutDirection) => void
  onNodesChange: (changes: NodeChange[]) => void
  onEdgesChange: (changes: EdgeChange[]) => void
}

export const useDiagramStore = create<DiagramState>()((set) => ({
  nodes: [],
  edges: [],
  layoutDirection: 'LR' as LayoutDirection,
  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
  setLayoutDirection: (layoutDirection) => set({ layoutDirection }),
  onNodesChange: (changes) => set((state) => ({ nodes: applyNodeChanges(changes, state.nodes) })),
  onEdgesChange: (changes) => set((state) => ({ edges: applyEdgeChanges(changes, state.edges) })),
}))
