import { useMemo } from 'react'
import { useEditorStore } from '../store/useEditorStore'
import { useDiagramStore } from '../store/useDiagramStore'
import { ViewModeSegmented } from './ViewModeSegmented'
import { filterTablesByGroup, listGroups, UNGROUPED } from '../tabular/filterTablesByGroup'

export function ViewControlsBar() {
  const { parseResult } = useEditorStore()
  const { groupFilter, setGroupFilter } = useDiagramStore()

  const tables = useMemo(() => parseResult?.tables ?? [], [parseResult])
  const groups = useMemo(() => listGroups(tables), [tables])
  const visibleCount = useMemo(
    () => filterTablesByGroup(tables, groupFilter).length,
    [tables, groupFilter],
  )

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[var(--c-border-s)] bg-[var(--c-bg-1)]">
      <label className="text-xs text-[var(--c-text-3)]">Group:</label>
      <select
        value={groupFilter ?? ''}
        onChange={(e) => setGroupFilter(e.target.value === '' ? null : e.target.value)}
        className="bg-[var(--c-bg-3)] border border-[var(--c-border-s)] text-[var(--c-text-1)] text-xs px-2 py-1 rounded"
      >
        <option value="">All groups</option>
        {groups.map((g) => (
          <option key={g} value={g}>
            {g === UNGROUPED ? 'Ungrouped' : g}
          </option>
        ))}
      </select>
      <span className="text-xs text-[var(--c-text-4)]">
        {visibleCount} {visibleCount === 1 ? 'table' : 'tables'}
      </span>
      <div className="ml-auto">
        <ViewModeSegmented />
      </div>
    </div>
  )
}
