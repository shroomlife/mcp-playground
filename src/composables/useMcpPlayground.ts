import { ref, shallowRef, computed } from 'vue'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import { UnauthorizedError, auth as sdkAuth } from '@modelcontextprotocol/sdk/client/auth.js'
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import {
  ElicitRequestSchema,
  LoggingMessageNotificationSchema,
  ToolListChangedNotificationSchema,
  ResourceListChangedNotificationSchema,
  PromptListChangedNotificationSchema,
  type Progress,
} from '@modelcontextprotocol/sdk/types.js'
import { createOAuthProvider, createProxyFetch, hasOAuthTokens } from './useOAuth'
import { elicit } from './useElicitation'

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

export type LogSource = 'client' | 'server'
export type LogLevel = 'debug' | 'info' | 'success' | 'notice' | 'warn' | 'error' | 'critical'

export interface LogEntry {
  id: number
  at: number
  level: LogLevel
  message: string
  source: LogSource
  logger?: string
}

export interface CallOptions {
  signal?: AbortSignal
  onProgress?: (progress: Progress) => void
}

export type TraceDirection = 'outgoing' | 'incoming'
export type TraceKind = 'request' | 'response' | 'notification' | 'error'

export interface TraceEntry {
  id: number
  at: number
  direction: TraceDirection
  kind: TraceKind
  /** JSON-RPC id, when the message had one (requests + responses). */
  rpcId?: string | number
  /** `tools/call`, `notifications/message`, etc. Unknown for responses (paired by rpcId). */
  method?: string
  params?: unknown
  result?: unknown
  error?: unknown
  sizeBytes: number
}

export interface AuthHeader {
  key: string
  value: string
}

export type CallKind = 'tool' | 'resource' | 'prompt'

export interface CallHistoryEntry {
  id: number
  at: number
  kind: CallKind
  name: string
  args?: Record<string, unknown>
  durationMs: number
  success: boolean
  result?: unknown
  error?: string
}

export interface ToolCallResult {
  content?: Array<Record<string, unknown>>
  structuredContent?: Record<string, unknown>
  isError?: boolean
  _meta?: Record<string, unknown>
}

export interface ResourceReadResult {
  contents: Array<{
    uri: string
    mimeType?: string
    text?: string
    blob?: string
  }>
}

export interface PromptGetResult {
  description?: string
  messages: Array<{
    role: 'user' | 'assistant'
    content: Record<string, unknown>
  }>
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
  CONNECT_TIMEOUT: {
    title: 'Connect-Timeout',
    hint: 'Der Upstream-Server hat 30 Sekunden lang keine Response-Header gesendet. Server langsam, blockiert oder offline?',
  },
  CONNECTION_LOST: {
    title: 'Verbindung verloren',
    hint: 'Der Server hat die Verbindung unerwartet geschlossen. "Erneut versuchen" startet einen neuen Handshake.',
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

// MCP uses RFC 5424 syslog levels; collapse into our simpler UI levels.
function mapServerLogLevel(level: string): LogLevel {
  switch (level) {
    case 'debug':
      return 'debug'
    case 'info':
      return 'info'
    case 'notice':
      return 'notice'
    case 'warning':
      return 'warn'
    case 'error':
      return 'error'
    case 'critical':
    case 'alert':
    case 'emergency':
      return 'critical'
    default:
      return 'info'
  }
}

function utf8ToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str)
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i] as number)
  }
  return btoa(binary)
}

export function headersToRecord(headers: AuthHeader[]): Record<string, string> {
  const record: Record<string, string> = {}
  for (const h of headers) {
    const k = h.key.trim()
    const v = h.value
    if (k && v) record[k] = v
  }
  return record
}

export function hasActiveAuth(headers: AuthHeader[]): boolean {
  return Object.keys(headersToRecord(headers)).length > 0
}

function buildForwardHeader(authHeaders: AuthHeader[] | undefined): Record<string, string> | null {
  if (!authHeaders || authHeaders.length === 0) return null
  const record = headersToRecord(authHeaders)
  if (Object.keys(record).length === 0) return null
  return { 'x-mcp-forward-headers': utf8ToBase64(JSON.stringify(record)) }
}

