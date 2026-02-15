import { create } from 'zustand'

const STORAGE_KEY = 'xinemap-theme'

function applyTheme(isDark: boolean) {
  document.documentElement.classList.toggle('dark', isDark)
}

// Initialize from localStorage or default to dark
const stored = localStorage.getItem(STORAGE_KEY)
const initialIsDark = stored ? stored === 'dark' : true

interface ThemeState {
  isDark: boolean
  toggle: () => void
}

export const useThemeStore = create<ThemeState>()((set) => ({
  isDark: initialIsDark,
  toggle: () =>
    set((state) => {
      const next = !state.isDark
      localStorage.setItem(STORAGE_KEY, next ? 'dark' : 'light')
      applyTheme(next)
      return { isDark: next }
    }),
}))
