/**
 * OAuth 2.1 + DCR integration for MCP servers.
 *
 * The MCP SDK does the heavy lifting (discovery, DCR, PKCE, token exchange, refresh).
 * Our job is to implement `OAuthClientProvider` — it plugs into `StreamableHTTPClientTransport`
 * and `SSEClientTransport` via `authProvider`. The transport then handles 401 → redirect →
 * finishAuth transparently.
 *
 * Storage strategy: sessionStorage, keyed per normalized MCP-server URL. Client info,
 * tokens, PKCE verifier and CSRF state all live there; they stay only as long as the tab.
 * A single "pending" entry remembers which URL kicked off an in-flight flow so the callback
 * handler on mount can route the returned authorization code back to the right server.
 */
import type { OAuthClientProvider } from '@modelcontextprotocol/sdk/client/auth.js'
import type {
  FetchLike,
} from '@modelcontextprotocol/sdk/shared/transport.js'
import type {
  OAuthClientInformationFull,
  OAuthClientInformationMixed,
  OAuthClientMetadata,
  OAuthTokens,
} from '@modelcontextprotocol/sdk/shared/auth.js'

const PREFIX = 'mcp-playground:oauth:'
const PENDING_KEY = `${PREFIX}pending`

export interface PendingCallback {
  mcpUrl: string
  transport: 'http' | 'sse'
  /** Authorization code from provider — only set on successful return with valid state. */
  code?: string
  /** Error code if the provider redirected with `?error=…`, or `state_mismatch`. */
  error?: string
}

interface PendingSession {
  mcpUrl: string
  transport: 'http' | 'sse'
  state: string
}

function normalize(url: string): string {
  return url.trim().toLowerCase()
}

function key(mcpUrl: string, suffix: string): string {
  return `${PREFIX}${normalize(mcpUrl)}:${suffix}`
}

function safeGet(storageKey: string): unknown {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(storageKey)
    return raw ? (JSON.parse(raw) as unknown) : null
  } catch {
    return null
  }
}

function safeSet(storageKey: string, value: unknown): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(storageKey, JSON.stringify(value))
  } catch {
    // storage quota / private mode — silently ignore
  }
}

function safeGetString(storageKey: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.sessionStorage.getItem(storageKey)
  } catch {
    return null
  }
}

function safeSetString(storageKey: string, value: string): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(storageKey, value)
  } catch {
    // ignore
  }
}

function safeRemove(storageKey: string): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.removeItem(storageKey)
  } catch {
    // ignore
  }
}

function redirectUrl(): string {
  if (typeof window === 'undefined') return ''
  // Redirect to the SPA root (pathname prefix, no hash). Providers strip hashes
  // anyway, and this way the redirect URI is stable across hash-route changes.
  // In dev that's `http://localhost:5775/`; on GitHub Pages it's
  // `https://<user>.github.io/<repo>/`.
  return `${window.location.origin}${window.location.pathname}`
}

export function hasOAuthTokens(mcpUrl: string): boolean {
  const stored = safeGet(key(mcpUrl, 'tokens'))
  if (!stored || typeof stored !== 'object') return false
  return typeof (stored as OAuthTokens).access_token === 'string'
}

/**
 * Best-effort "does this MCP server offer OAuth?" probe. Used by the AuthConfigPanel to
 * decide whether to show the "Anmelden"-Button — hiding it for servers without OAuth
 * avoids dead-end clicks where the SDK silently completes without redirecting.
 *
 * Two parallel checks:
 *   1. RFC 8414 `.well-known/oauth-authorization-server` on the server's origin
 *   2. RFC 9728 `.well-known/oauth-protected-resource` on the server's origin
 *
 * Both go through our dev-proxy so CORS doesn't bite. A positive hit means the server
 * publishes enough metadata for the SDK's auth() flow to succeed.
 */
