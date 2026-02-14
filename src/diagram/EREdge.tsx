import { useState } from 'react'
import { BaseEdge, getSmoothStepPath, Position, type EdgeProps } from '@xyflow/react'

const STROKE_WIDTH = 1
const HOVER_STROKE_WIDTH = 2.5

const ROTATION: Record<Position, number> = {
  [Position.Left]: 0,
  [Position.Right]: 180,
  [Position.Top]: 90,
  [Position.Bottom]: -90,
}

function OneMark({ x, y, position, color, sw }: { x: number; y: number; position: Position; color: string; sw: number }) {
  const angle = ROTATION[position]
  return (
    <g transform={`translate(${x},${y}) rotate(${angle})`}>
      <line x1={-5} y1={-8} x2={-5} y2={8} stroke={color} strokeWidth={sw} />
    </g>
  )
}

function ManyMark({ x, y, position, color, sw }: { x: number; y: number; position: Position; color: string; sw: number }) {
  const angle = ROTATION[position]
  return (
    <g transform={`translate(${x},${y}) rotate(${angle})`}>
      <line x1={4} y1={-8} x2={-15} y2={0} stroke={color} strokeWidth={sw} />
      <line x1={4} y1={8} x2={-15} y2={0} stroke={color} strokeWidth={sw} />
    </g>
  )
}

export function EREdge({
  sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition,
  data, style,
}: EdgeProps) {
  const [hovered, setHovered] = useState(false)
  const [edgePath] = getSmoothStepPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
  })

  const srcCard = (data as any)?.sourceCardinality ?? '1'
  const tgtCard = (data as any)?.targetCardinality ?? '1'
  const color = (style?.stroke as string) ?? 'var(--c-edge)'
  const sw = hovered ? HOVER_STROKE_WIDTH : STROKE_WIDTH

  const SrcMark = srcCard === '*' ? ManyMark : OneMark
  const TgtMark = tgtCard === '*' ? ManyMark : OneMark

  return (
    <g
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <BaseEdge path={edgePath} style={{ ...style, strokeWidth: sw }} />
      <SrcMark x={sourceX} y={sourceY} position={sourcePosition} color={color} sw={sw} />
      <TgtMark x={targetX} y={targetY} position={targetPosition} color={color} sw={sw} />
      {/* Invisible wider hit area on top for easier hovering */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={50}
        pointerEvents="stroke"
      />
    </g>
  )
}
