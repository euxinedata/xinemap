import type { DV2EntityType } from '../types'

export const DV2_COLORS: Record<DV2EntityType, { bg: string; border: string; handle: string }> = {
  hub:       { bg: '#CB4335', border: '#EC7063', handle: '#A93226' },
  satellite: { bg: '#2980B9', border: '#5DADE2', handle: '#1A5276' },
  link:      { bg: '#27AE60', border: '#58D68D', handle: '#1E8449' },
  reference: { bg: '#5D6D7E', border: '#85929E', handle: '#4A5568' },
}
