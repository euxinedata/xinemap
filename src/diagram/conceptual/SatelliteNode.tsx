import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'

function SatelliteNodeComponent({ data }: NodeProps) {
  const name = (data as any).label ?? ''
  return (
    <div
      className="flex items-center justify-center rounded-lg border-2 text-sm font-semibold text-gray-900 px-6 py-3 min-w-[180px]"
      style={{ backgroundColor: '#FFD966', borderColor: '#D4A017' }}
    >
      <Handle type="target" position={Position.Top} style={{ background: '#B8860B' }} className="!w-2 !h-2" />
      <Handle type="target" position={Position.Left} style={{ background: '#B8860B' }} className="!w-2 !h-2" />
      {name}
      <Handle type="source" position={Position.Bottom} style={{ background: '#B8860B' }} className="!w-2 !h-2" />
      <Handle type="source" position={Position.Right} style={{ background: '#B8860B' }} className="!w-2 !h-2" />
    </div>
  )
}

export const SatelliteNode = memo(SatelliteNodeComponent)
