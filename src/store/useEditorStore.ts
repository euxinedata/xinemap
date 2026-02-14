import { create } from 'zustand'
import type { ParseResult, ValidationResult } from '../types'

interface EditorState {
  dbml: string
  parseResult: ParseResult | null
  parseErrors: string[]
  validationResult: ValidationResult | null
  lastSavedDbml: string
  scrollToLine: ((line: number) => void) | null
  setDbml: (dbml: string) => void
  setLastSavedDbml: (dbml: string) => void
  setParseResult: (result: ParseResult | null) => void
  setParseErrors: (errors: string[]) => void
  setValidationResult: (result: ValidationResult | null) => void
  setScrollToLine: (fn: ((line: number) => void) | null) => void
}

export const useEditorStore = create<EditorState>()((set) => ({
  dbml: '',
  parseResult: null,
  parseErrors: [],
  validationResult: null,
  lastSavedDbml: '',
  scrollToLine: null,
  setDbml: (dbml) => set({ dbml }),
  setLastSavedDbml: (lastSavedDbml) => set({ lastSavedDbml }),
  setParseResult: (parseResult) => set({ parseResult }),
  setParseErrors: (parseErrors) => set({ parseErrors }),
  setValidationResult: (validationResult) => set({ validationResult }),
  setScrollToLine: (scrollToLine) => set({ scrollToLine }),
}))
