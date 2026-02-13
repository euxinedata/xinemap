import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { TableInfo, DV2EntityType } from '../types'
import { useDiagramStore } from '../store/useDiagramStore'
import { DV2_COLORS } from './dv2Colors'

type TableNodeData = { table: TableInfo; dv2EntityType?: DV2EntityType; satelliteCount?: number; isCollapsed?: boolean; onCollapse?: () => void }

function TableNodeComponent({ data, id }: NodeProps) {
  const { table, dv2EntityType, satelliteCount, isCollapsed, onCollapse } = data as TableNodeData
  const dv2Colors = dv2EntityType ? DV2_COLORS[dv2EntityType] : undefined
  const headerColor = dv2Colors?.bg ?? table.headerColor ?? '#374151'
  const schemaPrefix = table.schema && table.schema !== 'public' ? `${table.schema}.` : ''
  const borderColor = dv2Colors?.border

  return (
    <div
      className="rounded-md border bg-[var(--c-bg-3)] text-xs min-w-[180px] shadow-lg"
      style={{ borderColor: borderColor ?? 'var(--c-border-s)' }}
    >
      <div
        className="px-3 py-2 font-semibold text-white rounded-t-md flex items-center justify-between"
        style={{ backgroundColor: headerColor }}
      >
        <span>
          {schemaPrefix}{table.name}
        </span>
        {satelliteCount != null && satelliteCount > 0 && (
          <button
            className="ml-2 flex items-center gap-1 opacity-70 hover:opacity-100 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation()
              useDiagramStore.getState().toggleHubCollapse(id)
            }}
            title={isCollapsed ? `Show ${satelliteCount} satellites` : `Hide ${satelliteCount} satellites`}
          >
            <span className="text-[10px] text-white font-normal">{satelliteCount}</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity={isCollapsed ? 0.4 : 1}>
              <path d="m13.5 6.5-3.148-3.148a1.205 1.205 0 0 0-1.704 0L6.352 5.648a1.205 1.205 0 0 0 0 1.704L9.5 10.5" />
              <path d="M16.5 7.5 19 5" />
              <path d="m17.5 10.5 3.148 3.148a1.205 1.205 0 0 1 0 1.704l-2.296 2.296a1.205 1.205 0 0 1-1.704 0L13.5 14.5" />
              <path d="M9 21a6 6 0 0 0-6-6" />
              <path d="M9.352 10.648a1.205 1.205 0 0 0 0 1.704l2.296 2.296a1.205 1.205 0 0 0 1.704 0l4.296-4.296a1.205 1.205 0 0 0 0-1.704l-2.296-2.296a1.205 1.205 0 0 0-1.704 0z" />
            </svg>
          </button>
        )}
        {onCollapse && (
          <button
            className="ml-1 text-[10px] opacity-70 hover:opacity-100 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation()
              onCollapse()
            }}
          >
            {'\u2715'}
          </button>
        )}
      </div>
      <div className="divide-y divide-[var(--c-divide)]">
        {table.columns.map((col) => (
          <div key={col.name} className={`relative px-3 py-1.5 flex items-center justify-between gap-3 text-[var(--c-text-2)]${col.isInjected ? ' opacity-50' : ''}`}>
            <Handle type="target" position={Position.Left} id={`${id}.${col.name}-L-tgt`} className="!w-2 !h-2" style={{ background: 'var(--c-edge)' }} />
            <Handle type="source" position={Position.Left} id={`${id}.${col.name}-L-src`} className="!w-2 !h-2" style={{ background: 'var(--c-edge)' }} />
            <span className="flex items-center gap-1.5">
              <span>{col.name}</span>
              {col.isPrimaryKey && (
                <span className="text-[9px] px-1 rounded bg-yellow-700 text-yellow-200 font-bold">PK</span>
              )}
              {col.isForeignKey && (
                <span className="text-[9px] px-1 rounded bg-blue-700 text-blue-200 font-bold">FK</span>
              )}
              {col.dv2Role === 'hk' && (
                <span className="text-[9px] px-1 rounded bg-orange-700 text-orange-200 font-bold">HK</span>
              )}
              {col.dv2Role === 'bk' && (
                <span className="text-[9px] px-1 rounded bg-green-700 text-green-200 font-bold">BK</span>
              )}
              {col.dv2Role === 'mak' && (
                <span className="text-[9px] px-1 rounded bg-purple-700 text-purple-200 font-bold">MAK</span>
              )}
              {col.dv2Role === 'dk' && (
                <span className="text-[9px] px-1 rounded bg-cyan-700 text-cyan-200 font-bold">DK</span>
              )}
            </span>
            <span className="text-[var(--c-text-4)]">{col.type}</span>
            <Handle type="target" position={Position.Right} id={`${id}.${col.name}-R-tgt`} className="!w-2 !h-2" style={{ background: 'var(--c-edge)' }} />
            <Handle type="source" position={Position.Right} id={`${id}.${col.name}-R-src`} className="!w-2 !h-2" style={{ background: 'var(--c-edge)' }} />
          </div>
        ))}
      </div>
    </div>
  )
}

export const TableNode = memo(TableNodeComponent)
