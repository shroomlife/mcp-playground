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
            lower === 'cookie'
          ) continue
          headers.set(key, Array.isArray(value) ? value.join(',') : value)
        }

        try {
          const upstream = await fetch(target, {
            method: req.method,
            headers,
            body,
            redirect: 'follow',
          })

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
          const cause = (err as { cause?: { code?: string; message?: string } }).cause
          const rawCode = cause?.code ?? 'UNKNOWN'
          const rawMessage = cause?.message ?? (err instanceof Error ? err.message : String(err))
          res.statusCode = 502
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({
            error: 'proxy_upstream_failed',
            code: rawCode,
            message: rawMessage,
            target,
          }))
        }
      })
    },
  }
}

export default defineConfig({
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
