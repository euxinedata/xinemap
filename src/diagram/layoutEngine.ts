import ELK from 'elkjs/lib/elk.bundled.js'
import type { Node, Edge } from '@xyflow/react'

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

export async function layoutNodes(nodes: Node[], edges: Edge[], direction: 'TB' | 'LR' = 'LR'): Promise<Node[]> {
  const isHorizontal = direction === 'LR'

  const children = nodes.map((node) => {
    const { width, height } = getNodeSize(node)
    const table = (node.data as any)?.table
    const ports: { id: string; properties: { 'port.side': string } }[] = []

    if (table?.columns) {
      for (const col of table.columns) {
        ports.push({
          id: `${node.id}.${col.name}-target`,
          properties: { 'port.side': isHorizontal ? 'WEST' : 'NORTH' },
        })
        ports.push({
          id: `${node.id}.${col.name}-source`,
          properties: { 'port.side': isHorizontal ? 'EAST' : 'SOUTH' },
        })
      }
    }

    if (ports.length === 0) {
      ports.push({
        id: `${node.id}-target`,
        properties: { 'port.side': isHorizontal ? 'WEST' : 'NORTH' },
      })
      ports.push({
        id: `${node.id}-source`,
        properties: { 'port.side': isHorizontal ? 'EAST' : 'SOUTH' },
      })
    }

    return {
      id: node.id,
      width,
      height,
      ports,
      properties: ports.length > 0
        ? { 'org.eclipse.elk.portConstraints': 'FIXED_ORDER' }
        : {},
    }
  })

  const elkEdges = edges.map((e) => ({
    id: e.id,
    sources: [e.sourceHandle ?? e.source],
    targets: [e.targetHandle ?? e.target],
  }))

  const graph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': isHorizontal ? 'RIGHT' : 'DOWN',
      'elk.layered.spacing.nodeNodeBetweenLayers': '100',
      'elk.spacing.nodeNode': '60',
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      'elk.edgeRouting': 'ORTHOGONAL',
    },
    children,
    edges: elkEdges,
  }

  const layouted = await elk.layout(graph)

  const posMap = new Map<string, { x: number; y: number }>()
  for (const child of layouted.children ?? []) {
    posMap.set(child.id, { x: child.x ?? 0, y: child.y ?? 0 })
  }

  return nodes.map((node) => ({
    ...node,
    position: posMap.get(node.id) ?? { x: 0, y: 0 },
  }))
}
