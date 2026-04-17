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

export interface ErrorDetails {
  title: string
  code: string
  summary: string
  hint: string
  raw: string
  target: string
  transport: TransportKind
  suggestOtherTransport: boolean
}

const ERROR_HINTS: Record<string, { title: string; hint: string }> = {
  ENOTFOUND: {
    title: 'Hostname nicht gefunden',
    hint: 'Der Domainname konnte per DNS nicht aufgelöst werden. Tippfehler? Host wirklich online?',
  },
  ECONNREFUSED: {
    title: 'Verbindung abgewiesen',
    hint: 'Der Host ist erreichbar, aber nichts hört auf dem Port. Läuft der Server? Stimmt der Port?',
  },
  ETIMEDOUT: {
    title: 'Timeout beim Verbinden',
    hint: 'Der Server hat nicht rechtzeitig geantwortet. Firewall? Falsches Netz? Server überlastet?',
  },
  UND_ERR_CONNECT_TIMEOUT: {
    title: 'Connect-Timeout',
    hint: 'TCP-Connect hat zu lange gebraucht. Host erreichbar, aber antwortet nicht.',
  },
  UND_ERR_HEADERS_TIMEOUT: {
    title: 'Header-Timeout',
    hint: 'Verbindung steht, aber der Server schickt keine Response-Header.',
  },
  UND_ERR_SOCKET: {
    title: 'Socket-Fehler',
    hint: 'Die Verbindung wurde während des Requests unterbrochen.',
  },
  ECONNRESET: {
    title: 'Verbindung unterbrochen',
    hint: 'Der Server hat die Verbindung abgebrochen (RST). Netzwerkproblem oder Server-Crash.',
  },
  EHOSTUNREACH: {
    title: 'Host nicht erreichbar',
    hint: 'Keine Route zum Host. VPN/Netz prüfen.',
  },
  ENETUNREACH: {
    title: 'Netzwerk nicht erreichbar',
    hint: 'Lokales Netz hat keine Route. Offline?',
  },
  EPIPE: {
    title: 'Pipe geschlossen',
    hint: 'Die Verbindung wurde während des Sendens geschlossen.',
  },
  CERT_HAS_EXPIRED: {
    title: 'TLS-Zertifikat abgelaufen',
    hint: 'Der Server präsentiert ein abgelaufenes Zertifikat.',
  },
  UNABLE_TO_VERIFY_LEAF_SIGNATURE: {
    title: 'TLS-Zertifikat nicht verifizierbar',
    hint: 'Zertifikatskette kann nicht validiert werden.',
  },
  SELF_SIGNED_CERT_IN_CHAIN: {
    title: 'Selbst-signiertes Zertifikat',
    hint: 'Der Server nutzt ein selbst-signiertes Zertifikat. Für Produktion nicht akzeptabel.',
  },
  DEPTH_ZERO_SELF_SIGNED_CERT: {
    title: 'Selbst-signiertes Zertifikat',
    hint: 'Der Server nutzt ein selbst-signiertes Zertifikat.',
  },
  ERR_TLS_CERT_ALTNAME_INVALID: {
    title: 'TLS-Hostname stimmt nicht',
    hint: 'Das Zertifikat passt nicht zum angefragten Hostnamen.',
  },
  INVALID_PROTOCOL: {
    title: 'Ungültiges Protokoll',
    hint: 'Nur http:// und https:// werden unterstützt.',
  },
  HOST_BLOCKED: {
    title: 'Host blockiert',
    hint: 'Dieser Host ist aus Sicherheitsgründen (SSRF-Schutz) nicht erreichbar.',
  },
}

const HTTP_HINTS: Record<number, string> = {
  400: 'Der Server akzeptiert die Anfrage nicht. Vielleicht erwartet er andere Headers oder einen anderen Body.',
  401: 'Authentifizierung erforderlich — dieser MCP-Server erwartet ein Token oder Credentials.',
  403: 'Zugriff verweigert — evtl. fehlt ein Token oder die IP ist nicht freigegeben.',
  404: 'Endpoint nicht gefunden. URL prüfen oder den anderen Transport (HTTP ↔ SSE) versuchen.',
  405: 'Methode nicht erlaubt. Vielleicht der falsche Transport-Typ?',
  415: 'Unsupported Media Type — der Endpoint erwartet einen anderen Content-Type.',
  429: 'Zu viele Requests — Rate-Limit erreicht.',
  500: 'Interner Server-Fehler beim MCP-Server.',
  502: 'Bad Gateway vom Ziel-Server.',
  503: 'Service nicht verfügbar.',
  504: 'Gateway-Timeout.',
}

const noop = () => {}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