export async function probeOAuthSupport(mcpUrl: string, signal?: AbortSignal): Promise<boolean> {
  const trimmed = mcpUrl.trim()
  if (!trimmed) return false
  let origin: string
  try {
    origin = new URL(trimmed).origin
  } catch {
    return false
  }

  async function probe(target: string): Promise<boolean> {
    try {
      const url = HAS_DEV_PROXY
        ? `/api/mcp?url=${encodeURIComponent(target)}`
        : target
      const res = await fetch(url, { method: 'GET', signal })
      if (!res.ok) return false
      const text = await res.text()
      try {
        const parsed = JSON.parse(text) as unknown
        return Boolean(parsed) && typeof parsed === 'object' && !Array.isArray(parsed)
      } catch {
        return false
      }
    } catch {
      return false
    }
  }

  const results = await Promise.all([
    probe(`${origin}/.well-known/oauth-authorization-server`),
    probe(`${origin}/.well-known/oauth-protected-resource`),
  ])
  return results.some(Boolean)
}

export function clearOAuth(mcpUrl: string): void {
  safeRemove(key(mcpUrl, 'client'))
  safeRemove(key(mcpUrl, 'tokens'))
  safeRemove(key(mcpUrl, 'verifier'))
  safeRemove(key(mcpUrl, 'state'))
}

function stripOAuthQuery(): void {
  if (typeof window === 'undefined') return
  const params = new URLSearchParams(window.location.search)
  params.delete('code')
  params.delete('state')
  params.delete('error')
  const newSearch = params.toString()
  const cleanUrl =
    window.location.pathname +
    (newSearch ? `?${newSearch}` : '') +
    window.location.hash
  window.history.replaceState({}, '', cleanUrl)
}

/**
 * Read-and-consume the OAuth callback query from the current URL. Validates the returned
 * state against the saved one; wipes pending + saved state atomically. Returns the pending
 * context (MCP URL + transport + code) so the caller can finish the flow.
 *
 * The OAuth query (`code`, `state`, `error`) always gets stripped from the URL — the
 * caller (App.vue) then navigates onwards via the router so the user lands back in
 * their server context instead of on some /oauth/callback-looking URL.
 */
export function consumePendingCallback(): PendingCallback | null {
  if (typeof window === 'undefined') return null

  const params = new URLSearchParams(window.location.search)
  const code = params.get('code')
  const stateParam = params.get('state')
  const oauthError = params.get('error')

  if (!code && !oauthError) return null

  const pending = safeGet(PENDING_KEY) as PendingSession | null
  safeRemove(PENDING_KEY)
  stripOAuthQuery()

  // Nothing to recover the context from (fresh tab, direct visit with orphan params).
  if (!pending) return null

  // User cancelled at provider or provider rejected us — return the context so the
  // caller can still navigate back to the right server view.
  if (oauthError) {
    return { mcpUrl: pending.mcpUrl, transport: pending.transport, error: oauthError }
  }

  // State mismatch is a CSRF-level concern — drop the code but still return context.
  if (!code || !stateParam || pending.state !== stateParam) {
    return { mcpUrl: pending.mcpUrl, transport: pending.transport, error: 'state_mismatch' }
  }

  return { mcpUrl: pending.mcpUrl, transport: pending.transport, code }
}

/**
 * Creates an OAuthClientProvider for the given MCP server URL + transport choice. The
 * provider is stateless from the outside — all state lives in sessionStorage.
 *
 * Pass `onRedirect` to learn whether the SDK actually kicked off the browser redirect.
 * Some servers have partial OAuth metadata and the SDK returns `'REDIRECT'` without ever
 * invoking `redirectToAuthorization` — callers can use the flag to surface that silent
 * failure instead of appearing to do nothing.
 */
