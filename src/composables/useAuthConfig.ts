import { ref, watch } from 'vue'
import type { AuthHeader } from './useMcpPlayground'

const STORAGE_PREFIX = 'mcp-playground:auth:'
const LEGACY_STORAGE_PREFIX = 'mcp-inspector:auth:'

function normalizeUrl(url: string): string {
  return url.trim().toLowerCase()
}

function storageKey(url: string): string {
  return STORAGE_PREFIX + normalizeUrl(url)
}

function legacyStorageKey(url: string): string {
  return LEGACY_STORAGE_PREFIX + normalizeUrl(url)
}

function parseStored(raw: string | null): AuthHeader[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((entry): AuthHeader[] => {
      if (
        entry &&
        typeof entry === 'object' &&
        'key' in entry &&
        'value' in entry &&
        typeof (entry as { key: unknown }).key === 'string' &&
        typeof (entry as { value: unknown }).value === 'string'
      ) {
        return [{ key: (entry as AuthHeader).key, value: (entry as AuthHeader).value }]
      }
      return []
    })
  } catch {
    return []
  }
}

function readFromStorage(url: string): AuthHeader[] {
  if (!url || typeof window === 'undefined') return []
  try {
    const store = window.localStorage
    const current = parseStored(store.getItem(storageKey(url)))
    if (current.length > 0) return current

    // One-time migration: rename mcp-inspector → mcp-playground.
    const legacy = parseStored(store.getItem(legacyStorageKey(url)))
    if (legacy.length > 0) {
      store.setItem(storageKey(url), JSON.stringify(legacy))
      store.removeItem(legacyStorageKey(url))
      return legacy
    }
    return []
  } catch {
    return []
  }
}

function writeToStorage(url: string, headers: AuthHeader[]) {
  if (!url || typeof window === 'undefined') return
  try {
    const key = storageKey(url)
    const meaningful = headers.filter((h) => h.key.trim() && h.value)
    if (meaningful.length === 0) {
      window.localStorage.removeItem(key)
      return
    }
    window.localStorage.setItem(key, JSON.stringify(meaningful))
  } catch {
    // storage may be full / blocked — silently ignore
  }
}

export function useAuthConfig() {
  const headers = ref<AuthHeader[]>([])
  const currentUrl = ref('')

  function loadForUrl(url: string) {
    currentUrl.value = url
    headers.value = readFromStorage(url)
  }

  function setBearer(token: string) {
    const trimmed = token.trim()
    const others = headers.value.filter((h) => h.key.trim().toLowerCase() !== 'authorization')
    if (trimmed) {
      headers.value = [{ key: 'Authorization', value: `Bearer ${trimmed}` }, ...others]
    } else {
      headers.value = others
    }
  }

  function getBearerToken(): string {
    const authHeader = headers.value.find(
      (h) => h.key.trim().toLowerCase() === 'authorization',
    )
    if (!authHeader) return ''
    const match = authHeader.value.match(/^Bearer\s+(.+)$/i)
    return match?.[1]?.trim() ?? ''
  }

  function addHeader() {
    headers.value = [...headers.value, { key: '', value: '' }]
  }

  function updateHeader(index: number, next: AuthHeader) {
    const copy = [...headers.value]
    copy[index] = next
    headers.value = copy
  }

  function removeHeader(index: number) {
    headers.value = headers.value.filter((_, i) => i !== index)
  }

  function clear() {
    headers.value = []
  }

  // Kein deep-Watch: `headers` wird bei jeder Mutation als neues Array
  // zugewiesen (siehe addHeader/updateHeader/removeHeader unten), Reference-
  // Check reicht für den Storage-Sync.
  watch([headers, currentUrl], ([nextHeaders, nextUrl]) => {
    if (nextUrl) writeToStorage(nextUrl, nextHeaders)
  })

  return {
    headers,
    currentUrl,
    loadForUrl,
    setBearer,
    getBearerToken,
    addHeader,
    updateHeader,
    removeHeader,
    clear,
  }
}
