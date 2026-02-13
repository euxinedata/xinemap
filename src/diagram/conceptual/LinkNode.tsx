import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { DV2_COLORS } from '../dv2Colors'

const c = DV2_COLORS.link

function LinkNodeComponent({ data }: NodeProps) {
  const name = (data as any).label ?? ''
  return (
    <div className="relative flex items-center justify-center w-[100px] h-[70px]">
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 70">
        <polygon
          points="50,0 100,35 50,70 0,35"
          fill={c.bg}
          stroke={c.border}
          strokeWidth="2"
        />
      </svg>
      <Handle type="target" position={Position.Top} id="top-target" style={{ background: c.handle }} className="!w-2 !h-2" />
      <Handle type="source" position={Position.Top} id="top-source" style={{ background: c.handle }} className="!w-2 !h-2" />
      <Handle type="target" position={Position.Right} id="right-target" style={{ background: c.handle }} className="!w-2 !h-2" />
      <Handle type="source" position={Position.Right} id="right-source" style={{ background: c.handle }} className="!w-2 !h-2" />
      <span className="relative z-10 text-xs font-semibold text-white text-center">{name}</span>
      <Handle type="target" position={Position.Bottom} id="bottom-target" style={{ background: c.handle }} className="!w-2 !h-2" />
      <Handle type="source" position={Position.Bottom} id="bottom-source" style={{ background: c.handle }} className="!w-2 !h-2" />
      <Handle type="target" position={Position.Left} id="left-target" style={{ background: c.handle }} className="!w-2 !h-2" />
      <Handle type="source" position={Position.Left} id="left-source" style={{ background: c.handle }} className="!w-2 !h-2" />
    </div>
  )
}

export const LinkNode = memo(LinkNodeComponent)
