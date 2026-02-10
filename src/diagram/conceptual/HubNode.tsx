import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'

function HubNodeComponent({ data }: NodeProps) {
  const name = (data as any).label ?? ''
  return (
    <div
      className="flex items-center justify-center rounded-lg border-2 text-sm font-semibold text-gray-900 px-6 py-3 min-w-[120px]"
      style={{ backgroundColor: '#fbbf24', borderColor: '#d97706' }}
    >
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-amber-700" />
      <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-amber-700" />
      {name}
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-amber-700" />
      <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-amber-700" />
    </div>
  )
}

export const HubNode = memo(HubNodeComponent)
