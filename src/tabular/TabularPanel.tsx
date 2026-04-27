import { useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { useEditorStore } from '../store/useEditorStore'
import { useDiagramStore } from '../store/useDiagramStore'
import { TableGrid } from './TableGrid'
import { filterTablesByGroup } from './filterTablesByGroup'
import type { TableInfo, DV2EntityType } from '../types'

interface Row {
  id: string
  schema: string
  name: string
  type: DV2EntityType | ''
  group: string
  groupColor: string | null
  columnCount: number
  note: string
  line: number | null
}

export function TabularPanel() {
  const { parseResult } = useEditorStore()
  const groupFilter = useDiagramStore((s) => s.groupFilter)

  const tables: TableInfo[] = useMemo(() => parseResult?.tables ?? [], [parseResult])

  const filteredTables = useMemo(
    () => filterTablesByGroup(tables, groupFilter),
    [tables, groupFilter],
  )

  const rows: Row[] = useMemo(
    () =>
      filteredTables.map((t) => ({
        id: t.id,
        schema: t.schema,
        name: t.name,
        type: parseResult?.dv2Metadata.get(t.id)?.entityType ?? '',
        group: t.group ?? '',
        groupColor: t.groupColor ?? null,
        columnCount: t.columns.length,
        note: t.note ?? '',
        line: t.line ?? null,
      })),
    [filteredTables, parseResult],
  )

  const columns: ColumnDef<Row>[] = useMemo(
    () => [
      { accessorKey: 'schema', header: 'Schema' },
      { accessorKey: 'name', header: 'Name' },
      { accessorKey: 'type', header: 'Type' },
      {
        accessorKey: 'group',
        header: 'Group',
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5">
            {row.original.groupColor && (
              <span
                className="inline-block w-2.5 h-2.5 rounded-sm border border-[var(--c-border-s)]"
                style={{ background: row.original.groupColor }}
              />
            )}
            <span>{row.original.group}</span>
          </div>
        ),
      },
      {
        accessorKey: 'columnCount',
        header: 'Columns',
        cell: ({ getValue }) => <span className="tabular-nums">{getValue<number>()}</span>,
        enableColumnFilter: false,
      },
      {
        accessorKey: 'note',
        header: 'Note',
        cell: ({ getValue }) => {
          const v = getValue<string>()
          return (
            <span
              title={v}
              className="block max-w-[40ch] overflow-hidden text-ellipsis whitespace-nowrap text-[var(--c-text-3)]"
            >
              {v}
            </span>
          )
        },
      },
    ],
    [],
  )

  function handleRowClick(row: Row) {
    if (row.line != null) {
      useEditorStore.getState().scrollToLine?.(row.line)
    }
  }

  return (
    <div className="w-full h-full flex flex-col bg-[var(--c-bg-1)]">
      <div className="flex-1 min-h-0">
        <TableGrid data={rows} columns={columns} onRowClick={handleRowClick} />
      </div>
    </div>
  )
}
