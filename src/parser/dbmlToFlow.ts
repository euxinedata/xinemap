import type { Node, Edge } from '@xyflow/react'
import type { ParseResult, RefInfo } from '../types'

const cardinalityMap: Record<RefInfo['type'], [string, string]> = {
  '1-1': ['1', '1'],
  '1-n': ['1', '*'],
  'n-1': ['*', '1'],
  'n-n': ['*', '*'],
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
    const [srcCard, tgtCard] = cardinalityMap[ref.type]
    edges.push({
      id: ref.id,
      source: ref.fromTable,
      target: ref.toTable,
      sourceHandle: `${ref.fromTable}.${ref.fromColumns[0]}-source`,
      targetHandle: `${ref.toTable}.${ref.toColumns[0]}-target`,
      type: 'erEdge',
      style: { stroke: strokeColor },
      data: { sourceCardinality: srcCard, targetCardinality: tgtCard },
    })
  }

  return { nodes, edges }
}
