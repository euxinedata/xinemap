import type { TableInfo } from '../types'

export const UNGROUPED = '__ungrouped__'

export function filterTablesByGroup(
  tables: TableInfo[],
  group: string | null,
): TableInfo[] {
  if (group === null) return tables
  if (group === UNGROUPED) return tables.filter((t) => !t.group)
  return tables.filter((t) => t.group === group)
}

export function listGroups(tables: TableInfo[]): string[] {
  const names = new Set<string>()
  let hasUngrouped = false
  for (const t of tables) {
    if (t.group) names.add(t.group)
    else hasUngrouped = true
  }
  const sorted = Array.from(names).sort()
  if (hasUngrouped) sorted.push(UNGROUPED)
  return sorted
}
