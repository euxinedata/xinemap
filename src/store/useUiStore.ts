import { create } from 'zustand'

export type Page = 'main' | 'changelog'

interface UiState {
  activePage: Page
  setPage: (p: Page) => void
}

export const useUiStore = create<UiState>()((set) => ({
  activePage: 'main',
  setPage: (activePage) => set({ activePage }),
}))
