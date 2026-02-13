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

  // Find relevant refs — only create stubs for direct neighbors of the center
  const relevantRefs: RefInfo[] = []
  const stubIds = new Set<string>()

  for (const ref of parseResult.refs) {
    const fromVisible = visibleFull.has(ref.fromTable)
    const toVisible = visibleFull.has(ref.toTable)

    if (fromVisible && toVisible) {
      // Both ends are full tables (center + expanded) — always include
      relevantRefs.push(ref)
    } else if (ref.fromTable === focusedId && !toVisible) {
      // Center → unknown neighbor → show as stub
      relevantRefs.push(ref)
      stubIds.add(ref.toTable)
    } else if (ref.toTable === focusedId && !fromVisible) {
      // Unknown neighbor → center → show as stub
      relevantRefs.push(ref)
      stubIds.add(ref.fromTable)
    }
    // Skip refs from expanded tables to non-visible tables (no stubs for their neighbors)
  }

  // Build nodes
  const nodes: Node[] = []

  for (const id of visibleFull) {
    const table = tableMap.get(id)
    if (!table) continue
    const meta = parseResult.dv2Metadata.get(id)
    const isFocused = id === focusedId
    nodes.push({
      id,
      type: 'tableNode',
      position: { x: 0, y: 0 },
      data: {
        table,
        dv2EntityType: meta?.entityType,
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
        onExpand: () => onExpand(id),
      },
    })
  }

  // Build edges
  const edges: Edge[] = []

  for (const ref of relevantRefs) {
    const fromFull = visibleFull.has(ref.fromTable)
    const toFull = visibleFull.has(ref.toTable)
    const [srcCard, tgtCard] = cardinalityMap[ref.type]

    if (fromFull && toFull) {
      // Both full — use fromCol/toCol for dynamic handle assignment
      edges.push({
        id: ref.id,
        source: ref.fromTable,
        target: ref.toTable,
        type: 'erEdge',
        data: { sourceCardinality: srcCard, targetCardinality: tgtCard, fromCol: ref.fromColumns[0], toCol: ref.toColumns[0] },
      })
    } else {
      // One or both ends are stubs — simple handles
      const sourceHandle = fromFull ? undefined : `${ref.fromTable}-source`
      const targetHandle = toFull ? undefined : `${ref.toTable}-target`

      edges.push({
        id: ref.id,
        source: ref.fromTable,
        target: ref.toTable,
        sourceHandle,
        targetHandle,
        type: 'smoothstep',
        data: {
          ...(fromFull ? { fromCol: ref.fromColumns[0] } : {}),
          ...(toFull ? { toCol: ref.toColumns[0] } : {}),
        },
      })
    }
  }

  return { nodes, edges }
}
