/**
 * Best-effort "what's on the other side?" probe before the user hits Connect.
 *
 * Strategy: ein leichtgewichtiger `initialize`-Handshake via Proxy. Das vorherige
 * `.well-known/mcp-server-card`-Feature (MCP spec 2.1 draft) wurde entfernt, weil
 * kaum ein produktiver Server es implementiert — der 404-Load-Error schnallte die
 * DevTools-Console unnötig. `initialize` liefert alles, was die Preview-Card
 * braucht (name, version, instructions, capability-Keys).
 */
import type { FetchLike } from '@modelcontextprotocol/sdk/shared/transport.js'
import { createProxyFetch } from './useOAuth'

export type AuthMode = 'none' | 'oauth' | 'unknown'

export interface ServerPreview {
  name?: string
  version?: string
  description?: string
  instructions?: string
  toolCount?: number
  resourceCount?: number
  promptCount?: number
  authMode: AuthMode
  /** Whatever source we got the info from — for hover/debug display. */
  source: 'initialize'
}

function asString(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined
}

async function probeInitialize(mcpUrl: string, fetchFn: FetchLike, signal?: AbortSignal): Promise<ServerPreview | null> {
  try {
    const res = await fetchFn(mcpUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'preview',
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'mcp-playground-preview', version: '0.2.0' },
        },
      }),
      signal,
    })
    const wwwAuth = res.headers.get('WWW-Authenticate') ?? ''
    const needsOAuth = res.status === 401 && /Bearer/i.test(wwwAuth)
    if (needsOAuth) {
      return {
        authMode: 'oauth',
        source: 'initialize',
      }
    }
    if (!res.ok) return null
    // Streaming / SSE responses may not be pure JSON — read once and try to parse. If
    // it's a multi-line SSE stream, grab the first `data:` payload.
    const text = await res.text()
    let jsonPayload: string = text
    if (text.startsWith('event:') || text.includes('\ndata:')) {
      const dataLine = text.split(/\r?\n/).find((l) => l.startsWith('data:'))
      if (dataLine) jsonPayload = dataLine.slice(5).trim()
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(jsonPayload)
    } catch {
      return null
    }
    if (!parsed || typeof parsed !== 'object') return null
    const p = parsed as Record<string, unknown>
    const result = (p.result as Record<string, unknown> | undefined) ?? {}
    const serverInfo = (result.serverInfo as Record<string, unknown> | undefined) ?? {}
    const authMode: AuthMode = 'none'
    return {
      name: asString(serverInfo.name),
      version: asString(serverInfo.version),
      instructions: asString(result.instructions),
      // Capability-Keys sagen nur: "Feature existiert". Die echte Anzahl
      // kennen wir erst nach `tools/list` — also `undefined` lassen, damit
      // der Preview-Card kein falsches "0 Tools" für einen Server mit 50
      // Tools anzeigt.
      toolCount: undefined,
      resourceCount: undefined,
      promptCount: undefined,
      authMode,
      source: 'initialize',
    }
  } catch {
    return null
  }
}

export async function previewServer(
  mcpUrl: string,
  signal?: AbortSignal,
): Promise<ServerPreview | null> {
  const trimmed = mcpUrl.trim()
  if (!trimmed) return null
  try {
    new URL(trimmed)
  } catch {
    return null
  }
  const fetchFn = createProxyFetch({})
  return probeInitialize(trimmed, fetchFn, signal)
}
