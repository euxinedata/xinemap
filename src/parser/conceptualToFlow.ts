import type { Node, Edge } from '@xyflow/react'
import type { ParseResult } from '../types'
import { dv2EdgeColor } from '../diagram/dv2Colors'

function nodeTypeFromGroup(group?: string): string {
  if (!group) return 'conceptNode'
  const g = group.toLowerCase()
  if (g.startsWith('hub')) return 'hubNode'
  if (g.startsWith('sat')) return 'satelliteNode'
  if (g.startsWith('link')) return 'linkNode'
  return 'conceptNode'
}

export function parseResultToConceptualFlow(result: ParseResult): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = []
  const edges: Edge[] = []

  for (const table of result.tables) {
    nodes.push({
      id: table.id,
      type: nodeTypeFromGroup(table.group),
      position: { x: 0, y: 0 },
      data: { label: table.name, line: table.line },
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
    const strokeColor = dv2EdgeColor(result.dv2Metadata.get(ref.fromTable)?.entityType, result.dv2Metadata.get(ref.toTable)?.entityType) ?? '#9ca3af'
    edges.push({
      id: ref.id,
      source: ref.fromTable,
      target: ref.toTable,
      type: 'smoothstep',
      style: { stroke: strokeColor },
      data: { line: ref.line },
    })
  }

  return { nodes, edges }
}
