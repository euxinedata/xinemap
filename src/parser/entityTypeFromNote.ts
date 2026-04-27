import type { DV2EntityType } from '../types'

const MARKER_TO_TYPE: Record<string, DV2EntityType> = {
  HUB: 'hub',
  SAT: 'satellite',
  LNK: 'link',
  REF: 'reference',
}

const MARKER_REGEX = /\*\*(HUB|SAT|LNK|REF)\*\*/i

export function entityTypeFromNote(note: string | undefined): DV2EntityType | null {
  if (!note) return null
  const match = MARKER_REGEX.exec(note)
  if (!match) return null
  return MARKER_TO_TYPE[match[1].toUpperCase()] ?? null
}
