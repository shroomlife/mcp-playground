/**
 * Minimal hand-rolled router. Keeps URL and connection state in sync without pulling in
 * vue-router.
 *
 * **Hash-based routing** so the app works on any static host without SPA-fallback config
 * (GitHub Pages, a plain S3 bucket, file://). The URL looks like
 * `https://host/basepath/#/s/<host><path>?t=sse`. The browser serves the same index.html
 * for every hash; only the hash changes as the user navigates.
 *
 * URL scheme (readable and reversible):
 *   - empty / "/"                           → Landing
 *   - "/s/<host><path>"                     → https MCP server (default)
 *   - "/s/<host><path>?s=http"              → http MCP server
 *   - "/s/<host><path>?t=sse"               → SSE transport
 *   - "/s/<url-encoded-url>"                → fallback for URLs with query/hash/creds
 *
 * OAuth callbacks arrive with `code+state` in the top-level `window.location.search`
 * (providers don't forward hashes). That's orthogonal to the hash-based app routing.
 */
import { ref, type Ref } from 'vue'
import type { TransportKind } from './useMcpPlayground'

export type RoutePath = 'landing' | 'server' | 'oauth-callback'

export interface RouteRecipe {
  toolName: string
  args?: Record<string, unknown>
}

export interface RouteState {
  path: RoutePath
  mcpUrl?: string
  transport?: TransportKind
  /** Optional "recipe": a tool name + prefilled args carried in the hash query, so a
   *  URL can pre-select a tool and fill the form. `?run=<tool>&args=<url-safe-base64>`. */
  recipe?: RouteRecipe
}

function utf8ToUrlBase64(str: string): string {
  const bytes = new TextEncoder().encode(str)
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i] as number)
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function urlBase64ToUtf8(encoded: string): string | null {
  try {
    const standard = encoded.replace(/-/g, '+').replace(/_/g, '/')
    const padded = standard + '==='.slice((standard.length + 3) % 4)
    const binary = atob(padded)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
    return new TextDecoder().decode(bytes)
  } catch {
    return null
  }
}

function encodeRecipeArgs(args: Record<string, unknown>): string {
  return utf8ToUrlBase64(JSON.stringify(args))
}

function decodeRecipeArgs(encoded: string): Record<string, unknown> | null {
  const json = urlBase64ToUtf8(encoded)
  if (json === null) return null
  try {
    const parsed = JSON.parse(json) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
    return null
  } catch {
    return null
  }
}

function hasComplexParts(u: URL): boolean {
  return Boolean(u.search) || Boolean(u.hash) || Boolean(u.username) || Boolean(u.password)
}

function transportFromSearch(search: URLSearchParams): TransportKind {
  return search.get('t') === 'sse' ? 'sse' : 'http'
}

function parseHash(hashWithHash: string): { path: string; params: URLSearchParams } {
  // hashWithHash is like "#/s/foo/bar?t=sse" (or "" or "#/")
  const raw = hashWithHash.startsWith('#') ? hashWithHash.slice(1) : hashWithHash
  const qIdx = raw.indexOf('?')
  if (qIdx < 0) return { path: raw || '/', params: new URLSearchParams() }
  return {
    path: raw.slice(0, qIdx) || '/',
    params: new URLSearchParams(raw.slice(qIdx + 1)),
  }
}

function parseLocation(): RouteState {
  if (typeof window === 'undefined') return { path: 'landing' }

  // OAuth return: code+state arrive in top-level search (not hash) because providers
  // don't forward the hash fragment. Detect this before the hash-route read.
  const topSearch = new URLSearchParams(window.location.search)
  if (topSearch.has('code') && topSearch.has('state')) {
    return { path: 'oauth-callback' }
  }

  const { path, params } = parseHash(window.location.hash)
  if (path === '/' || path === '') return { path: 'landing' }

  const match = path.match(/^\/s\/(.+)$/)
  if (!match?.[1]) return { path: 'landing' }
  const rest = match[1]

  function recipeFromParams(): RouteRecipe | undefined {
    const toolName = params.get('run')
    if (!toolName) return undefined
    const argsParam = params.get('args')
    const args = argsParam ? (decodeRecipeArgs(argsParam) ?? undefined) : undefined
    return args ? { toolName, args } : { toolName }
  }

  // Percent-encoded fallback form
  if (rest.includes('%')) {
    try {
      const decoded = decodeURIComponent(rest)
      new URL(decoded)
      return {
        path: 'server',
        mcpUrl: decoded,
        transport: transportFromSearch(params),
        recipe: recipeFromParams(),
      }
    } catch {
      return { path: 'landing' }
    }
  }

  const scheme = params.get('s') === 'http' ? 'http' : 'https'
  const mcpUrl = `${scheme}://${rest}`
  try {
    new URL(mcpUrl)
  } catch {
    return { path: 'landing' }
  }
  return {
    path: 'server',
    mcpUrl,
    transport: transportFromSearch(params),
    recipe: recipeFromParams(),
  }
}

