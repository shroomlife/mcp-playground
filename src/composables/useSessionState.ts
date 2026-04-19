import { ref, watch } from 'vue'
import type { TransportKind } from './useMcpPlayground'

const STORAGE_KEY = 'mcp-playground:session'

export type TabId = 'tools' | 'resources' | 'prompts' | 'log'
const TAB_IDS: readonly TabId[] = ['tools', 'resources', 'prompts', 'log']

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

  function clearConnection() {
    url.value = ''
    toolName.value = null
    promptName.value = null
    resourceKey.value = null
    searchTools.value = ''
    searchPrompts.value = ''
    searchResources.value = ''
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
  }
}

let singleton: ReturnType<typeof create> | null = null

export function useSessionState() {
  if (!singleton) singleton = create()
  return singleton
}
