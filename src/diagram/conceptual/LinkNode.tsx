import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'

function LinkNodeComponent({ data }: NodeProps) {
  const name = (data as any).label ?? ''
  return (
    <div className="relative flex items-center justify-center w-[120px] h-[80px]">
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 120 80">
        <polygon
          points="60,0 120,40 60,80 0,40"
          fill="#fbbf24"
          stroke="#d97706"
          strokeWidth="2"
        />
      </svg>
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-amber-700" />
      <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-amber-700" />
      <span className="relative z-10 text-xs font-semibold text-gray-900 text-center">{name}</span>
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-amber-700" />
      <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-amber-700" />
    </div>
  )
}

export const LinkNode = memo(LinkNodeComponent)
