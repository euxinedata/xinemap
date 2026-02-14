import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { DV2_COLORS } from '../dv2Colors'

const c = DV2_COLORS.satellite

function SatelliteNodeComponent({ data, selected }: NodeProps) {
  const name = (data as any).label ?? ''
  return (
    <div
      className="flex items-center justify-center rounded-lg border-2 text-sm font-semibold text-white px-6 py-3 min-w-[180px]"
      style={{ backgroundColor: c.bg, borderColor: c.border, ...(selected ? { outline: '2px solid var(--c-text-1)', outlineOffset: 2 } : {}) }}
    >
      <Handle type="target" position={Position.Top} id="top-target" style={{ background: c.handle }} className="!w-2 !h-2" />
      <Handle type="source" position={Position.Top} id="top-source" style={{ background: c.handle }} className="!w-2 !h-2" />
      <Handle type="target" position={Position.Right} id="right-target" style={{ background: c.handle }} className="!w-2 !h-2" />
      <Handle type="source" position={Position.Right} id="right-source" style={{ background: c.handle }} className="!w-2 !h-2" />
      {name}
      <Handle type="target" position={Position.Bottom} id="bottom-target" style={{ background: c.handle }} className="!w-2 !h-2" />
      <Handle type="source" position={Position.Bottom} id="bottom-source" style={{ background: c.handle }} className="!w-2 !h-2" />
      <Handle type="target" position={Position.Left} id="left-target" style={{ background: c.handle }} className="!w-2 !h-2" />
      <Handle type="source" position={Position.Left} id="left-source" style={{ background: c.handle }} className="!w-2 !h-2" />
    </div>
  )
}

export const SatelliteNode = memo(SatelliteNodeComponent)
