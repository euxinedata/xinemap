import type { Node, Edge } from '@xyflow/react'

const opposite: Record<string, string> = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' }

function cardinalDirection(dx: number, dy: number): string {
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'right' : 'left'
  return dy >= 0 ? 'bottom' : 'top'
}

/**
 * Assign source/target handles to edges based on relative node positions.
 * For TableNodes with fromCol/toCol, uses column-specific L/R handle IDs.
 * For conceptual nodes, picks the best cardinal handle (top/right/bottom/left).
 */
export function assignEdgeHandles(nodes: Node[], edges: Edge[]): Edge[] {
  const posMap = new Map(nodes.map((n) => [n.id, n.position]))
  return edges.map((e) => {
    const fromCol = (e.data as any)?.fromCol
    const toCol = (e.data as any)?.toCol
    const sp = posMap.get(e.source)
    const tp = posMap.get(e.target)
    if (!sp || !tp) return e

    // Conceptual view edges — pick cardinal handle based on angle
    if (!fromCol && !toCol && e.type !== 'erEdge') {
      const dir = cardinalDirection(tp.x - sp.x, tp.y - sp.y)
      return {
        ...e,
        sourceHandle: `${dir}-source`,
        targetHandle: `${opposite[dir]}-target`,
      }
    }

    // Relational view — L/R column-specific handles
    const exitRight = tp.x >= sp.x
    const srcSide = exitRight ? 'R' : 'L'
    const tgtSide = exitRight ? 'L' : 'R'
    return {
      ...e,
      sourceHandle: fromCol ? `${e.source}.${fromCol}-${srcSide}-src` : `${e.source}-${srcSide}-src`,
      targetHandle: toCol ? `${e.target}.${toCol}-${tgtSide}-tgt` : `${e.target}-${tgtSide}-tgt`,
    }
  })
}
