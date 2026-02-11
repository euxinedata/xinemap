import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'

function HubNodeComponent({ data }: NodeProps) {
  const name = (data as any).label ?? ''
  return (
    <div
      className="flex items-center justify-center rounded-full border-2 text-sm font-semibold text-gray-900 w-[120px] h-[120px] text-center"
      style={{ backgroundColor: '#5B9BD5', borderColor: '#3A7BBF' }}
    >
      <Handle type="target" position={Position.Top} style={{ background: '#2E6DA4' }} className="!w-2 !h-2" />
      <Handle type="target" position={Position.Left} style={{ background: '#2E6DA4' }} className="!w-2 !h-2" />
      {name}
      <Handle type="source" position={Position.Bottom} style={{ background: '#2E6DA4' }} className="!w-2 !h-2" />
      <Handle type="source" position={Position.Right} style={{ background: '#2E6DA4' }} className="!w-2 !h-2" />
    </div>
  )
}

export const HubNode = memo(HubNodeComponent)
