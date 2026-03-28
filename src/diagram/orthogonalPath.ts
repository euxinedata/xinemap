import { Position } from '@xyflow/react'

const DEFAULT_RADIUS = 5
const MIN_EXTENSION = 20 // minimum distance to extend from a handle before bending

type Point = [number, number]

/** Direction vector for each handle position (the direction the edge exits/enters) */
function dirVec(pos: Position): Point {
  switch (pos) {
    case Position.Right: return [1, 0]
    case Position.Left: return [-1, 0]
    case Position.Bottom: return [0, 1]
    case Position.Top: return [0, -1]
  }
}

function isHorizontal(pos: Position) {
  return pos === Position.Left || pos === Position.Right
}

/**
 * Build a series of waypoints (strictly H/V segments) from source to target.
 * Returns an array of [x,y] points including source and target.
 */
function computeWaypoints(
  sx: number, sy: number, sp: Position,
  tx: number, ty: number, tp: Position,
  offset: number,
): Point[] {
  const [sdx, sdy] = dirVec(sp)
  const [tdx, tdy] = dirVec(tp)
  const srcH = isHorizontal(sp)
  const tgtH = isHorizontal(tp)

  // Apply perpendicular offset to source and target
  const osx = sx + (srcH ? 0 : offset)
  const osy = sy + (srcH ? offset : 0)
  const otx = tx + (tgtH ? 0 : offset)
  const oty = ty + (tgtH ? offset : 0)

  // Opposing faces (e.g. Right/Left or Top/Bottom)
  if (sdx === -tdx && sdy === -tdy) {
    if (srcH) {
      // Horizontal opposing
      const midX = (osx + otx) / 2
      if (osy === oty) return [[osx, osy], [otx, oty]]
      return [[osx, osy], [midX, osy], [midX, oty], [otx, oty]]
    } else {
      // Vertical opposing
      const midY = (osy + oty) / 2
      if (osx === otx) return [[osx, osy], [otx, oty]]
      return [[osx, osy], [osx, midY], [otx, midY], [otx, oty]]
    }
  }

  // Same face (e.g. Right/Right or Top/Top)
  if (sdx === tdx && sdy === tdy) {
    const ext = MIN_EXTENSION
    if (srcH) {
      const beyondX = sdx > 0
        ? Math.max(osx, otx) + ext
        : Math.min(osx, otx) - ext
      return [[osx, osy], [beyondX, osy], [beyondX, oty], [otx, oty]]
    } else {
      const beyondY = sdy > 0
        ? Math.max(osy, oty) + ext
        : Math.min(osy, oty) - ext
      return [[osx, osy], [osx, beyondY], [otx, beyondY], [otx, oty]]
    }
  }

  // Perpendicular faces
  if (srcH) {
    // Source exits horizontally, target exits vertically
    // Check if L-shape is natural: target is in the direction source faces,
    // and source is in the direction target faces
    const naturalH = sdx > 0 ? otx > osx : otx < osx
    const naturalV = tdy > 0 ? osy > oty : osy < oty
    if (naturalH && naturalV) {
      // L-shape: go horizontal to target X, then vertical to target Y
      return [[osx, osy], [otx, osy], [otx, oty]]
    }
    // S-shape: extend from both handles, then connect
    const extX = osx + sdx * MIN_EXTENSION
    const extY = oty + tdy * MIN_EXTENSION
    return [[osx, osy], [extX, osy], [extX, extY], [otx, extY], [otx, oty]]
  } else {
    // Source exits vertically, target exits horizontally
    const naturalV = sdy > 0 ? oty > osy : oty < osy
    const naturalH = tdx > 0 ? osx > otx : osx < otx
    if (naturalV && naturalH) {
      // L-shape: go vertical to target Y, then horizontal to target X
      return [[osx, osy], [osx, oty], [otx, oty]]
    }
    // S-shape
    const extY = osy + sdy * MIN_EXTENSION
    const extX = otx + tdx * MIN_EXTENSION
    return [[osx, osy], [osx, extY], [extX, extY], [extX, oty], [otx, oty]]
  }
}

/**
 * Build an SVG path string with rounded corners at bend points.
 */
function waypointsToPath(points: Point[], radius: number): string {
  if (points.length < 2) return ''
  if (points.length === 2) {
    return `M ${points[0][0]} ${points[0][1]} L ${points[1][0]} ${points[1][1]}`
  }

  let d = `M ${points[0][0]} ${points[0][1]}`

  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1]
    const curr = points[i]
    const next = points[i + 1]

    // Segment lengths
    const lenIn = Math.abs(curr[0] - prev[0]) + Math.abs(curr[1] - prev[1])
    const lenOut = Math.abs(next[0] - curr[0]) + Math.abs(next[1] - curr[1])

    // Clamp radius to half the shortest adjacent segment
    const r = Math.min(radius, lenIn / 2, lenOut / 2)

    // Direction vectors (normalized, always axis-aligned)
    const dxIn = Math.sign(curr[0] - prev[0])
    const dyIn = Math.sign(curr[1] - prev[1])
    const dxOut = Math.sign(next[0] - curr[0])
    const dyOut = Math.sign(next[1] - curr[1])

    // Point where the arc starts (back from corner by r)
    const arcStartX = curr[0] - dxIn * r
    const arcStartY = curr[1] - dyIn * r

    // Point where the arc ends (forward from corner by r)
    const arcEndX = curr[0] + dxOut * r
    const arcEndY = curr[1] + dyOut * r

    // Sweep flag: determines clockwise vs counterclockwise
    const cross = dxIn * dyOut - dyIn * dxOut
    const sweep = cross > 0 ? 1 : 0

    d += ` L ${arcStartX} ${arcStartY}`
    d += ` A ${r} ${r} 0 0 ${sweep} ${arcEndX} ${arcEndY}`
  }

  const last = points[points.length - 1]
  d += ` L ${last[0]} ${last[1]}`

  return d
}

/**
 * Compute an orthogonal SVG path between two handle positions.
 * All segments are strictly horizontal or vertical with rounded corners at bends.
 */
export function orthogonalPath(
  sourceX: number, sourceY: number, sourcePosition: Position,
  targetX: number, targetY: number, targetPosition: Position,
  offset: number = 0,
  radius: number = DEFAULT_RADIUS,
): string {
  const waypoints = computeWaypoints(sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, offset)
  return waypointsToPath(waypoints, radius)
}
