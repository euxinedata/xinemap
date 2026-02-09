import dagre from 'dagre'
import type { Node, Edge } from '@xyflow/react'

export function layoutNodes(nodes: Node[], edges: Edge[], direction: 'TB' | 'LR' = 'LR'): Node[] {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: direction, ranksep: 80, nodesep: 50 })

  for (const node of nodes) {
    const width = node.measured?.width ?? 250
    const height = node.measured?.height ?? (40 + (node.data?.table?.columns?.length ?? 4) * 28)
    g.setNode(node.id, { width, height })
  }

  for (const edge of edges) {
    g.setEdge(edge.source, edge.target)
  }

  dagre.layout(g)

  return nodes.map((node) => {
    const pos = g.node(node.id)
    const width = node.measured?.width ?? 250
    const height = node.measured?.height ?? (40 + (node.data?.table?.columns?.length ?? 4) * 28)
    return {
      ...node,
      position: {
        x: pos.x - width / 2,
        y: pos.y - height / 2,
      },
    }
  })
}