export function createOAuthProvider(
  mcpUrl: string,
  transport: 'http' | 'sse',
  onRedirect?: (url: URL) => void,
): OAuthClientProvider {
  const clientKey = key(mcpUrl, 'client')
  const tokensKey = key(mcpUrl, 'tokens')
  const verifierKey = key(mcpUrl, 'verifier')
  const stateKey = key(mcpUrl, 'state')

  const metadata: OAuthClientMetadata = {
    client_name: 'MCP Playground',
    redirect_uris: [redirectUrl()],
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    token_endpoint_auth_method: 'none',
  }

  return {
    get redirectUrl() {
      return redirectUrl()
    },
    get clientMetadata() {
      return metadata
    },
    state(): string {
      const s =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2) + Date.now().toString(36)
      safeSetString(stateKey, s)
      // Remember which server this flow is for, so the callback handler can route
      // the code back to the right connection even if the user navigates through
      // several providers.
      const pending: PendingSession = { mcpUrl, transport, state: s }
      safeSet(PENDING_KEY, pending)
      return s
    },
    clientInformation(): OAuthClientInformationMixed | undefined {
      const stored = safeGet(clientKey)
      return stored ? (stored as OAuthClientInformationFull) : undefined
    },
    saveClientInformation(info: OAuthClientInformationMixed): void {
      safeSet(clientKey, info)
    },
    tokens(): OAuthTokens | undefined {
      const stored = safeGet(tokensKey)
      return stored ? (stored as OAuthTokens) : undefined
    },
    saveTokens(tokens: OAuthTokens): void {
      safeSet(tokensKey, tokens)
    },
    saveCodeVerifier(verifier: string): void {
      safeSetString(verifierKey, verifier)
    },
    codeVerifier(): string {
      return safeGetString(verifierKey) ?? ''
    },
    redirectToAuthorization(url: URL): void {
      onRedirect?.(url)
      if (typeof window === 'undefined') return
      window.location.href = url.toString()
    },
    invalidateCredentials(scope: 'all' | 'client' | 'tokens' | 'verifier' | 'discovery'): void {
      if (scope === 'all') {
        clearOAuth(mcpUrl)
        return
      }
      if (scope === 'client') safeRemove(clientKey)
      if (scope === 'tokens') safeRemove(tokensKey)
      if (scope === 'verifier') safeRemove(verifierKey)
      // 'discovery' state we don't cache — nothing to invalidate
    },
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

/**
 * Fetch wrapper that wires the SDK into our dev-proxy correctly, with two responsibilities:
 *
 *   1. **URL rewriting**: any absolute URL not pointing at our own proxy endpoint gets
 *      rewrapped as `/api/mcp?url=<encoded>`. The SDK talks directly to authorization-server
 *      URLs during discovery/DCR/token exchange; those servers typically lack CORS, so we
 *      tunnel them through the same proxy that already handles MCP traffic.
 *
 *   2. **Authorization sidechannel**: the proxy strips `Authorization` + `Cookie` from the
 *      browser request as SSRF hardening. The SDK sets `Authorization: Bearer <oauth-token>`
 *      for every upstream request. We therefore lift it out of the direct header and stash
 *      it (together with any user-provided custom auth headers) into the proxy's base64
 *      `x-mcp-forward-headers` sidechannel — the proxy decodes and re-attaches upstream.
 *
 * Authorization *redirects* (top-level navigation to the AS login page) are not wrapped —
 * those are full-page navigations, not fetches.
 */
/**
 * In dev, the Vite proxy (`/api/mcp`) tunnels MCP + OAuth traffic through our
 * SSRF-hardened handler, and Authorization headers travel via the
 * `x-mcp-forward-headers` base64 sidechannel (because the browser's request would
 * otherwise get stripped at the proxy).
 *
 * In production builds (static hosting, e.g. GitHub Pages), no proxy exists. The
 * browser talks to the MCP and OAuth servers directly. Authorization and other
 * custom headers pass through as plain fetch headers — whatever CORS the target
 * server allows is what we get.
 */
const HAS_DEV_PROXY = import.meta.env.DEV

export function createProxyFetch(
  extraForwardHeaders: Record<string, string> = {},
): FetchLike {
  return async (input, init) => {
    const target = typeof input === 'string' ? input : input.toString()
    const reqHeaders = new Headers(init?.headers)

    if (!HAS_DEV_PROXY) {
      for (const [k, v] of Object.entries(extraForwardHeaders)) {
        if (!reqHeaders.has(k)) reqHeaders.set(k, v)
      }
      return fetch(target, { ...init, headers: reqHeaders })
    }

    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const isAlreadyProxied = Boolean(origin) && target.startsWith(`${origin}/api/mcp`)
    const proxyTarget = isAlreadyProxied
      ? target
      : `${origin}/api/mcp?url=${encodeURIComponent(target)}`

    const directAuth = reqHeaders.get('Authorization')
    if (directAuth) reqHeaders.delete('Authorization')

    const combined: Record<string, string> = { ...extraForwardHeaders }
    if (directAuth) combined.Authorization = directAuth

    if (Object.keys(combined).length > 0) {
      reqHeaders.set(
        'x-mcp-forward-headers',
        utf8ToBase64(JSON.stringify(combined)),
      )
    }

    return fetch(proxyTarget, { ...init, headers: reqHeaders })
  }
}
