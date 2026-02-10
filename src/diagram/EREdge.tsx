import { BaseEdge, getSmoothStepPath, Position, type EdgeProps } from '@xyflow/react'

const STROKE_WIDTH = 1

const ROTATION: Record<Position, number> = {
  [Position.Left]: 0,
  [Position.Right]: 180,
  [Position.Top]: 90,
  [Position.Bottom]: -90,
}

function OneMark({ x, y, position, color }: { x: number; y: number; position: Position; color: string }) {
  const angle = ROTATION[position]
  return (
    <g transform={`translate(${x},${y}) rotate(${angle})`}>
      <line x1={-5} y1={-8} x2={-5} y2={8} stroke={color} strokeWidth={STROKE_WIDTH} />
    </g>
  )
}

function ManyMark({ x, y, position, color }: { x: number; y: number; position: Position; color: string }) {
  const angle = ROTATION[position]
  return (
    <g transform={`translate(${x},${y}) rotate(${angle})`}>
      <line x1={4} y1={-8} x2={-15} y2={0} stroke={color} strokeWidth={STROKE_WIDTH} />
      <line x1={4} y1={8} x2={-15} y2={0} stroke={color} strokeWidth={STROKE_WIDTH} />
    </g>
  )
}

export function EREdge({
  sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition,
  data, style,
}: EdgeProps) {
  const [edgePath] = getSmoothStepPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
  })

  const srcCard = (data as any)?.sourceCardinality ?? '1'
  const tgtCard = (data as any)?.targetCardinality ?? '1'
  const color = (style?.stroke as string) ?? '#6b7280'

  const SrcMark = srcCard === '*' ? ManyMark : OneMark
  const TgtMark = tgtCard === '*' ? ManyMark : OneMark

  return (
    <>
      <BaseEdge path={edgePath} style={style} />
      <SrcMark x={sourceX} y={sourceY} position={sourcePosition} color={color} />
      <TgtMark x={targetX} y={targetY} position={targetPosition} color={color} />
    </>
  )
}
