import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { DV2_COLORS } from '../dv2Colors'

const c = DV2_COLORS.hub

function HubNodeComponent({ data }: NodeProps) {
  const name = (data as any).label ?? ''
  return (
    <div
      className="flex items-center justify-center rounded-full border-2 text-sm font-semibold text-white w-[120px] h-[120px] text-center"
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

export const HubNode = memo(HubNodeComponent)
