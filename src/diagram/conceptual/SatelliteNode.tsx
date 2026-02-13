import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { DV2_COLORS } from '../dv2Colors'

const c = DV2_COLORS.satellite

function SatelliteNodeComponent({ data }: NodeProps) {
  const name = (data as any).label ?? ''
  return (
    <div
      className="flex items-center justify-center rounded-lg border-2 text-sm font-semibold text-white px-6 py-3 min-w-[180px]"
      style={{ backgroundColor: c.bg, borderColor: c.border }}
    >
      <Handle type="target" position={Position.Top} style={{ background: c.handle }} className="!w-2 !h-2" />
      <Handle type="target" position={Position.Left} style={{ background: c.handle }} className="!w-2 !h-2" />
      {name}
      <Handle type="source" position={Position.Bottom} style={{ background: c.handle }} className="!w-2 !h-2" />
      <Handle type="source" position={Position.Right} style={{ background: c.handle }} className="!w-2 !h-2" />
    </div>
  )
}

export const SatelliteNode = memo(SatelliteNodeComponent)
