import { memo } from 'react'
import { type NodeProps } from '@xyflow/react'
import { ConceptualHandles } from './pairedHandles'

function ConceptNodeComponent({ data, selected }: NodeProps) {
  const name = (data as any).label ?? ''
  return (
    <div
      className="flex items-center justify-center rounded border-2 text-sm font-semibold px-6 py-3 min-w-[120px]"
      style={{ backgroundColor: 'var(--c-bg-3)', borderColor: 'var(--c-border-s)', color: 'var(--c-text-1)', ...(selected ? { outline: '2px solid var(--c-text-1)', outlineOffset: 2 } : {}) }}
    >
      <ConceptualHandles color="var(--c-edge)" />
      {name}
    </div>
  )
}

export const ConceptNode = memo(ConceptNodeComponent)