export function useMcpPlayground() {
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
  const callHistory = shallowRef<CallHistoryEntry[]>([])
  const activeAuthHeaders = shallowRef<AuthHeader[]>([])
  const traceEntries = shallowRef<TraceEntry[]>([])

  const client = shallowRef<Client | null>(null)
  let logCounter = 0
  let historyCounter = 0
  let traceCounter = 0

  const HISTORY_LIMIT = 50
  const TRACE_LIMIT = 300

  function pushTrace(entry: Omit<TraceEntry, 'id'>): void {
    traceCounter += 1
    traceEntries.value = [
      { id: traceCounter, ...entry },
      ...traceEntries.value,
    ].slice(0, TRACE_LIMIT)
  }

  function byteSize(value: unknown): number {
    try {
      return new TextEncoder().encode(JSON.stringify(value)).length
    } catch {
      return 0
    }
  }

  /** Wrap a transport so every inbound+outbound JSON-RPC message is captured in `traceEntries`. */
  function attachTraceCapture(transport: Transport): void {
    const originalSend = transport.send.bind(transport)
    transport.send = async (message, options) => {
      const msg = message as Record<string, unknown>
      const rpcId = msg.id as string | number | undefined
      const method = msg.method as string | undefined
      if (method) {
        pushTrace({
          at: Date.now(),
          direction: 'outgoing',
          kind: rpcId !== undefined ? 'request' : 'notification',
          rpcId,
          method,
          params: msg.params,
          sizeBytes: byteSize(message),
        })
      }
      return originalSend(message, options)
    }

    const originalOnMessage = transport.onmessage
    transport.onmessage = (message, extra) => {
      const msg = message as Record<string, unknown>
      const rpcId = msg.id as string | number | undefined
      const method = msg.method as string | undefined
      if (method && rpcId === undefined) {
        pushTrace({
          at: Date.now(),
          direction: 'incoming',
          kind: 'notification',
          method,
          params: msg.params,
          sizeBytes: byteSize(message),
        })
      } else if (rpcId !== undefined) {
        if ('result' in msg || 'error' in msg) {
          pushTrace({
            at: Date.now(),
            direction: 'incoming',
            kind: msg.error !== undefined ? 'error' : 'response',
            rpcId,
            result: msg.result,
            error: msg.error,
            sizeBytes: byteSize(message),
          })
        } else if (method) {
          // Server-initiated request (elicitation, sampling, …)
          pushTrace({
            at: Date.now(),
            direction: 'incoming',
            kind: 'request',
            rpcId,
            method,
            params: msg.params,
            sizeBytes: byteSize(message),
          })
        }
      }
      originalOnMessage?.(message, extra)
    }
  }

  function pushHistory(entry: Omit<CallHistoryEntry, 'id'>): CallHistoryEntry {
    historyCounter += 1
    const full: CallHistoryEntry = { id: historyCounter, ...entry }
    callHistory.value = [full, ...callHistory.value].slice(0, HISTORY_LIMIT)
    return full
  }

  function pushLog(
    level: LogLevel,
    message: string,
    extra: { source?: LogSource; logger?: string } = {},
  ) {
    logCounter += 1
    log.value = [
      {
        id: logCounter,
        at: Date.now(),
        level,
        message,
        source: extra.source ?? 'client',
        logger: extra.logger,
      },
      ...log.value,
    ].slice(0, 120)
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
    // In dev the transport URL is our proxy (SSRF-hardened CORS breaker). In production
    // static-hosted builds there is no proxy — the browser talks to the MCP server
    // directly, subject to whatever CORS the server allows.
    if (!import.meta.env.DEV) return parsed
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

  async function connect(
    target: string,
    kind: TransportKind = 'http',
    authHeaders: AuthHeader[] = [],
    authorizationCode?: string,
  ) {
    await disconnect()

    url.value = target
    transportKind.value = kind
    activeAuthHeaders.value = authHeaders
    error.value = null
    errorDetails.value = null
    state.value = 'connecting'
    server.value = null
    tools.value = []
    resources.value = []
    resourceTemplates.value = []
    prompts.value = []
    callHistory.value = []

    pushLog('info', `Verbinde über ${kind.toUpperCase()} …`)

    const started = performance.now()

    try {
      const proxyUrl = buildProxyUrl(target)
      const oauthProvider = createOAuthProvider(target, kind)
      // Manual auth headers still ride the same sidechannel as the OAuth token —
      // createProxyFetch merges them together per request so the proxy's SSRF strip
      // never loses them.
      const manualForward = headersToRecord(authHeaders)
      const proxyFetch = createProxyFetch(manualForward)
      const transport =
        kind === 'http'
          ? new StreamableHTTPClientTransport(proxyUrl, {
              authProvider: oauthProvider,
              fetch: proxyFetch,
            })
          : new SSEClientTransport(proxyUrl, {
              authProvider: oauthProvider,
              fetch: proxyFetch,
            })

      // If we're returning from the OAuth redirect, first exchange the code for tokens;
      // only then does client.connect() see a valid access token.
      if (authorizationCode) {
        await transport.finishAuth(authorizationCode)
        pushLog('success', 'OAuth abgeschlossen — Tokens gespeichert')
      }

      // Start with an empty trace per connection, then wire the capture hook.
      traceEntries.value = []
      attachTraceCapture(transport)

      const c = new Client(
        { name: 'mcp-playground', version: '0.1.0' },
        { capabilities: {} },
      )

      c.onerror = (err: Error) => {
        pushLog('error', `Client-Fehler: ${err.message}`)
      }

      // Server-sent log messages (notifications/message) — stream them into the shared log
      // with source='server' so the UI can distinguish.
      c.setNotificationHandler(LoggingMessageNotificationSchema, (notification) => {
        if (client.value !== c) return
        const p = notification.params
        const level = mapServerLogLevel(p.level)
        const message =
          typeof p.data === 'string'
            ? p.data
            : (() => {
                try {
                  return JSON.stringify(p.data)
                } catch {
                  return String(p.data)
                }
              })()
        pushLog(level, message, { source: 'server', logger: p.logger })
      })

      // Elicitation: the server asks the user for input mid-operation. We open
      // a dialog via the useElicitation composable and await the user's choice.
      c.setRequestHandler(ElicitRequestSchema, async (request) => {
        if (client.value !== c) return { action: 'cancel' }
        const p = request.params as {
          mode?: 'form' | 'url'
          message: string
          requestedSchema?: { type: 'object'; properties: Record<string, unknown>; required?: string[] }
          url?: string
          elicitationId?: string
        }
        pushLog('notice', `Elicitation: ${p.message}`, { source: 'server' })
        const result = await elicit({
          mode: p.mode,
          message: p.message,
          requestedSchema: p.requestedSchema,
          url: p.url,
          elicitationId: p.elicitationId,
        })
        return result as { action: 'accept' | 'decline' | 'cancel'; content?: Record<string, unknown> }
      })

      // List-changed: auto-refresh the relevant list.
      c.setNotificationHandler(ToolListChangedNotificationSchema, () => {
        if (client.value !== c) return
        void loadTools(c.getServerCapabilities() ?? {})
      })
      c.setNotificationHandler(ResourceListChangedNotificationSchema, () => {
        if (client.value !== c) return
        const caps = c.getServerCapabilities() ?? {}
        void loadResources(caps)
        void loadResourceTemplates(caps)
      })
      c.setNotificationHandler(PromptListChangedNotificationSchema, () => {
        if (client.value !== c) return
        void loadPrompts(c.getServerCapabilities() ?? {})
      })
      // User-initiated disconnects strip this handler via cleanupClient() before closing,
      // so if this fires, it means the server (or transport) closed spontaneously.
      c.onclose = () => {
        if (client.value !== c) return
        pushLog('warn', 'Verbindung vom Server geschlossen')
        client.value = null
        connectedAt.value = null
        state.value = 'error'
        errorDetails.value = {
          title: 'Verbindung verloren',
          code: 'CONNECTION_LOST',
          summary: 'Der Server hat die Verbindung unerwartet geschlossen.',
          hint:
            'Möglich: Server-Crash, Session-Timeout, Netzwerk-Abbruch oder der Server ' +
            'hat die SSE-Session beendet. "Erneut verbinden" versucht einen neuen Handshake.',
          raw: 'transport onclose',
          target: url.value,
          transport: transportKind.value,
          suggestOtherTransport: false,
        }
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
      // UnauthorizedError means the SDK is either redirecting to the OAuth provider
      // (browser is navigating away — we rarely reach this catch) or discovery/DCR
      // failed before a redirect could happen. Surface it as a distinct OAuth state.
      if (err instanceof UnauthorizedError) {
        pushLog('warn', 'OAuth-Authentifizierung erforderlich')
        await cleanupClient().catch(noop)
        errorDetails.value = {
          title: 'Authentifizierung erforderlich',
          code: 'OAUTH_REQUIRED',
          summary: 'Der Server verlangt OAuth-Authentifizierung.',
          hint:
            hasOAuthTokens(target)
              ? 'Deine gespeicherten Tokens wurden vom Server abgelehnt. Erneut anmelden.'
              : 'Dieser Server erfordert OAuth. Du wirst zum Provider weitergeleitet, um dich anzumelden.',
          raw: err.message,
          target,
          transport: kind,
          suggestOtherTransport: false,
        }
        error.value = 'OAuth erforderlich'
        state.value = 'error'
        return
      }
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

    const probe = await probeProxy(target, activeAuthHeaders.value)

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

  async function probeProxy(
    target: string,
    authHeaders: AuthHeader[] = [],
  ): Promise<ProbeResult> {
    try {
      // Dev: probe via proxy so errors carry our JSON envelope. Prod: direct hit —
      // the probe is best-effort classification, not a security boundary.
      const probeUrl = import.meta.env.DEV
        ? new URL(
            `/api/mcp?url=${encodeURIComponent(target)}`,
            window.location.origin,
          ).toString()
        : target
      const headers: Record<string, string> = {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      }
      const forward = buildForwardHeader(authHeaders)
      if (forward && import.meta.env.DEV) Object.assign(headers, forward)
      const res = await fetch(probeUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'probe',
          method: 'initialize',
          params: {
            protocolVersion: '2025-06-18',
            capabilities: {},
            clientInfo: { name: 'mcp-playground-probe', version: '0.1.0' },
          },
        }),
      })

      if (res.status === 502 || res.status === 504 || res.status === 400 || res.status === 403) {
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

  function wasAborted(err: unknown): boolean {
    if (err instanceof DOMException && err.name === 'AbortError') return true
    if (err instanceof Error && /abort/i.test(err.message)) return true
    return false
  }

  async function callTool(
    name: string,
    args: Record<string, unknown>,
    options: CallOptions = {},
  ): Promise<CallHistoryEntry> {
    if (!client.value) {
      throw new Error('Nicht verbunden')
    }
    const started = performance.now()
    const at = Date.now()
    try {
      const result = (await client.value.callTool(
        { name, arguments: args },
        undefined,
        { signal: options.signal, onprogress: options.onProgress },
      )) as ToolCallResult
      const durationMs = Math.round(performance.now() - started)
      const isError = result.isError === true
      const entry = pushHistory({
        at,
        kind: 'tool',
        name,
        args,
        durationMs,
        success: !isError,
        result,
        error: isError ? 'Tool signalisierte isError=true' : undefined,
      })
      pushLog(isError ? 'warn' : 'success', `tool/${name} (${durationMs} ms)`)
      return entry
    } catch (err) {
      const durationMs = Math.round(performance.now() - started)
      const aborted = wasAborted(err)
      const message = aborted
        ? 'Abgebrochen'
        : err instanceof Error ? err.message : String(err)
      const entry = pushHistory({
        at,
        kind: 'tool',
        name,
        args,
        durationMs,
        success: false,
        error: message,
      })
      pushLog(aborted ? 'warn' : 'error', `tool/${name} ${aborted ? 'abgebrochen' : 'fehlgeschlagen'}: ${message}`)
      return entry
    }
  }

  async function readResource(
    uri: string,
    options: CallOptions = {},
  ): Promise<CallHistoryEntry> {
    if (!client.value) {
      throw new Error('Nicht verbunden')
    }
    const started = performance.now()
    const at = Date.now()
    try {
      const result = (await client.value.readResource(
        { uri },
        { signal: options.signal, onprogress: options.onProgress },
      )) as ResourceReadResult
      const durationMs = Math.round(performance.now() - started)
      const entry = pushHistory({
        at,
        kind: 'resource',
        name: uri,
        durationMs,
        success: true,
        result,
      })
      pushLog('success', `resource/${uri} (${durationMs} ms)`)
      return entry
    } catch (err) {
      const durationMs = Math.round(performance.now() - started)
      const aborted = wasAborted(err)
      const message = aborted
        ? 'Abgebrochen'
        : err instanceof Error ? err.message : String(err)
      const entry = pushHistory({
        at,
        kind: 'resource',
        name: uri,
        durationMs,
        success: false,
        error: message,
      })
      pushLog(aborted ? 'warn' : 'error', `resource/${uri} ${aborted ? 'abgebrochen' : 'fehlgeschlagen'}: ${message}`)
      return entry
    }
  }

  async function getPrompt(
    name: string,
    args: Record<string, string> = {},
    options: CallOptions = {},
  ): Promise<CallHistoryEntry> {
    if (!client.value) {
      throw new Error('Nicht verbunden')
    }
    const started = performance.now()
    const at = Date.now()
    try {
      const result = (await client.value.getPrompt(
        { name, arguments: args },
        { signal: options.signal, onprogress: options.onProgress },
      )) as PromptGetResult
      const durationMs = Math.round(performance.now() - started)
      const entry = pushHistory({
        at,
        kind: 'prompt',
        name,
        args,
        durationMs,
        success: true,
        result,
      })
      pushLog('success', `prompt/${name} (${durationMs} ms)`)
      return entry
    } catch (err) {
      const durationMs = Math.round(performance.now() - started)
      const aborted = wasAborted(err)
      const message = aborted
        ? 'Abgebrochen'
        : err instanceof Error ? err.message : String(err)
      const entry = pushHistory({
        at,
        kind: 'prompt',
        name,
        args,
        durationMs,
        success: false,
        error: message,
      })
      pushLog(aborted ? 'warn' : 'error', `prompt/${name} ${aborted ? 'abgebrochen' : 'fehlgeschlagen'}: ${message}`)
      return entry
    }
  }

  function toolHistory(toolName: string): CallHistoryEntry[] {
    return callHistory.value.filter(
      (entry) => entry.kind === 'tool' && entry.name === toolName,
    )
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
    await connect(url.value, next, activeAuthHeaders.value)
  }

  /**
   * Explicitly begin the OAuth flow for a target MCP URL. The SDK does discovery + DCR +
   * builds the authorization URL and then invokes `provider.redirectToAuthorization` —
   * which navigates the browser to the provider. On return, `consumePendingCallback` picks
   * up the code and `connect()` with `authorizationCode` finishes the token exchange.
   *
   * Errors are **propagated** (not swallowed into the global `state = 'error'`) so the
   * caller component — typically `AuthConfigPanel` — can render them inline without
   * disrupting the surrounding Connected or Landing view.
   */
  async function beginOAuth(target: string, kind: TransportKind = 'http'): Promise<void> {
    if (!target.trim()) return
    pushLog('info', 'OAuth-Flow wird gestartet — Discovery läuft …')
    let didRedirect = false
    const provider = createOAuthProvider(target, kind, () => {
      didRedirect = true
    })
    const fetchFn = createProxyFetch({})
    try {
      const result = await sdkAuth(provider, { serverUrl: target, fetchFn })
      if (result === 'AUTHORIZED') {
        // Unlikely without an authorization code, but handle defensively: retry connect.
        pushLog('success', 'OAuth ohne Redirect abgeschlossen')
        await connect(target, kind, activeAuthHeaders.value)
        return
      }
      // result === 'REDIRECT'. The SDK should have invoked provider.redirectToAuthorization
      // (= browser is navigating away, we usually don't even reach this point). If we do
      // get here AND didRedirect is false, the SDK completed without actually redirecting —
      // that happens when OAuth metadata is partial / missing on the server. Surface it
      // as a real error instead of leaving the user wondering why "nothing happened".
      if (!didRedirect) {
        throw new Error(
          'Der Server lieferte keine vollständigen OAuth-Metadaten. ' +
            'Dieser MCP-Server unterstützt vermutlich keine Browser-Authentifizierung.',
        )
      }
      pushLog('info', 'Weiterleitung zum Authentifizierungs-Provider …')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      pushLog('error', `OAuth-Start fehlgeschlagen: ${msg}`)
      throw err instanceof Error ? err : new Error(msg)
    }
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
    callHistory,
    activeAuthHeaders,
    capabilityList,
    counts,
    connect,
    disconnect,
    retryWithOtherTransport,
    beginOAuth,
    callTool,
    readResource,
    getPrompt,
    toolHistory,
    traceEntries,
  }
}
