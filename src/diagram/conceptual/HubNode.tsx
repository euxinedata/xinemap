import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { DV2_COLORS } from '../dv2Colors'

const c = DV2_COLORS.hub

function HubNodeComponent({ data, selected }: NodeProps) {
  const name = (data as any).label ?? ''
  // Estimate text width: ~8px per char at text-sm, add padding for ellipse (text fits in ~60% of ellipse width)
  const textWidth = Math.max(name.length * 8, 60)
  const w = Math.max(textWidth * 1.7, 120)
  const h = Math.max(60, w * 0.55)
  return (
    <div
      className="flex items-center justify-center border-2 text-sm font-semibold text-white text-center"
      style={{ backgroundColor: c.bg, borderColor: c.border, borderRadius: '50%', width: w, height: h, ...(selected ? { outline: '2px solid var(--c-text-1)', outlineOffset: 2 } : {}) }}
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

export const HubNode = memo(HubNodeComponent)
