import { memo } from 'react'
import type { NodeProps } from '@xyflow/react'
import type { EnumInfo } from '../types'

type EnumNodeData = { enumInfo: EnumInfo }

function EnumNodeComponent({ data }: NodeProps) {
  const { enumInfo } = data as EnumNodeData
  const schemaPrefix = enumInfo.schema && enumInfo.schema !== 'public' ? `${enumInfo.schema}.` : ''

  return (
    <div className="rounded-md border border-indigo-700 bg-[var(--c-bg-3)] text-xs min-w-[140px] shadow-lg">
      <div className="px-3 py-2 font-semibold text-indigo-200 bg-indigo-900 rounded-t-md">
        {schemaPrefix}{enumInfo.name}
      </div>
      <div className="divide-y divide-[var(--c-divide)]">
        {enumInfo.values.map((v) => (
          <div key={v.name} className="px-3 py-1.5 text-[var(--c-text-3)]">
            {v.name}
          </div>
        ))}
      </div>
    </div>
  )
}

export const EnumNode = memo(EnumNodeComponent)
