import type { Node, Edge } from '@xyflow/react'
import type { ParseResult } from '../types'

const CARDINALITY_LABELS: Record<string, string> = {
  '1-1': '1 - 1',
  '1-n': '1 - *',
  'n-1': '* - 1',
  'n-n': '* - *',
}

export function parseResultToFlow(result: ParseResult): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = []
  const edges: Edge[] = []

  for (const table of result.tables) {
    nodes.push({
      id: table.id,
      type: 'tableNode',
      position: { x: 0, y: 0 },
      data: { table },
    })
  }

  for (const enumInfo of result.enums) {
    nodes.push({
      id: enumInfo.id,
      type: 'enumNode',
      position: { x: 0, y: 0 },
      data: { enumInfo },
    })
  }

  for (const ref of result.refs) {
    const strokeColor = ref.color ?? '#6b7280'
    edges.push({
      id: ref.id,
      source: ref.fromTable,
      target: ref.toTable,
      sourceHandle: `${ref.fromTable}.${ref.fromColumns[0]}-source`,
      targetHandle: `${ref.toTable}.${ref.toColumns[0]}-target`,
      type: 'smoothstep',
      label: CARDINALITY_LABELS[ref.type] ?? ref.type,
      style: { stroke: strokeColor },
      labelStyle: { fill: '#9ca3af', fontSize: 11 },
    })
  }

  return { nodes, edges }
}
