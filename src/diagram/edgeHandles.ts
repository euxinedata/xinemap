import type { Node, Edge } from '@xyflow/react'

/**
 * Assign left/right source/target handles to edges based on relative node positions.
 * Edges with fromCol/toCol in data get dynamic handle IDs for TableNode columns.
 * Edges missing column info (e.g. stub connections) keep their existing handles.
 */
export function assignEdgeHandles(nodes: Node[], edges: Edge[]): Edge[] {
  const posMap = new Map(nodes.map((n) => [n.id, n.position]))
  return edges.map((e) => {
    const sp = posMap.get(e.source)
    const tp = posMap.get(e.target)
    if (!sp || !tp) return e
    const fromCol = (e.data as any)?.fromCol
    const toCol = (e.data as any)?.toCol
    if (!fromCol && !toCol) return e
    const exitRight = tp.x >= sp.x
    return {
      ...e,
      sourceHandle: fromCol ? `${e.source}.${fromCol}-${exitRight ? 'R' : 'L'}-src` : e.sourceHandle,
      targetHandle: toCol ? `${e.target}.${toCol}-${exitRight ? 'L' : 'R'}-tgt` : e.targetHandle,
    }
  })
}
