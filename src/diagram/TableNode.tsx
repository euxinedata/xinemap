import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { TableInfo } from '../types'

type TableNodeData = { table: TableInfo }

function TableNodeComponent({ data, id }: NodeProps) {
  const { table } = data as TableNodeData
  const headerColor = table.headerColor ?? '#374151'
  const schemaPrefix = table.schema && table.schema !== 'public' ? `${table.schema}.` : ''

  return (
    <div className="rounded-md border border-gray-600 bg-gray-800 text-xs min-w-[180px] shadow-lg">
      <div
        className="px-3 py-2 font-semibold text-white rounded-t-md"
        style={{ backgroundColor: headerColor }}
      >
        {schemaPrefix}{table.name}
      </div>
      <div className="divide-y divide-gray-700">
        {table.columns.map((col) => (
          <div key={col.name} className="relative px-3 py-1.5 flex items-center justify-between gap-3 text-gray-300">
            <Handle
              type="target"
              position={Position.Left}
              id={`${id}.${col.name}-target`}
              className="!w-2 !h-2 !bg-gray-500 !border-gray-400"
            />
            <span className="flex items-center gap-1.5">
              <span>{col.name}</span>
              {col.isPrimaryKey && (
                <span className="text-[9px] px-1 rounded bg-yellow-700 text-yellow-200 font-bold">PK</span>
              )}
              {col.isForeignKey && (
                <span className="text-[9px] px-1 rounded bg-blue-700 text-blue-200 font-bold">FK</span>
              )}
            </span>
            <span className="text-gray-500">{col.type}</span>
            <Handle
              type="source"
              position={Position.Right}
              id={`${id}.${col.name}-source`}
              className="!w-2 !h-2 !bg-gray-500 !border-gray-400"
            />
          </div>
        ))}
      </div>
    </div>
  )
}

export const TableNode = memo(TableNodeComponent)
