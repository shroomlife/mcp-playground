import { ref, watch } from 'vue'
import type { TransportKind } from './useMcpPlayground'

const STORAGE_KEY = 'mcp-playground:session'

export type TabId =
  | 'tools'
  | 'resources'
  | 'prompts'
  | 'rpc'
  | 'log'
  | 'extensions'
  | 'experimental'

const TAB_IDS: readonly TabId[] = [
  'tools',
  'resources',
  'prompts',
  'rpc',
  'log',
  'extensions',
  'experimental',
]

interface Snapshot {
  url: string
  transport: TransportKind
  tab: TabId
  toolName: string | null
  promptName: string | null
  resourceKey: string | null
  searchTools: string
  searchPrompts: string
  searchResources: string
}

const DEFAULT: Snapshot = {
  url: '',
  transport: 'http',
  tab: 'tools',
  toolName: null,
  promptName: null,
  resourceKey: null,
  searchTools: '',
  searchPrompts: '',
  searchResources: '',
}

function asNullableString(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (value === null) return null
  return null
}

function asString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback
}

function load(): Snapshot {
  if (typeof window === 'undefined') return DEFAULT
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return DEFAULT
    const p = parsed as Record<string, unknown>
    return {
      url: asString(p.url, DEFAULT.url),
      transport: p.transport === 'sse' ? 'sse' : 'http',
      tab: TAB_IDS.includes(p.tab as TabId) ? (p.tab as TabId) : DEFAULT.tab,
      toolName: asNullableString(p.toolName),
      promptName: asNullableString(p.promptName),
      resourceKey: asNullableString(p.resourceKey),
      searchTools: asString(p.searchTools, ''),
      searchPrompts: asString(p.searchPrompts, ''),
      searchResources: asString(p.searchResources, ''),
    }
  } catch {
    return DEFAULT
  }
}

function create() {
  const initial = load()
  const url = ref(initial.url)
  const transport = ref<TransportKind>(initial.transport)
  const tab = ref<TabId>(initial.tab)
  const toolName = ref<string | null>(initial.toolName)
  const promptName = ref<string | null>(initial.promptName)
  const resourceKey = ref<string | null>(initial.resourceKey)
  const searchTools = ref(initial.searchTools)
  const searchPrompts = ref(initial.searchPrompts)
  const searchResources = ref(initial.searchResources)

  function persist() {
    if (typeof window === 'undefined') return
    try {
      const snapshot: Snapshot = {
        url: url.value,
        transport: transport.value,
        tab: tab.value,
        toolName: toolName.value,
        promptName: promptName.value,
        resourceKey: resourceKey.value,
        searchTools: searchTools.value,
        searchPrompts: searchPrompts.value,
        searchResources: searchResources.value,
      }
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
    } catch {
      // quota, private mode, disabled — silently skip
    }
  }

  watch(
    [url, transport, tab, toolName, promptName, resourceKey, searchTools, searchPrompts, searchResources],
    persist,
  )

  /**
   * Flag: the last selection happened through a click (Explorer list) rather
   * than a sessionStorage-restore on mount. Detail-Panes read this in their
   * onMounted-Hook to decide whether to scroll into view — we don't want the
   * page to jump when the user just refreshed or switched servers.
   */
  const userSelectedInteractively = ref(false)

  function consumeUserSelection(): boolean {
    if (!userSelectedInteractively.value) return false
    userSelectedInteractively.value = false
    return true
  }

  function markUserSelection() {
    userSelectedInteractively.value = true
  }

  function clearConnection() {
    url.value = ''
    toolName.value = null
    promptName.value = null
    resourceKey.value = null
    searchTools.value = ''
    searchPrompts.value = ''
    searchResources.value = ''
    // Drain any mark-user-selection flag that never got consumed (e.g. user
    // clicked a tool then disconnected before the detail pane mounted).
    userSelectedInteractively.value = false
  }

  /**
   * Reset session state when switching to a different MCP server. Keeps
   * url/transport (caller sets those), but clears the per-server selection
   * and search state and puts the UI back on the Tools tab. So artifacts
   * from the previous server don't bleed into the new connection.
   */
  function resetForNewServer() {
    tab.value = 'tools'
    toolName.value = null
    promptName.value = null
    resourceKey.value = null
    searchTools.value = ''
    searchPrompts.value = ''
    searchResources.value = ''
    // Flag drainen — ein möglicher "true" Rest aus dem vorherigen Server
    // würde sonst beim ersten Detail-Mount auf dem neuen Server scrollen.
    userSelectedInteractively.value = false
  }

  return {
    url,
    transport,
    tab,
    toolName,
    promptName,
    resourceKey,
    searchTools,
    searchPrompts,
    searchResources,
    clearConnection,
    resetForNewServer,
    markUserSelection,
    consumeUserSelection,
  }
}

let singleton: ReturnType<typeof create> | null = null

export function useSessionState() {
  if (!singleton) singleton = create()
  return singleton
}
