import type { Node, Edge } from '@xyflow/react'

const opposite: Record<string, string> = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' }

// Pixel tolerance for considering handles aligned
const ALIGN_THRESHOLD = 20

function cardinalDirection(dx: number, dy: number): string {
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'right' : 'left'
  return dy >= 0 ? 'bottom' : 'top'
}

function getNodeCenter(n: Node): { cx: number; cy: number } {
  const w = n.measured?.width ?? (n.width as number) ?? 180
  const h = n.measured?.height ?? (n.height as number) ?? 50
  return { cx: n.position.x + w / 2, cy: n.position.y + h / 2 }
}

/**
 * Assign source/target handles to edges based on relative node positions.
 * For TableNodes with fromCol/toCol, uses column-specific L/R handle IDs.
 * For conceptual nodes, picks the best cardinal handle (top/right/bottom/left).
 * When handles are nearly aligned, uses straight edge type to avoid kinks.
 */
export function assignEdgeHandles(nodes: Node[], edges: Edge[]): Edge[] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  return edges.map((e) => {
    const fromCol = (e.data as any)?.fromCol
    const toCol = (e.data as any)?.toCol
    const sn = nodeMap.get(e.source)
    const tn = nodeMap.get(e.target)
    if (!sn || !tn) return e

    // Conceptual view edges — pick cardinal handle based on angle
    if (!fromCol && !toCol && e.type !== 'erEdge') {
      const sc = getNodeCenter(sn)
      const tc = getNodeCenter(tn)
      const dx = tc.cx - sc.cx
      const dy = tc.cy - sc.cy
      const dir = cardinalDirection(dx, dy)
      const pairIndex = (e.data as any)?.pairIndex ?? 0
      const pairTotal = (e.data as any)?.pairTotal ?? 1

      // Use straight edge when handles are well-aligned
      const isVertical = dir === 'top' || dir === 'bottom'
      const aligned = isVertical
        ? Math.abs(dx) < ALIGN_THRESHOLD
        : Math.abs(dy) < ALIGN_THRESHOLD
      const edgeType = aligned ? 'straight' : 'smoothstep'

      // For paired edges (same-as links), use offset handles like a double bond
      const suffix = pairTotal > 1 ? (pairIndex === 0 ? '-a' : '-b') : ''
      return {
        ...e,
        type: edgeType,
        sourceHandle: `${dir}-source${suffix}`,
        targetHandle: `${opposite[dir]}-target${suffix}`,
      }
    }

    // Relational view — L/R column-specific handles
    const sp = sn.position
    const tp = tn.position
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
