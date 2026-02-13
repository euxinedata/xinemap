import type { Node, Edge } from '@xyflow/react'
import type { ParseResult, RefInfo } from '../types'
import { dv2EdgeColor } from '../diagram/dv2Colors'

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
      data: { table, dv2EntityType: result.dv2Metadata.get(table.id)?.entityType },
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

  for (const note of result.stickyNotes) {
    nodes.push({
      id: note.id,
      type: 'noteNode',
      position: { x: 0, y: 0 },
      data: { label: note.name, content: note.content },
    })
  }

  for (const ref of result.refs) {
    const dv2Color = dv2EdgeColor(result.dv2Metadata.get(ref.fromTable)?.entityType, result.dv2Metadata.get(ref.toTable)?.entityType)
    const strokeColor = ref.color ?? dv2Color ?? '#6b7280'
    const [srcCard, tgtCard] = cardinalityMap[ref.type]
    edges.push({
      id: ref.id,
      source: ref.fromTable,
      target: ref.toTable,
      type: 'erEdge',
      style: { stroke: strokeColor },
      data: { sourceCardinality: srcCard, targetCardinality: tgtCard, fromCol: ref.fromColumns[0], toCol: ref.toColumns[0] },
    })
  }

  return { nodes, edges }
}
