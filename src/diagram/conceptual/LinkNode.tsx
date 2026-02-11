import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'

function LinkNodeComponent({ data }: NodeProps) {
  const name = (data as any).label ?? ''
  return (
    <div className="relative flex items-center justify-center w-[100px] h-[70px]">
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 70">
        <polygon
          points="50,0 100,35 50,70 0,35"
          fill="#E8634F"
          stroke="#C0392B"
          strokeWidth="2"
        />
      </svg>
      <Handle type="target" position={Position.Top} style={{ background: '#A93226' }} className="!w-2 !h-2" />
      <Handle type="target" position={Position.Left} style={{ background: '#A93226' }} className="!w-2 !h-2" />
      <span className="relative z-10 text-xs font-semibold text-gray-900 text-center">{name}</span>
      <Handle type="source" position={Position.Bottom} style={{ background: '#A93226' }} className="!w-2 !h-2" />
      <Handle type="source" position={Position.Right} style={{ background: '#A93226' }} className="!w-2 !h-2" />
    </div>
  )
}

export const LinkNode = memo(LinkNodeComponent)
