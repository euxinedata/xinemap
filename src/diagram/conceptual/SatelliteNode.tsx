import { memo } from 'react'
import { type NodeProps } from '@xyflow/react'
import { DV2_COLORS } from '../dv2Colors'
import { ConceptualHandles } from './pairedHandles'

const c = DV2_COLORS.satellite

function SatelliteNodeComponent({ data, selected }: NodeProps) {
  const name = (data as any).label ?? ''
  return (
    <div
      className="flex items-center justify-center rounded-lg border-2 text-sm font-semibold text-white px-6 py-3 min-w-[180px]"
      style={{ backgroundColor: c.bg, borderColor: c.border, ...(selected ? { outline: '2px solid var(--c-text-1)', outlineOffset: 2 } : {}) }}
    >
      <ConceptualHandles color={c.handle} />
      {name}
    </div>
  )
}

export const SatelliteNode = memo(SatelliteNodeComponent)
