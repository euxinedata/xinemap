import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'

function ConceptNodeComponent({ data }: NodeProps) {
  const name = (data as any).label ?? ''
  return (
    <div
      className="flex items-center justify-center rounded border-2 text-sm font-semibold px-6 py-3 min-w-[120px]"
      style={{ backgroundColor: '#374151', borderColor: '#6b7280', color: '#e5e7eb' }}
    >
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-gray-500" />
      <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-gray-500" />
      {name}
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-gray-500" />
      <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-gray-500" />
    </div>
  )
}

export const ConceptNode = memo(ConceptNodeComponent)
