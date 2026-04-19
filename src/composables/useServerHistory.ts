/**
 * Tracks the list of MCP servers the user has successfully connected to, newest first.
 * Lives in `localStorage` so it survives tab close — distinct from `useSessionState`
 * which dies with the tab. Capped at a sensible size; oldest entries fall off.
 */
import { ref, watch } from 'vue'
import type { TransportKind } from './useMcpPlayground'

const STORAGE_KEY = 'mcp-playground:servers:history'
const MAX_ENTRIES = 12

export interface ServerHistoryEntry {
  url: string
  transport: TransportKind
  lastUsed: number
  lastName?: string
}

function asString(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined
}

function asTransport(v: unknown): TransportKind | undefined {
  return v === 'http' || v === 'sse' ? v : undefined
}

function load(): ServerHistoryEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((entry): ServerHistoryEntry[] => {
      if (!entry || typeof entry !== 'object') return []
      const e = entry as Record<string, unknown>
      const url = asString(e.url)
      const transport = asTransport(e.transport)
      const lastUsed = typeof e.lastUsed === 'number' ? e.lastUsed : undefined
      if (!url || !transport || !lastUsed) return []
      return [
        {
          url,
          transport,
          lastUsed,
          lastName: asString(e.lastName),
        },
      ]
    })
  } catch {
    return []
  }
}

function persist(entries: ServerHistoryEntry[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    // quota / private mode — silently skip
  }
}

function create() {
  const entries = ref<ServerHistoryEntry[]>(load())

  watch(entries, (next) => persist(next), { deep: true })

  function touch(url: string, transport: TransportKind, name?: string): void {
    const trimmed = url.trim()
    if (!trimmed) return
    const now = Date.now()
    const filtered = entries.value.filter((e) => e.url !== trimmed)
    entries.value = [
      { url: trimmed, transport, lastUsed: now, lastName: name },
      ...filtered,
    ].slice(0, MAX_ENTRIES)
  }

  function remove(url: string): void {
    entries.value = entries.value.filter((e) => e.url !== url)
  }

  function clear(): void {
    entries.value = []
  }

  return { entries, touch, remove, clear }
}

let singleton: ReturnType<typeof create> | null = null

export function useServerHistory() {
  if (!singleton) singleton = create()
  return singleton
}
