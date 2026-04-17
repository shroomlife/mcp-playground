import { ref, shallowRef, computed } from 'vue'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'

export type ConnectionState = 'idle' | 'connecting' | 'connected' | 'error'
export type TransportKind = 'http' | 'sse'

export interface ServerSummary {
  name: string
  version: string
  instructions?: string
  capabilities: Record<string, unknown>
}

export interface McpTool {
  name: string
  title?: string
  description?: string
  inputSchema?: unknown
  outputSchema?: unknown
}

export interface McpResource {
  uri: string
  name?: string
  title?: string
  description?: string
  mimeType?: string
}

export interface McpResourceTemplate {
  uriTemplate: string
  name?: string
  title?: string
  description?: string
  mimeType?: string
}

export interface McpPrompt {
  name: string
  title?: string
  description?: string
  arguments?: Array<{
    name: string
    description?: string
    required?: boolean
  }>
}

export interface LogEntry {
  id: number
  at: number
  level: 'info' | 'success' | 'warn' | 'error'
  message: string
}

const noop = () => {}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

export function useMcpInspector() {
  const state = ref<ConnectionState>('idle')
  const transportKind = ref<TransportKind>('http')
  const error = ref<string | null>(null)
  const url = ref('')
  const latencyMs = ref<number | null>(null)
  const connectedAt = ref<number | null>(null)

  const server = shallowRef<ServerSummary | null>(null)
  const tools = shallowRef<McpTool[]>([])
  const resources = shallowRef<McpResource[]>([])
  const resourceTemplates = shallowRef<McpResourceTemplate[]>([])
  const prompts = shallowRef<McpPrompt[]>([])
  const log = ref<LogEntry[]>([])

  const client = shallowRef<Client | null>(null)
  let logCounter = 0

  function pushLog(level: LogEntry['level'], message: string) {
    logCounter += 1
    log.value = [{ id: logCounter, at: Date.now(), level, message }, ...log.value].slice(0, 60)
  }

  function buildProxyUrl(target: string): URL {
    const trimmed = target.trim()
    if (!trimmed) throw new Error('URL ist leer')
    let parsed: URL
    try {
      parsed = new URL(trimmed)
    } catch {
      throw new Error('Ungültige URL — inklusive https:// eingeben')
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error(`Protokoll ${parsed.protocol} nicht erlaubt — nur http/https`)
    }
    const encoded = encodeURIComponent(trimmed)
    return new URL(`/api/mcp?url=${encoded}`, window.location.origin)
  }

  async function disconnect() {
    const c = client.value
    client.value = null
    state.value = 'idle'
    connectedAt.value = null
    latencyMs.value = null
    if (c) {
      c.onclose = noop
      c.onerror = noop
      try {
        await c.close()
      } catch (err) {
        pushLog('warn', `close() warf: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
  }

  async function connect(target: string, kind: TransportKind = 'http') {
    await disconnect()

    url.value = target
    transportKind.value = kind
    error.value = null
    state.value = 'connecting'
    server.value = null
    tools.value = []
    resources.value = []
    resourceTemplates.value = []
    prompts.value = []

    pushLog('info', `Verbinde über ${kind.toUpperCase()} …`)

    const started = performance.now()

    try {
      const proxyUrl = buildProxyUrl(target)
      const transport =
        kind === 'http'
          ? new StreamableHTTPClientTransport(proxyUrl)
          : new SSEClientTransport(proxyUrl)

      const c = new Client(
        { name: 'mcp-inspector', version: '0.1.0' },
        { capabilities: {} },
      )

      c.onerror = (err: Error) => {
        pushLog('error', `Client-Fehler: ${err.message}`)
      }
      c.onclose = () => {
        if (client.value !== c) return
        pushLog('warn', 'Verbindung geschlossen')
        state.value = 'idle'
        connectedAt.value = null
      }

      await c.connect(transport)

      latencyMs.value = Math.round(performance.now() - started)
      connectedAt.value = Date.now()
      client.value = c
      state.value = 'connected'

      const info = c.getServerVersion()
      const caps = c.getServerCapabilities() ?? {}
      server.value = {
        name: info?.name ?? 'unknown',
        version: info?.version ?? '0.0.0',
        instructions: c.getInstructions(),
        capabilities: caps as Record<string, unknown>,
      }
      pushLog('success', `Verbunden: ${server.value.name} v${server.value.version}`)

      await Promise.allSettled([
        loadTools(caps),
        loadResources(caps),
        loadResourceTemplates(caps),
        loadPrompts(caps),
      ])
    } catch (err) {
      state.value = 'error'
      const msg = err instanceof Error ? err.message : String(err)
      error.value = msg
      pushLog('error', `Verbindung fehlgeschlagen: ${msg}`)
      await disconnect().catch(noop)
    }
  }

  async function loadTools(caps: Record<string, unknown>) {
    if (!caps.tools || !client.value) return
    try {
      const res = await client.value.listTools()
      tools.value = asArray<McpTool>(res.tools)
      pushLog('info', `${tools.value.length} Tool(s) geladen`)
    } catch (err) {
      pushLog('warn', `tools/list fehlgeschlagen: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  async function loadResources(caps: Record<string, unknown>) {
    if (!caps.resources || !client.value) return
    try {
      const res = await client.value.listResources()
      resources.value = asArray<McpResource>(res.resources)
      pushLog('info', `${resources.value.length} Resource(s) geladen`)
    } catch (err) {
      pushLog('warn', `resources/list fehlgeschlagen: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  async function loadResourceTemplates(caps: Record<string, unknown>) {
    if (!caps.resources || !client.value) return
    try {
      const res = await client.value.listResourceTemplates()
      resourceTemplates.value = asArray<McpResourceTemplate>(res.resourceTemplates)
    } catch {
      // optional — viele Server unterstützen keine Templates
    }
  }

  async function loadPrompts(caps: Record<string, unknown>) {
    if (!caps.prompts || !client.value) return
    try {
      const res = await client.value.listPrompts()
      prompts.value = asArray<McpPrompt>(res.prompts)
      pushLog('info', `${prompts.value.length} Prompt(s) geladen`)
    } catch (err) {
      pushLog('warn', `prompts/list fehlgeschlagen: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const capabilityList = computed(() => {
    const caps = server.value?.capabilities ?? {}
    return Object.keys(caps).filter((key) => caps[key] !== undefined && caps[key] !== null)
  })

  const counts = computed(() => ({
    tools: tools.value.length,
    resources: resources.value.length + resourceTemplates.value.length,
    prompts: prompts.value.length,
  }))

  return {
    state,
    transportKind,
    error,
    url,
    latencyMs,
    connectedAt,
    server,
    tools,
    resources,
    resourceTemplates,
    prompts,
    log,
    capabilityList,
    counts,
    connect,
    disconnect,
  }
}
