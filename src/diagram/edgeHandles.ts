import type { Node, Edge } from '@xyflow/react'

/**
 * Assign left/right source/target handles to edges based on relative node positions.
 * For full TableNodes with fromCol/toCol, uses column-specific handle IDs.
 * For stubs (no column info), uses generic position-based handle IDs.
 */
export function assignEdgeHandles(nodes: Node[], edges: Edge[]): Edge[] {
  const posMap = new Map(nodes.map((n) => [n.id, n.position]))
  return edges.map((e) => {
    const sp = posMap.get(e.source)
    const tp = posMap.get(e.target)
    if (!sp || !tp) return e
    const fromCol = (e.data as any)?.fromCol
    const toCol = (e.data as any)?.toCol
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
