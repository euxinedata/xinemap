import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'

function SatelliteNodeComponent({ data }: NodeProps) {
  const name = (data as any).label ?? ''
  return (
    <div
      className="flex items-center justify-center rounded-full border-2 text-sm font-semibold text-gray-900 w-[100px] h-[100px] text-center"
      style={{ backgroundColor: '#4ade80', borderColor: '#16a34a' }}
    >
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-green-700" />
      <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-green-700" />
      {name}
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-green-700" />
      <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-green-700" />
    </div>
  )
}

export const SatelliteNode = memo(SatelliteNodeComponent)
