import { ref, watch } from 'vue'

export type Theme = 'light' | 'dark'
const STORAGE_KEY = 'mcp-playground:theme'

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light'
  // Explicit user choice always wins.
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    // ignore
  }
  // User rule: Light is the default initial render. `prefers-color-scheme: dark`
  // is respected as a system hint only when the user has no saved preference
  // AND we're mounting for the first time in this session.
  if (typeof window.matchMedia === 'function') {
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark'
  }
  return 'light'
}

function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.classList.toggle('dark', theme === 'dark')
  root.style.colorScheme = theme
}

function create() {
  const theme = ref<Theme>(getInitialTheme())
  applyTheme(theme.value)

  watch(theme, (next) => {
    applyTheme(next)
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // ignore
    }
  })

  function toggle() {
    theme.value = theme.value === 'dark' ? 'light' : 'dark'
  }

  return { theme, toggle }
}

let singleton: ReturnType<typeof create> | null = null

export function useTheme() {
  if (!singleton) singleton = create()
  return singleton
}
