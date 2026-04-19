import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'
import type { IncomingMessage, ServerResponse } from 'node:http'

function mcpProxy() {
  return {
    name: 'mcp-proxy',
    configureServer(server: {
      middlewares: {
        use: (
          path: string,
          handler: (req: IncomingMessage, res: ServerResponse) => void,
        ) => void
      }
    }) {
      server.middlewares.use('/api/mcp', async (req, res) => {
        const reqUrl = new URL(req.url ?? '', 'http://localhost')
        const target = reqUrl.searchParams.get('url')

        if (!target) {
          res.statusCode = 400
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ error: 'missing url query param' }))
          return
        }

        let parsedTarget: URL
        try {
          parsedTarget = new URL(target)
        } catch {
          res.statusCode = 400
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ error: 'invalid target url' }))
          return
        }

        if (parsedTarget.protocol !== 'http:' && parsedTarget.protocol !== 'https:') {
          res.statusCode = 400
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({
            error: 'invalid_protocol',
            code: 'INVALID_PROTOCOL',
            message: `Protokoll ${parsedTarget.protocol} nicht erlaubt`,
            target,
          }))
          return
        }

        // Block cloud-metadata endpoints (SSRF hardening)
        const blockedHosts = new Set([
          '169.254.169.254',
          'metadata.google.internal',
          'metadata.goog',
        ])
        if (blockedHosts.has(parsedTarget.hostname.toLowerCase())) {
          res.statusCode = 403
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({
            error: 'host_blocked',
            code: 'HOST_BLOCKED',
            message: `Host ${parsedTarget.hostname} ist gesperrt`,
            target,
          }))
          return
        }

        let body: Buffer | undefined
        if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'DELETE') {
          const chunks: Buffer[] = []
          for await (const chunk of req) chunks.push(chunk as Buffer)
          if (chunks.length) body = Buffer.concat(chunks)
        }

        const headers = new Headers()
        for (const [key, value] of Object.entries(req.headers)) {
          if (value === undefined) continue
          const lower = key.toLowerCase()
          if (
            lower === 'host' ||
            lower === 'connection' ||
            lower === 'content-length' ||
            lower === 'accept-encoding' ||
            lower === 'origin' ||
            lower === 'referer' ||
            lower === 'authorization' ||
            lower === 'cookie' ||
            lower === 'x-mcp-forward-headers'
          ) continue
          headers.set(key, Array.isArray(value) ? value.join(',') : value)
        }

        // Opt-in auth: client kann via x-mcp-forward-headers (base64(JSON)) eigene Headers
        // in den Upstream-Request injecten (Bearer-Tokens etc.). Auf diesem Weg weil:
        // - Browser können bei EventSource (SSE) keine Custom-Header setzen
        // - Der generische Authorization/Cookie-Strip oben bleibt als SSRF-Schutz
        const forwardRaw = req.headers['x-mcp-forward-headers']
        if (forwardRaw) {
          const rawStr = Array.isArray(forwardRaw) ? forwardRaw[0] : forwardRaw
          try {
            const decoded = Buffer.from(rawStr, 'base64').toString('utf-8')
            const parsed = JSON.parse(decoded) as unknown
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
              throw new Error('forward headers must be an object')
            }
            for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
              if (typeof v !== 'string') {
                throw new Error(`header "${k}" value must be string`)
              }
              if (!/^[A-Za-z0-9-]{1,128}$/.test(k)) {
                throw new Error(`invalid header name "${k}"`)
              }
              if (v.length === 0 || v.length > 8192) {
                throw new Error(`invalid value length for "${k}"`)
              }
              if (/[\r\n\0]/.test(v)) {
                throw new Error(`forbidden characters in "${k}" value`)
              }
              headers.set(k, v)
            }
          } catch (err) {
            res.statusCode = 400
            res.setHeader('content-type', 'application/json')
            res.end(JSON.stringify({
              error: 'invalid_forward_headers',
              code: 'INVALID_FORWARD_HEADERS',
              message: err instanceof Error ? err.message : 'bad forward headers',
              target,
            }))
            return
          }
        }

        // 30s connect-timeout on the initial fetch. Once response headers land
        // (SSE stream has started), the timeout is cleared — SSE sessions can legitimately
        // hang open for hours.
        const connectController = new AbortController()
        const connectTimer = setTimeout(() => {
          connectController.abort()
        }, 30_000)

        // If the browser drops the request mid-stream, propagate the abort upstream.
        const onClientAbort = () => connectController.abort()
        req.on('close', onClientAbort)

        try {
          const upstream = await fetch(target, {
            method: req.method,
            headers,
            body,
            redirect: 'follow',
            signal: connectController.signal,
          })
          clearTimeout(connectTimer)

          res.statusCode = upstream.status
          upstream.headers.forEach((value, key) => {
            const lower = key.toLowerCase()
            if (lower === 'content-encoding' || lower === 'content-length' || lower === 'transfer-encoding') return
            res.setHeader(key, value)
          })

          if (!upstream.body) {
            res.end()
            return
          }

          const reader = upstream.body.getReader()
          try {
            while (true) {
              const { done, value } = await reader.read()
              if (done) break
              res.write(Buffer.from(value))
            }
          } finally {
            reader.releaseLock()
          }
          res.end()
        } catch (err) {
          clearTimeout(connectTimer)
          const isAbort =
            (err instanceof DOMException && err.name === 'AbortError') ||
            (err instanceof Error && err.name === 'AbortError')
          const cause = (err as { cause?: { code?: string; message?: string } }).cause
          const rawCode = isAbort
            ? 'CONNECT_TIMEOUT'
            : cause?.code ?? 'UNKNOWN'
          const rawMessage = isAbort
            ? 'Der Upstream-Server hat 30 s lang keine Response-Header gesendet.'
            : cause?.message ?? (err instanceof Error ? err.message : String(err))
          res.statusCode = 504
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({
            error: isAbort ? 'proxy_connect_timeout' : 'proxy_upstream_failed',
            code: rawCode,
            message: rawMessage,
            target,
          }))
        } finally {
          req.off('close', onClientAbort)
        }
      })
    },
  }
}

// `BASE_PATH` is set by the GitHub Pages deploy workflow to `/<repo-name>/` so
// the built asset URLs carry the subpath. For root-domain deploys (custom domain,
// Cloudflare Pages, Vercel) leave it unset → base is `/`. Dev server always uses `/`.
const basePath = process.env.BASE_PATH ?? '/'

export default defineConfig({
  base: basePath,
  plugins: [vue(), tailwindcss(), mcpProxy()],
  resolve: {
    alias: {
      '~': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5775,
    strictPort: false,
  },
})