export function useMcpInspector() {
  const state = ref<ConnectionState>('idle')
  const transportKind = ref<TransportKind>('http')
  const error = ref<string | null>(null)
  const errorDetails = ref<ErrorDetails | null>(null)
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

  async function cleanupClient() {
    const c = client.value
    client.value = null
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

  async function disconnect() {
    await cleanupClient()
    state.value = 'idle'
    connectedAt.value = null
    latencyMs.value = null
    error.value = null
    errorDetails.value = null
  }

  async function connect(target: string, kind: TransportKind = 'http') {
    await disconnect()

    url.value = target
    transportKind.value = kind
    error.value = null
    errorDetails.value = null
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
      const msg = err instanceof Error ? err.message : String(err)
      error.value = msg
      pushLog('error', `Verbindung fehlgeschlagen: ${msg}`)
      await cleanupClient().catch(noop)
      const details = await classifyConnectError(target, kind, msg)
      errorDetails.value = details
      state.value = 'error'
    }
  }

  async function classifyConnectError(
    target: string,
    transport: TransportKind,
    rawMessage: string,
  ): Promise<ErrorDetails> {
    // Client-side validation errors have clear messages — no probe needed.
    if (
      rawMessage.includes('URL ist leer') ||
      rawMessage.includes('Ungültige URL') ||
      rawMessage.includes('Protokoll')
    ) {
      return {
        title: 'Ungültige URL',
        code: 'CLIENT_VALIDATION',
        summary: rawMessage,
        hint: 'URL muss mit http:// oder https:// beginnen und vollständig sein.',
        raw: rawMessage,
        target,
        transport,
        suggestOtherTransport: false,
      }
    }

    const probe = await probeProxy(target)

    if (probe.kind === 'proxy_error') {
      const mapped = ERROR_HINTS[probe.code] ?? {
        title: 'Verbindung fehlgeschlagen',
        hint: 'Der Server ist nicht erreichbar. Netzwerk, Host und Port prüfen.',
      }
      return {
        title: mapped.title,
        code: probe.code,
        summary: probe.message,
        hint: mapped.hint,
        raw: rawMessage,
        target,
        transport,
        suggestOtherTransport: false,
      }
    }

    if (probe.kind === 'http_error') {
      return {
        title: `HTTP ${probe.status}`,
        code: `HTTP_${probe.status}`,
        summary: probe.statusText || `Der Server antwortet mit Status ${probe.status}`,
        hint:
          HTTP_HINTS[probe.status] ??
          'Der Server antwortet, aber nicht erwartungsgemäß. URL und Transport prüfen.',
        raw: rawMessage,
        target,
        transport,
        suggestOtherTransport: probe.status === 404 || probe.status === 405,
      }
    }

    if (probe.kind === 'reachable_not_mcp') {
      return {
        title: 'Kein gültiger MCP-Endpoint',
        code: 'NOT_MCP',
        summary:
          'Der Server antwortet, aber spricht kein MCP-Protokoll (oder nicht über diesen Transport).',
        hint: `Versuch es mit dem anderen Transport (${
          transport === 'http' ? 'SSE' : 'HTTP'
        }). Manche Server nutzen /sse statt /mcp.`,
        raw: rawMessage,
        target,
        transport,
        suggestOtherTransport: true,
      }
    }

    return {
      title: 'MCP-Handshake fehlgeschlagen',
      code: 'MCP_ERROR',
      summary: rawMessage,
      hint: 'Der Server ist erreichbar, aber der Handshake lief nicht durch. Details unten.',
      raw: rawMessage,
      target,
      transport,
      suggestOtherTransport: true,
    }
  }

  type ProbeResult =
    | { kind: 'proxy_error'; code: string; message: string }
    | { kind: 'http_error'; status: number; statusText: string }
    | { kind: 'reachable_not_mcp' }
    | { kind: 'ok' }
    | { kind: 'unknown' }

  async function probeProxy(target: string): Promise<ProbeResult> {
    try {
      const probeUrl = new URL(
        `/api/mcp?url=${encodeURIComponent(target)}`,
        window.location.origin,
      ).toString()
      const res = await fetch(probeUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'probe',
          method: 'initialize',
          params: {
            protocolVersion: '2025-06-18',
            capabilities: {},
            clientInfo: { name: 'mcp-inspector-probe', version: '0.1.0' },
          },
        }),
      })

      if (res.status === 502 || res.status === 400 || res.status === 403) {
        try {
          const body = (await res.json()) as { code?: string; message?: string }
          return {
            kind: 'proxy_error',
            code: body.code ?? 'UNKNOWN',
            message: body.message ?? 'Unbekannter Proxy-Fehler',
          }
        } catch {
          return { kind: 'unknown' }
        }
      }

      if (!res.ok) {
        return { kind: 'http_error', status: res.status, statusText: res.statusText }
      }

      return { kind: 'reachable_not_mcp' }
    } catch {
      return { kind: 'unknown' }
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

  async function retryWithOtherTransport() {
    if (!url.value) return
    const next: TransportKind = transportKind.value === 'http' ? 'sse' : 'http'
    await connect(url.value, next)
  }

  return {
    state,
    transportKind,
    error,
    errorDetails,
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
    retryWithOtherTransport,
  }
}
