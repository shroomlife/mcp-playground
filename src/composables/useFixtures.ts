/**
 * Saved Tool-Call Fixtures, per MCP server URL, persisted in `localStorage`.
 *
 * Users "bookmark" a configured tool call (name + args) so they can replay it later
 * or hand it to a colleague as a smoketest. Later additions could include an expected
 * result shape for regression testing, or a global Fixtures tab with Replay-All.
 */
import { computed, ref, watch, type Ref } from 'vue'

const STORAGE_PREFIX = 'mcp-playground:fixtures:'
const MAX_PER_SERVER = 50

export interface Fixture {
  id: string
  toolName: string
  args: Record<string, unknown>
  savedAt: number
  note?: string
}

function normalizeUrl(url: string): string {
  return url.trim().toLowerCase()
}

function storageKey(mcpUrl: string): string {
  return STORAGE_PREFIX + normalizeUrl(mcpUrl)
}

function isFixture(v: unknown): v is Fixture {
  if (!v || typeof v !== 'object') return false
  const f = v as Record<string, unknown>
  return (
    typeof f.id === 'string' &&
    typeof f.toolName === 'string' &&
    typeof f.savedAt === 'number' &&
    Boolean(f.args) &&
    typeof f.args === 'object' &&
    !Array.isArray(f.args)
  )
}

export function loadFixtures(mcpUrl: string): Fixture[] {
  if (!mcpUrl || typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(storageKey(mcpUrl))
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isFixture)
  } catch {
    return []
  }
}

export function saveFixtures(mcpUrl: string, fixtures: Fixture[]): void {
  if (!mcpUrl || typeof window === 'undefined') return
  try {
    const trimmed = fixtures.slice(0, MAX_PER_SERVER)
    window.localStorage.setItem(storageKey(mcpUrl), JSON.stringify(trimmed))
  } catch {
    // quota / private-mode — silently skip
  }
}

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `f-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Reactive fixtures for the given server URL. Writes through to localStorage on change;
 * consumers can call add/remove/clear and stay in sync.
 */
export function useFixtures(mcpUrl: Ref<string>) {
  const fixtures = ref<Fixture[]>([])

  watch(
    () => mcpUrl.value,
    (next) => {
      fixtures.value = next ? loadFixtures(next) : []
    },
    { immediate: true },
  )

  function add(toolName: string, args: Record<string, unknown>, note?: string): Fixture {
    const fixture: Fixture = {
      id: newId(),
      toolName,
      args: structuredClone(args),
      savedAt: Date.now(),
      note,
    }
    fixtures.value = [fixture, ...fixtures.value].slice(0, MAX_PER_SERVER)
    saveFixtures(mcpUrl.value, fixtures.value)
    return fixture
  }

  function remove(id: string): void {
    fixtures.value = fixtures.value.filter((f) => f.id !== id)
    saveFixtures(mcpUrl.value, fixtures.value)
  }

  function clear(): void {
    fixtures.value = []
    saveFixtures(mcpUrl.value, [])
  }

  function forTool(toolName: string) {
    return computed(() => fixtures.value.filter((f) => f.toolName === toolName))
  }

  return { fixtures, add, remove, clear, forTool }
}
