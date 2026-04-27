import type { DV2EntityType } from '../types'

export const DV2_COLORS: Record<DV2EntityType, { bg: string; border: string; handle: string }> = {
  hub:       { bg: '#CB4335', border: '#EC7063', handle: '#A93226' },
  satellite: { bg: '#2980B9', border: '#5DADE2', handle: '#1A5276' },
  link:      { bg: '#27AE60', border: '#58D68D', handle: '#1E8449' },
  reference: { bg: '#E67E22', border: '#F5B041', handle: '#B9770E' },
}

export function dv2EdgeColor(
  srcType: DV2EntityType | undefined,
  tgtType: DV2EntityType | undefined,
): string | undefined {
  const child = [srcType, tgtType].find((t) => t === 'satellite' || t === 'link' || t === 'reference')
  if (child) return DV2_COLORS[child].border
  return undefined
}
