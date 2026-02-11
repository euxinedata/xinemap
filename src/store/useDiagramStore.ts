import { create } from 'zustand'
import { type Node, type Edge, type NodeChange, type EdgeChange, applyNodeChanges, applyEdgeChanges } from '@xyflow/react'

export type LayoutDirection = 'LR' | 'TB'
export type ViewMode = 'relational' | 'conceptual'

interface DiagramState {
  nodes: Node[]
  edges: Edge[]
  layoutDirection: LayoutDirection
  viewMode: ViewMode
  searchOpen: boolean
  setNodes: (nodes: Node[]) => void
  setEdges: (edges: Edge[]) => void
  setLayoutDirection: (dir: LayoutDirection) => void
  setViewMode: (mode: ViewMode) => void
  setSearchOpen: (open: boolean) => void
  onNodesChange: (changes: NodeChange[]) => void
  onEdgesChange: (changes: EdgeChange[]) => void
}

export const useDiagramStore = create<DiagramState>()((set) => ({
  nodes: [],
  edges: [],
  layoutDirection: 'LR' as LayoutDirection,
  viewMode: 'relational' as ViewMode,
  searchOpen: false,
  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
  setLayoutDirection: (layoutDirection) => set({ layoutDirection }),
  setViewMode: (viewMode) => set({ viewMode }),
  setSearchOpen: (searchOpen) => set({ searchOpen }),
  onNodesChange: (changes) => set((state) => ({ nodes: applyNodeChanges(changes, state.nodes) })),
  onEdgesChange: (changes) => set((state) => ({ edges: applyEdgeChanges(changes, state.edges) })),
}))
