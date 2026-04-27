import { describe, it, expect } from 'vitest'
import { entityTypeFromNote } from './entityTypeFromNote'

describe('entityTypeFromNote', () => {
  it('returns null when note is undefined', () => {
    expect(entityTypeFromNote(undefined)).toBeNull()
  })

  it('returns null when note is empty', () => {
    expect(entityTypeFromNote('')).toBeNull()
  })

  it('returns null for note with no marker', () => {
    expect(entityTypeFromNote('Customer master entity')).toBeNull()
  })

  it('detects HUB marker', () => {
    expect(entityTypeFromNote('**HUB** Customer master.')).toBe('hub')
  })

  it('detects SAT marker', () => {
    expect(entityTypeFromNote('**SAT** Customer demographics.')).toBe('satellite')
  })

  it('detects LNK marker', () => {
    expect(entityTypeFromNote('**LNK** Order ↔ customer.')).toBe('link')
  })

  it('detects REF marker', () => {
    expect(entityTypeFromNote('**REF** ISO country codes.')).toBe('reference')
  })

  it('matches case-insensitively (lowercase)', () => {
    expect(entityTypeFromNote('**hub** lowercase form')).toBe('hub')
    expect(entityTypeFromNote('**sat** lowercase form')).toBe('satellite')
    expect(entityTypeFromNote('**lnk** lowercase form')).toBe('link')
    expect(entityTypeFromNote('**ref** lowercase form')).toBe('reference')
  })

  it('matches case-insensitively (mixed case)', () => {
    expect(entityTypeFromNote('**Hub** mixed case')).toBe('hub')
    expect(entityTypeFromNote('**SaT** mixed case')).toBe('satellite')
  })

  it('matches markers anywhere in the note', () => {
    expect(entityTypeFromNote('Customer master. **HUB** of the party model.')).toBe('hub')
    expect(entityTypeFromNote('Trailing marker **LNK**')).toBe('link')
  })

  it('returns the first marker when multiple are present', () => {
    expect(entityTypeFromNote('**SAT** then **HUB** later')).toBe('satellite')
    expect(entityTypeFromNote('**LNK** wins over **REF**')).toBe('link')
  })

  it('does not match partial words (e.g. **HUBS**)', () => {
    expect(entityTypeFromNote('**HUBS** plural form')).toBeNull()
    expect(entityTypeFromNote('**HUBA** typo')).toBeNull()
  })

  it('does not match without the asterisks', () => {
    expect(entityTypeFromNote('HUB without bold')).toBeNull()
  })
})
