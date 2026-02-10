import { memo } from 'react'
import type { NodeProps } from '@xyflow/react'

function NoteNodeComponent({ data }: NodeProps) {
  const name = (data as any).label ?? ''
  const content = (data as any).content ?? ''
  return (
    <div
      className="rounded border text-xs p-3 min-w-[140px] max-w-[200px] shadow"
      style={{ backgroundColor: '#fef9c3', borderColor: '#ca8a04', color: '#713f12' }}
    >
      {name && <div className="font-semibold mb-1">{name}</div>}
      <div className="whitespace-pre-wrap">{content}</div>
    </div>
  )
}

export const NoteNode = memo(NoteNodeComponent)
