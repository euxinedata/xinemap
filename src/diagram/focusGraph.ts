import type { Node, Edge } from '@xyflow/react'
import type { ParseResult, RefInfo } from '../types'

const cardinalityMap: Record<RefInfo['type'], [string, string]> = {
  '1-1': ['1', '1'],
  '1-n': ['1', '*'],
  'n-1': ['*', '1'],
  'n-n': ['*', '*'],
}

export function buildFocusGraph(
  parseResult: ParseResult,
  focusedId: string,
  expandedIds: Set<string>,
  onExpand: (id: string) => void,
  onCollapse: (id: string) => void,
): { nodes: Node[]; edges: Edge[] } {
  const visibleFull = new Set([focusedId, ...expandedIds])
  const tableMap = new Map(parseResult.tables.map((t) => [t.id, t]))

  // Find all refs that touch any visible-full table
  const relevantRefs: RefInfo[] = []
  const stubIds = new Set<string>()

  for (const ref of parseResult.refs) {
    const fromVisible = visibleFull.has(ref.fromTable)
    const toVisible = visibleFull.has(ref.toTable)
    if (!fromVisible && !toVisible) continue
    relevantRefs.push(ref)
    if (!fromVisible) stubIds.add(ref.fromTable)
    if (!toVisible) stubIds.add(ref.toTable)
  }

  // Build nodes
  const nodes: Node[] = []

  for (const id of visibleFull) {
    const table = tableMap.get(id)
    if (!table) continue
    const isFocused = id === focusedId
    nodes.push({
      id,
      type: 'tableNode',
      position: { x: 0, y: 0 },
      data: {
        table,
        ...(isFocused ? {} : { onCollapse: () => onCollapse(id) }),
      },
    })
  }

  for (const id of stubIds) {
    const table = tableMap.get(id)
    if (!table) continue
    const meta = parseResult.dv2Metadata.get(id)
    nodes.push({
      id,
      type: 'stubNode',
      position: { x: 0, y: 0 },
      data: {
        label: table.name,
        entityType: meta?.entityType,
        headerColor: table.headerColor,
        onExpand: () => onExpand(id),
      },
    })
  }

  // Build edges
  const edges: Edge[] = []

  for (const ref of relevantRefs) {
    const fromFull = visibleFull.has(ref.fromTable)
    const toFull = visibleFull.has(ref.toTable)

    if (fromFull && toFull) {
      // Both full — column-level handles + EREdge
      const [srcCard, tgtCard] = cardinalityMap[ref.type]
      edges.push({
        id: ref.id,
        source: ref.fromTable,
        target: ref.toTable,
        sourceHandle: `${ref.fromTable}.${ref.fromColumns[0]}-source`,
        targetHandle: `${ref.toTable}.${ref.toColumns[0]}-target`,
        type: 'erEdge',
        data: { sourceCardinality: srcCard, targetCardinality: tgtCard },
      })
    } else {
      // One or both ends are stubs — simple handles + smoothstep
      const sourceHandle = fromFull
        ? `${ref.fromTable}.${ref.fromColumns[0]}-source`
        : `${ref.fromTable}-source`
      const targetHandle = toFull
        ? `${ref.toTable}.${ref.toColumns[0]}-target`
        : `${ref.toTable}-target`

      edges.push({
        id: ref.id,
        source: ref.fromTable,
        target: ref.toTable,
        sourceHandle,
        targetHandle,
        type: 'smoothstep',
      })
    }
  }

  return { nodes, edges }
}
