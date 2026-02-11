import { create } from 'zustand'
import type { ParseResult, ValidationResult } from '../types'

interface EditorState {
  dbml: string
  parseResult: ParseResult | null
  parseErrors: string[]
  validationResult: ValidationResult | null
  setDbml: (dbml: string) => void
  setParseResult: (result: ParseResult | null) => void
  setParseErrors: (errors: string[]) => void
  setValidationResult: (result: ValidationResult | null) => void
}

export const useEditorStore = create<EditorState>()((set) => ({
  dbml: '',
  parseResult: null,
  parseErrors: [],
  validationResult: null,
  setDbml: (dbml) => set({ dbml }),
  setParseResult: (parseResult) => set({ parseResult }),
  setParseErrors: (parseErrors) => set({ parseErrors }),
  setValidationResult: (validationResult) => set({ validationResult }),
}))
