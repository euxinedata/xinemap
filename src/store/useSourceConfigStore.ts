import { create } from 'zustand'
import type { SourceConfig, SourceMapping, DbtProjectInfo } from '../types'

const STORAGE_KEY = 'dglml-source-config'

function loadFromStorage(): SourceConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveToStorage(config: SourceConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
}

interface SourceConfigState {
  sourceConfig: SourceConfig
  dbtProject: DbtProjectInfo | null
  setMapping: (tableId: string, mapping: SourceMapping) => void
  removeMapping: (tableId: string) => void
  setSourceConfig: (config: SourceConfig) => void
  setDbtProject: (info: DbtProjectInfo | null) => void
}

export const useSourceConfigStore = create<SourceConfigState>()((set) => ({
  sourceConfig: loadFromStorage(),
  dbtProject: null,

  setMapping: (tableId, mapping) =>
    set((state) => {
      const next = { ...state.sourceConfig, [tableId]: mapping }
      saveToStorage(next)
      return { sourceConfig: next }
    }),

  removeMapping: (tableId) =>
    set((state) => {
      const next = { ...state.sourceConfig }
      delete next[tableId]
      saveToStorage(next)
      return { sourceConfig: next }
    }),

  setSourceConfig: (config) => {
    saveToStorage(config)
    set({ sourceConfig: config })
  },

  setDbtProject: (info) => set({ dbtProject: info }),
}))