function buildServerHash(
  mcpUrl: string,
  transport: TransportKind,
  recipe?: RouteRecipe,
): string {
  let u: URL | null = null
  try {
    u = new URL(mcpUrl)
  } catch {
    // fall through to encoded fallback
  }

  const params = new URLSearchParams()
  if (transport === 'sse') params.set('t', 'sse')
  if (recipe) {
    params.set('run', recipe.toolName)
    if (recipe.args && Object.keys(recipe.args).length > 0) {
      params.set('args', encodeRecipeArgs(recipe.args))
    }
  }

  if (u && !hasComplexParts(u) && (u.protocol === 'http:' || u.protocol === 'https:')) {
    if (u.protocol === 'http:') params.set('s', 'http')
    const hostPath = u.host + (u.pathname === '' ? '/' : u.pathname)
    const qs = params.toString()
    return `#/s/${hostPath}${qs ? `?${qs}` : ''}`
  }

  const qs = params.toString()
  return `#/s/${encodeURIComponent(mcpUrl)}${qs ? `?${qs}` : ''}`
}

export function buildRecipeUrl(
  mcpUrl: string,
  transport: TransportKind,
  toolName: string,
  args: Record<string, unknown>,
): string {
  if (typeof window === 'undefined') return ''
  const hash = buildServerHash(mcpUrl, transport, { toolName, args })
  return `${window.location.origin}${window.location.pathname}${hash}`
}

interface Router {
  current: Ref<RouteState>
  navigateToServer(mcpUrl: string, transport: TransportKind, recipe?: RouteRecipe): void
  replaceWithServer(mcpUrl: string, transport: TransportKind, recipe?: RouteRecipe): void
  navigateToLanding(): void
  replaceWithLanding(): void
}

let singleton: Router | null = null

function pathPrefix(): string {
  if (typeof window === 'undefined') return '/'
  return window.location.pathname
}

function create(): Router {
  const current = ref<RouteState>(parseLocation())

  function sync() {
    current.value = parseLocation()
  }

  function navigateToServer(mcpUrl: string, transport: TransportKind, recipe?: RouteRecipe) {
    if (typeof window === 'undefined') return
    const target = pathPrefix() + buildServerHash(mcpUrl, transport, recipe)
    if (window.location.pathname + window.location.hash !== target) {
      window.history.pushState({}, '', target)
    }
    sync()
  }

  function replaceWithServer(mcpUrl: string, transport: TransportKind, recipe?: RouteRecipe) {
    if (typeof window === 'undefined') return
    const target = pathPrefix() + buildServerHash(mcpUrl, transport, recipe)
    window.history.replaceState({}, '', target)
    sync()
  }

  function navigateToLanding() {
    if (typeof window === 'undefined') return
    const target = pathPrefix() + '#/'
    if (window.location.pathname + window.location.hash !== target) {
      window.history.pushState({}, '', target)
    }
    sync()
  }

  function replaceWithLanding() {
    if (typeof window === 'undefined') return
    const target = pathPrefix()
    window.history.replaceState({}, '', target)
    sync()
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('popstate', sync)
    window.addEventListener('hashchange', sync)
  }

  return {
    current,
    navigateToServer,
    replaceWithServer,
    navigateToLanding,
    replaceWithLanding,
  }
}

export function useRouter(): Router {
  if (!singleton) singleton = create()
  return singleton
}
