import ELK from 'elkjs/lib/elk.bundled.js'
import type { Node, Edge } from '@xyflow/react'
import type { LayoutMode } from '../store/useDiagramStore'

const elk = new ELK()

const conceptualSizes: Record<string, { width: number; height: number }> = {
  hubNode: { width: 120, height: 120 },
  satelliteNode: { width: 180, height: 50 },
  linkNode: { width: 100, height: 70 },
  noteNode: { width: 160, height: 80 },
  conceptNode: { width: 140, height: 50 },
  stubNode: { width: 160, height: 36 },
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

function removeOverlaps(nodes: Node[], padding: number = 40): Node[] {
  const positioned = nodes.map((n) => ({
    node: n,
    ...getNodeSize(n),
    x: n.position.x,
    y: n.position.y,
  }))
  for (let iter = 0; iter < 50; iter++) {
    let moved = false
    for (let i = 0; i < positioned.length; i++) {
      for (let j = i + 1; j < positioned.length; j++) {
        const a = positioned[i], b = positioned[j]
        const overlapX = (a.width + b.width) / 2 + padding - Math.abs(a.x + a.width / 2 - b.x - b.width / 2)
        const overlapY = (a.height + b.height) / 2 + padding - Math.abs(a.y + a.height / 2 - b.y - b.height / 2)
        if (overlapX > 0 && overlapY > 0) {
          const dx = a.x + a.width / 2 - b.x - b.width / 2
          const dy = a.y + a.height / 2 - b.y - b.height / 2
          if (overlapX < overlapY) {
            const push = overlapX / 2
            a.x += dx >= 0 ? push : -push
            b.x -= dx >= 0 ? push : -push
          } else {
            const push = overlapY / 2
            a.y += dy >= 0 ? push : -push
            b.y -= dy >= 0 ? push : -push
          }
          moved = true
        }
      }
    }
    if (!moved) break
  }
  return positioned.map((p) => ({ ...p.node, position: { x: p.x, y: p.y } }))
}

export async function layoutNodes(nodes: Node[], edges: Edge[], mode: LayoutMode = 'snowflake'): Promise<Node[]> {
  const children = nodes.map((node) => {
    const { width, height } = getNodeSize(node)
    return { id: node.id, width, height }
  })

  const elkEdges = edges.map((e) => ({
    id: e.id,
    sources: [e.source],
    targets: [e.target],
  }))

  const layoutOptions: Record<string, string> = mode === 'snowflake'
    ? {
        'elk.algorithm': 'stress',
        'elk.stress.desiredEdgeLength': '500',
        'elk.spacing.nodeNode': '100',
        'elk.separateConnectedComponents': 'true',
        'elk.spacing.componentComponent': '150',
      }
    : {
        'elk.algorithm': 'rectpacking',
        'elk.spacing.nodeNode': '30',
        'elk.rectpacking.desiredAspectRatio': '2.5',
      }

  const graph = {
    id: 'root',
    layoutOptions,
    children,
    edges: elkEdges,
  }

  const layouted = await elk.layout(graph)

  const posMap = new Map<string, { x: number; y: number }>()
  for (const child of layouted.children ?? []) {
    posMap.set(child.id, { x: child.x ?? 0, y: child.y ?? 0 })
  }

  const laid = nodes.map((node) => ({
    ...node,
    position: posMap.get(node.id) ?? { x: 0, y: 0 },
  }))

  return mode === 'snowflake' ? removeOverlaps(laid) : laid
}
