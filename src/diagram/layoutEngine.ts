import dagre from 'dagre'
import type { Node, Edge } from '@xyflow/react'

const conceptualSizes: Record<string, { width: number; height: number }> = {
  hubNode: { width: 160, height: 50 },
  satelliteNode: { width: 100, height: 100 },
  linkNode: { width: 120, height: 80 },
  noteNode: { width: 160, height: 80 },
  conceptNode: { width: 140, height: 50 },
}

function getNodeSize(node: Node): { width: number; height: number } {
  if (node.measured?.width && node.measured?.height) {
    return { width: node.measured.width, height: node.measured.height }
  }
  const preset = node.type ? conceptualSizes[node.type] : undefined
  if (preset) return preset
  const width = 250
  const height = 40 + ((node.data as any)?.table?.columns?.length ?? 4) * 28
  return { width, height }
}

export function layoutNodes(nodes: Node[], edges: Edge[], direction: 'TB' | 'LR' = 'LR'): Node[] {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: direction, ranksep: 80, nodesep: 50 })

  for (const node of nodes) {
    const { width, height } = getNodeSize(node)
    g.setNode(node.id, { width, height })
  }

  for (const edge of edges) {
    g.setEdge(edge.source, edge.target)
  }

  dagre.layout(g)

  return nodes.map((node) => {
    const pos = g.node(node.id)
    const { width, height } = getNodeSize(node)
    return {
      ...node,
      position: {
        x: pos.x - width / 2,
        y: pos.y - height / 2,
      },
    }
  })
}
