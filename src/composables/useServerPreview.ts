/**
 * Best-effort "what's on the other side?" probe before the user hits Connect.
 *
 * Two strategies combined:
 *   1. **MCP Server Card** (`<origin>/.well-known/mcp-server-card`) — added in MCP
 *      spec 2.1 (2025-11). Returns a structured JSON document with name, description,
 *      capabilities, auth method, etc. without a live handshake.
 *   2. **Lightweight MCP initialize** through the proxy — falls back here if the Server
 *      Card endpoint 404s. We issue a real `initialize` JSON-RPC request, read the
 *      server info from the result, then drop the connection immediately.
 *
 * Result is deliberately loose-typed — different servers expose different shapes and
 * we don't want to gate the Preview-Card on schema-strictness.
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
  source: 'server-card' | 'initialize'
}

function asString(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined
}

function asNumber(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined
}

async function probeServerCard(mcpUrl: string, fetchFn: FetchLike, signal?: AbortSignal): Promise<ServerPreview | null> {
  let origin: string
  try {
    origin = new URL(mcpUrl).origin
  } catch {
    return null
  }
  try {
    const res = await fetchFn(`${origin}/.well-known/mcp-server-card`, {
      method: 'GET',
      signal,
    })
    if (!res.ok) return null
    const body = (await res.json()) as unknown
    if (!body || typeof body !== 'object') return null
    const b = body as Record<string, unknown>
    const capabilities = (b.capabilities as Record<string, unknown> | undefined) ?? {}
    const toolCount = asNumber(
      (capabilities.tools as Record<string, unknown> | undefined)?.count,
    )
    const resourceCount = asNumber(
      (capabilities.resources as Record<string, unknown> | undefined)?.count,
    )
    const promptCount = asNumber(
      (capabilities.prompts as Record<string, unknown> | undefined)?.count,
    )
    const authField = asString(b.authorization) ?? asString(b.auth)
    const authMode: AuthMode =
      authField === 'oauth2' || authField === 'oauth' ? 'oauth' : authField === 'none' ? 'none' : 'unknown'
    return {
      name: asString(b.name),
      version: asString(b.version),
      description: asString(b.description),
      instructions: asString(b.instructions),
      toolCount,
      resourceCount,
      promptCount,
      authMode,
      source: 'server-card',
    }
  } catch {
    return null
  }
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
    const capabilities = (result.capabilities as Record<string, unknown> | undefined) ?? {}
    const authMode: AuthMode = 'none'
    return {
      name: asString(serverInfo.name),
      version: asString(serverInfo.version),
      instructions: asString(result.instructions),
      toolCount: capabilities.tools ? 0 : undefined, // we know the capability exists but not the count
      resourceCount: capabilities.resources ? 0 : undefined,
      promptCount: capabilities.prompts ? 0 : undefined,
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
  const card = await probeServerCard(trimmed, fetchFn, signal)
  if (card) return card
  return probeInitialize(trimmed, fetchFn, signal)
}
