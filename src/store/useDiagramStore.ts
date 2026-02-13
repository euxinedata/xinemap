import { create } from 'zustand'
import { type Node, type Edge, type NodeChange, type EdgeChange, applyNodeChanges, applyEdgeChanges } from '@xyflow/react'

export type LayoutMode = 'snowflake' | 'dense'
export type ViewMode = 'relational' | 'conceptual'

interface DiagramState {
  nodes: Node[]
  edges: Edge[]
  layoutMode: LayoutMode
  viewMode: ViewMode
  searchOpen: boolean
  collapsedHubs: Set<string>
  setNodes: (nodes: Node[]) => void
  setEdges: (edges: Edge[]) => void
  setLayoutMode: (mode: LayoutMode) => void
  setViewMode: (mode: ViewMode) => void
  setSearchOpen: (open: boolean) => void
  toggleHubCollapse: (hubId: string) => void
  onNodesChange: (changes: NodeChange[]) => void
  onEdgesChange: (changes: EdgeChange[]) => void
}

export const useDiagramStore = create<DiagramState>()((set) => ({
  nodes: [],
  edges: [],
  layoutMode: 'snowflake' as LayoutMode,
  viewMode: 'relational' as ViewMode,
  searchOpen: false,
  collapsedHubs: new Set<string>(),
  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
  setLayoutMode: (layoutMode) => set({ layoutMode }),
  setViewMode: (viewMode) => set({ viewMode }),
  setSearchOpen: (searchOpen) => set({ searchOpen }),
  toggleHubCollapse: (hubId) => set((state) => {
    const next = new Set(state.collapsedHubs)
    if (next.has(hubId)) next.delete(hubId)
    else next.add(hubId)
    return { collapsedHubs: next }
  }),
  onNodesChange: (changes) => set((state) => ({ nodes: applyNodeChanges(changes, state.nodes) })),
  onEdgesChange: (changes) => set((state) => ({ edges: applyEdgeChanges(changes, state.edges) })),
}))
