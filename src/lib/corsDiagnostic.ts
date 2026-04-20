/**
 * CORS-Preflight-Diagnose für MCP-Endpoints.
 *
 * Schickt einen OPTIONS-Request mit den Headern, die das MCP SDK real sendet,
 * und analysiert die Antwort des Servers: Welche Headers erlaubt er? Welche
 * fehlen? Darf unsere Method überhaupt durch?
 *
 * Limits, weil Browser-Security:
 * - `Access-Control-Request-Method` und `Access-Control-Request-Headers` sind
 *   im Fetch-Standard "forbidden headers"; der Browser strippt sie in Prod
 *   stumm und unser OPTIONS landet ohne sie beim Server. Viele Server
 *   haben aber statische CORS-Configs (die Allow-Headers-Liste kommt
 *   unabhängig vom Request) — das Ergebnis bleibt dann trotzdem aussagekräftig.
 * - In Dev läuft der Call durch den Vite-Proxy. Der reicht die
 *   Access-Control-Request-* Header durch (der Browser strippt sie zwar, aber
 *   die stripped-Header werden im Proxy nicht re-generiert — in der Praxis
 *   keine Abweichung zur Prod-Messung). Der Proxy strippt `Origin` — manche
 *   Server antworten dann auf OPTIONS anders als auf einen echten Browser-
 *   Preflight mit Origin. Für den häufigen Fall statischer CORS-Configs bleibt
 *   die Diagnose korrekt.
 * - In Prod: Wenn der Server komplett kein `Access-Control-Allow-Origin`
 *   setzt, verwirft der Browser die Response. Wir sehen das als `reachable:
 *   false` mit Fetch-Fehler — der User bekommt aber die klare Aussage "CORS
 *   oder Netzwerk", was zum häufigsten Root Cause führt.
 */

/** Headers, die das MCP SDK bei jedem Request setzen kann. */
export const MCP_EXPECTED_HEADERS: readonly string[] = [
  'content-type',
  'accept',
  'authorization',
  'mcp-protocol-version',
  'mcp-session-id',
  'last-event-id',
]

export interface CorsDiagnosticOptions {
  expectedHeaders?: readonly string[]
  expectedMethod?: string
  signal?: AbortSignal
}

export interface CorsDiagnostic {
  url: string
  /** Kam überhaupt eine Response zurück? false = Browser hat den Call refused (CORS/Netzwerk). */
  reachable: boolean
  httpStatus?: number
  allowOrigin: string | null
  allowMethods: string[]
  allowHeaders: string[]
  exposeHeaders: string[]
  expectedHeaders: string[]
  /** Headers aus expectedHeaders, die NICHT in allow-headers stehen (und auch nicht als `*`). */
  missingHeaders: string[]
  allowsMethod: boolean
  /** Falls reachable=false: die Browser/Fetch-Fehlermeldung. */
  error?: string
}

const HAS_DEV_PROXY = import.meta.env.DEV

function splitCsvHeader(value: string | null): string[] {
  if (!value) return []
  return value
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean)
}

export async function runCorsDiagnostic(
  url: string,
  options: CorsDiagnosticOptions = {},
): Promise<CorsDiagnostic> {
  const expectedMethod = (options.expectedMethod ?? 'POST').toUpperCase()
  const expectedHeaders = (options.expectedHeaders ?? MCP_EXPECTED_HEADERS).map((h) =>
    h.toLowerCase(),
  )
  const target = HAS_DEV_PROXY
    ? `/api/mcp?url=${encodeURIComponent(url)}`
    : url

  try {
    const res = await fetch(target, {
      method: 'OPTIONS',
      headers: {
        'Access-Control-Request-Method': expectedMethod,
        'Access-Control-Request-Headers': expectedHeaders.join(', '),
      },
      signal: options.signal,
    })
    const allowOrigin = res.headers.get('access-control-allow-origin')
    const allowMethods = splitCsvHeader(res.headers.get('access-control-allow-methods'))
    const allowHeaders = splitCsvHeader(res.headers.get('access-control-allow-headers'))
    const exposeHeaders = splitCsvHeader(res.headers.get('access-control-expose-headers'))
    const wildcardHeaders = allowHeaders.includes('*')
    const missingHeaders = wildcardHeaders
      ? []
      : expectedHeaders.filter((h) => !allowHeaders.includes(h))
    // Empty allow-methods = server didn't think it had to answer that, treat as unknown-but-not-blocking.
    const allowsMethod =
      allowMethods.length === 0 ||
      allowMethods.includes('*') ||
      allowMethods.includes(expectedMethod.toLowerCase())
    return {
      url,
      reachable: true,
      httpStatus: res.status,
      allowOrigin,
      allowMethods,
      allowHeaders,
      exposeHeaders,
      expectedHeaders,
      missingHeaders,
      allowsMethod,
    }
  } catch (err) {
    return {
      url,
      reachable: false,
      allowOrigin: null,
      allowMethods: [],
      allowHeaders: [],
      exposeHeaders: [],
      expectedHeaders,
      missingHeaders: expectedHeaders,
      allowsMethod: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
