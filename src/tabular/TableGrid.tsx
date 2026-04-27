import { useState } from 'react'
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
} from '@tanstack/react-table'

interface TableGridProps<T> {
  data: T[]
  columns: ColumnDef<T>[]
  onRowClick?: (row: T) => void
}

export function TableGrid<T>({ data, columns, onRowClick }: TableGridProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  return (
    <div className="w-full h-full overflow-auto text-xs">
      <table className="w-full border-collapse">
        <thead className="sticky top-0 bg-[var(--c-bg-2)] z-10">
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id} className="border-b border-[var(--c-border-s)]">
              {hg.headers.map((h) => {
                const sortDir = h.column.getIsSorted()
                return (
                  <th
                    key={h.id}
                    className="text-left text-[var(--c-text-3)] font-medium px-2 py-1.5 select-none"
                  >
                    <div
                      className="flex items-center gap-1 cursor-pointer hover:text-[var(--c-text-1)]"
                      onClick={h.column.getToggleSortingHandler()}
                    >
                      {flexRender(h.column.columnDef.header, h.getContext())}
                      {sortDir === 'asc' && <span>↑</span>}
                      {sortDir === 'desc' && <span>↓</span>}
                    </div>
                    {h.column.getCanFilter() && (
                      <input
                        value={(h.column.getFilterValue() as string) ?? ''}
                        onChange={(e) => h.column.setFilterValue(e.target.value)}
                        placeholder="filter…"
                        className="mt-1 w-full bg-[var(--c-bg-1)] border border-[var(--c-border-s)] rounded px-1 py-0.5 text-[var(--c-text-1)] placeholder:text-[var(--c-text-4)]"
                        onClick={(e) => e.stopPropagation()}
                      />
                    )}
                  </th>
                )
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              className="border-b border-[var(--c-border-s)] hover:bg-[var(--c-bg-3)] cursor-pointer"
              onClick={() => onRowClick?.(row.original)}
            >
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="px-2 py-1 text-[var(--c-text-1)] align-top">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
