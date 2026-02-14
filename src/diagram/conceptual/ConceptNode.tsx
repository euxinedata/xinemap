import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'

function ConceptNodeComponent({ data, selected }: NodeProps) {
  const name = (data as any).label ?? ''
  return (
    <div
      className="flex items-center justify-center rounded border-2 text-sm font-semibold px-6 py-3 min-w-[120px]"
      style={{ backgroundColor: 'var(--c-bg-3)', borderColor: 'var(--c-border-s)', color: 'var(--c-text-1)', ...(selected ? { outline: '2px solid var(--c-text-1)', outlineOffset: 2 } : {}) }}
    >
      <Handle type="target" position={Position.Top} id="top-target" className="!w-2 !h-2" style={{ background: 'var(--c-edge)' }} />
      <Handle type="source" position={Position.Top} id="top-source" className="!w-2 !h-2" style={{ background: 'var(--c-edge)' }} />
      <Handle type="target" position={Position.Right} id="right-target" className="!w-2 !h-2" style={{ background: 'var(--c-edge)' }} />
      <Handle type="source" position={Position.Right} id="right-source" className="!w-2 !h-2" style={{ background: 'var(--c-edge)' }} />
      {name}
      <Handle type="target" position={Position.Bottom} id="bottom-target" className="!w-2 !h-2" style={{ background: 'var(--c-edge)' }} />
      <Handle type="source" position={Position.Bottom} id="bottom-source" className="!w-2 !h-2" style={{ background: 'var(--c-edge)' }} />
      <Handle type="target" position={Position.Left} id="left-target" className="!w-2 !h-2" style={{ background: 'var(--c-edge)' }} />
      <Handle type="source" position={Position.Left} id="left-source" className="!w-2 !h-2" style={{ background: 'var(--c-edge)' }} />
    </div>
  )
}

export const ConceptNode = memo(ConceptNodeComponent)
