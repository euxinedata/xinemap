import type { Node } from '@xyflow/react'

export interface GuideLine {
  axis: 'x' | 'y'
  pos: number
}

export interface SnapResult {
  x: number
  y: number
  guides: GuideLine[]
}

const DEFAULT_THRESHOLD = 5

function getSize(node: Node): { w: number; h: number } {
  return {
    w: node.measured?.width ?? 250,
    h: node.measured?.height ?? 100,
  }
}

export function computeSnap(
  draggedId: string,
  draggedPos: { x: number; y: number },
  draggedSize: { width: number; height: number },
  nodes: Node[],
  threshold = DEFAULT_THRESHOLD,
): SnapResult {
  let snapX = draggedPos.x
  let snapY = draggedPos.y
  const guides: GuideLine[] = []
  let bestDx = threshold + 1
  let bestDy = threshold + 1

  const dLeft = draggedPos.x
  const dCx = draggedPos.x + draggedSize.width / 2
  const dRight = draggedPos.x + draggedSize.width
  const dTop = draggedPos.y
  const dCy = draggedPos.y + draggedSize.height / 2
  const dBottom = draggedPos.y + draggedSize.height

  for (const node of nodes) {
    if (node.id === draggedId) continue
    const { w, h } = getSize(node)
    const nLeft = node.position.x
    const nCx = node.position.x + w / 2
    const nRight = node.position.x + w
    const nTop = node.position.y
    const nCy = node.position.y + h / 2
    const nBottom = node.position.y + h

    // Vertical alignment (x-axis snapping)
    const xPairs: [number, number][] = [
      [dLeft, nLeft], [dLeft, nRight], [dLeft, nCx],
      [dRight, nLeft], [dRight, nRight], [dRight, nCx],
      [dCx, nCx], [dCx, nLeft], [dCx, nRight],
    ]
    for (const [dVal, nVal] of xPairs) {
      const dx = Math.abs(dVal - nVal)
      if (dx < bestDx) {
        bestDx = dx
        snapX = draggedPos.x + (nVal - dVal)
      }
    }

    // Horizontal alignment (y-axis snapping)
    const yPairs: [number, number][] = [
      [dTop, nTop], [dTop, nBottom], [dTop, nCy],
      [dBottom, nTop], [dBottom, nBottom], [dBottom, nCy],
      [dCy, nCy], [dCy, nTop], [dCy, nBottom],
    ]
    for (const [dVal, nVal] of yPairs) {
      const dy = Math.abs(dVal - nVal)
      if (dy < bestDy) {
        bestDy = dy
        snapY = draggedPos.y + (nVal - dVal)
      }
    }
  }

  // Build guide lines for active snaps
  if (bestDx <= threshold) {
    // Find the exact x position that was snapped to
    const snappedLeft = snapX
    const snappedCx = snapX + draggedSize.width / 2
    const snappedRight = snapX + draggedSize.width
    // Pick the guide line position (the aligned edge)
    for (const node of nodes) {
      if (node.id === draggedId) continue
      const { w } = getSize(node)
      for (const nVal of [node.position.x, node.position.x + w / 2, node.position.x + w]) {
        for (const dVal of [snappedLeft, snappedCx, snappedRight]) {
          if (Math.abs(dVal - nVal) < 1) {
            guides.push({ axis: 'x', pos: nVal })
          }
        }
      }
    }
  } else {
    snapX = draggedPos.x
  }

  if (bestDy <= threshold) {
    const snappedTop = snapY
    const snappedCy = snapY + draggedSize.height / 2
    const snappedBottom = snapY + draggedSize.height
    for (const node of nodes) {
      if (node.id === draggedId) continue
      const { h } = getSize(node)
      for (const nVal of [node.position.y, node.position.y + h / 2, node.position.y + h]) {
        for (const dVal of [snappedTop, snappedCy, snappedBottom]) {
          if (Math.abs(dVal - nVal) < 1) {
            guides.push({ axis: 'y', pos: nVal })
          }
        }
      }
    }
  } else {
    snapY = draggedPos.y
  }

  // Deduplicate guides
  const unique = guides.filter((g, i) =>
    guides.findIndex((o) => o.axis === g.axis && Math.abs(o.pos - g.pos) < 1) === i,
  )

  return { x: snapX, y: snapY, guides: unique }
}
