import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'

type StubNodeData = {
  label: string
  entityType?: string
  headerColor?: string
  onExpand: () => void
}

const typeColors: Record<string, string> = {
  hub: '#6495ED',
  satellite: '#D4A017',
  link: '#CD5C5C',
}

function StubNodeComponent({ data, id }: NodeProps) {
  const { label, entityType, headerColor, onExpand } = data as StubNodeData
  const color = headerColor ?? (entityType ? typeColors[entityType] : undefined) ?? '#6b7280'

  return (
    <div
      className="rounded border border-[var(--c-border-s)] bg-[var(--c-bg-3)] text-xs px-3 py-2 flex items-center gap-2 cursor-pointer hover:bg-[var(--c-bg-2)] shadow"
      onClick={onExpand}
    >
      <Handle
        type="target"
        position={Position.Left}
        id={`${id}-target`}
        className="!w-2 !h-2"
        style={{ background: color }}
      />
      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
      <span className="text-[var(--c-text-2)] truncate">{label}</span>
      {entityType && (
        <span className="text-[9px] text-[var(--c-text-4)] ml-auto">{entityType}</span>
      )}
      <Handle
        type="source"
        position={Position.Right}
        id={`${id}-source`}
        className="!w-2 !h-2"
        style={{ background: color }}
      />
    </div>
  )
}

export const StubNode = memo(StubNodeComponent)
