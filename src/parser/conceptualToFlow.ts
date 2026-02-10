import type { Node, Edge } from '@xyflow/react'
import type { ParseResult } from '../types'

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
      data: { label: table.name },
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
    edges.push({
      id: ref.id,
      source: ref.fromTable,
      target: ref.toTable,
      type: 'smoothstep',
      style: { stroke: '#9ca3af' },
    })
  }

  return { nodes, edges }
}
