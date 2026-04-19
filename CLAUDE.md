# MCP Playground

Browser-Client zum Inspizieren und Ausprobieren von MCP-Servern (Model Context Protocol).
Verbindet sich per HTTP-Streamable oder SSE, zeigt Capabilities, Tools, Resources und Prompts,
lässt Tools mit einem schema-generierten Formular live ausführen und kann verifizierte
Server in die `.mcp.json` eines lokalen Projekts schreiben.

Kein Backend, kein Persistenzserver — reiner Vite-Dev-Server mit einem in `vite.config.ts`
eingebauten Proxy, das CORS-Probleme zum MCP-Ziel löst und gleichzeitig gegen SSRF härtet.

## Stack

- **Bun** — Package-Manager & Runtime. Niemals npm/npx/yarn/pnpm.
- **Vite 6** + **Vue 3.5** (`<script setup>`) + **TypeScript strict**
- **Tailwind v4** via `@tailwindcss/vite`
- **Reka UI** für Dialog/Accordion/Tabs (headless, a11y)
- **@modelcontextprotocol/sdk** als Client-Library
- **lucide-vue-next** für Icons

## Commands

```bash
bun install
bun run dev           # Vite dev + eingebauter MCP-Proxy, Port 5775
bun run typecheck     # vue-tsc --noEmit
bun run lint          # ESLint v10 flat config
bun run lint:fix      # auto-fix where möglich
bun run build         # typecheck + production build
```

Keine Tests (bewusst, Prototyp). Typecheck + Lint sind die Quality Gates — beide müssen
grün sein vor einem Commit.

Lint-Stack: ESLint 10 flat config (`eslint.config.ts`), `@vue/eslint-config-typescript`
im `strict`-Preset, `eslint-plugin-vue` v10. Formatting-Rules sind bewusst aus —
der Kompakt-Template-Style bleibt. Semantische Rules (`no-explicit-any`,
`no-non-null-assertion`, `consistent-type-imports`, `no-dynamic-delete`, …) stehen.

**Pre-commit Hook** über `simple-git-hooks` + `lint-staged`: `eslint --fix` auf geänderte
`.ts`/`.vue` Files, danach `vue-tsc --noEmit` auf das gesamte Projekt. Setup passiert
automatisch per `bun install` (postinstall → `prepare` script).

**CI**: GitHub Actions (`.github/workflows/ci.yml`) läuft auf push/PR und führt
lint + typecheck + build auf Bun aus.

**Deploy**: GitHub Actions (`.github/workflows/deploy-pages.yml`) baut bei jedem Push auf
main und deployed auf GitHub Pages. `BASE_PATH` wird aus `github.event.repository.name`
abgeleitet (Repo heißt z.B. `mcp-playground` → Assets landen unter `/mcp-playground/…`).
Für Custom-Domain-Deploys den `BASE_PATH`-Wert im Workflow auf `/` setzen.
**Production-Mode hat keinen Dev-Proxy** — `useMcpPlayground.buildProxyUrl`,
`useOAuth.createProxyFetch`, `useOAuth.probeOAuthSupport` und `probeProxy` zweigen über
`import.meta.env.DEV` auf Direct-Fetch ab. SSRF-Härtung entfällt weil's keinen Backend-
Angriffsvektor mehr gibt; CORS wird zur echten Sicherheitsgrenze.

## Architecture

```
src/
  App.vue                     # Shell: Landing ⇆ Connected view, orchestriert State
  composables/
    useMcpPlayground.ts       # MCP-Client-State (connect/disconnect/call/read/prompt/beginOAuth)
    useAuthConfig.ts          # Auth-Header pro URL in localStorage
    useSessionState.ts        # Singleton: Tab, Selection, Search in sessionStorage (Tab-scoped)
    useServerHistory.ts       # Singleton: MCP-Server-History in localStorage (cross-tab)
    useOAuth.ts               # OAuthClientProvider + proxyFetch wrapper + callback consumer
    useRouter.ts              # Minimal URL-Routing: /, /s/<host+path>, /oauth/callback
    useAbortableRun.ts        # Generic running/progress/cancel pattern für die Details
    useTheme.ts               # Light/Dark Toggle + localStorage-Persistenz
  components/
    ConnectionForm.vue        # URL + Transport-Wahl + Auth + Submit (Landing)
    AuthConfigPanel.vue       # OAuth Login/Logout + Bearer + Custom-Header Eingabe
    RecentServers.vue         # "Zuletzt verbunden" Liste auf Landing (aus useServerHistory)
    ConnectedHeader.vue       # Sticky Server-Strip nach Handshake
    ServerInstructions.vue    # Dismissible Banner für server.instructions
    ThemeToggle.vue           # Mond/Sonne-Button, bindet useTheme
    InspectorPanels.vue       # Tabs + Host der Explorer + Log-Tab (SERVER/CLIENT source)
    ToolExplorer.vue          # Split-View: suchbare Tool-Liste + Detail
    ToolDetail.vue            # Rechte Pane: SchemaForm → Run/Cancel → Progress → Result → History
    PromptExplorer.vue        # Split-View für Prompts
    PromptDetail.vue          # Rechte Pane: Args → Get/Cancel → Messages → History
    ResourceExplorer.vue      # Split-View für Resources + Templates
    ResourceDetail.vue        # Rechte Pane: Placeholders → Read/Cancel → Content → History
    SchemaForm.vue            # Generisches Formular aus JSON-Schema
    ToolResultView.vue        # Pretty/Raw Darstellung der Tool-Antwort (+ Aborted-State)
    ErrorPanel.vue            # Fachliche Fehlerklassifikation (+ OAUTH_REQUIRED Softpanel)
    InstallToClaudeCode.vue   # Dialog: MCP-Server in .mcp.json schreiben
    JsonView.vue              # Tree-View Wrapper mit Filter-Input + Copy-All
    JsonNode.vue              # Recursive Tree-Node: kollabierbar, Match-Highlight
  lib/
    schemaFormHelpers.ts      # analyzeSchema / validateArgs / stripEmpty
    claudeCodeInstall.ts      # File-System-Access-API Integration
```

**Data flow:** `useMcpPlayground()` hält den gesamten Verbindungsstate als `ref`s / `shallowRef`s.
`App.vue` ist das einzige Bindeglied — Kinder bekommen Daten als Props, kommunizieren per `emit`
oder async Callback-Props für `run/read`. Kein Pinia nötig.

**UX Pattern: Inline-Explorer** — Tools/Resources/Prompts nutzen dasselbe Split-View-Pattern:
links suchbare Liste (360px auf Desktop, gestapelt unter `md`), rechts Detail-Pane mit
**sowohl** Exploration (Beschreibung, Schemas) **als auch** Ausführung (Form → Run → Result →
History). Kein Modal — der ganze Flow ist inline. Per `:key` werden die Detail-Komponenten beim
Wechsel neu gemountet, damit jede Tool-/Prompt-/Resource-Instanz ihren eigenen frischen State hat.

**Session-Persistence** — `useSessionState` ist ein Singleton-Composable, das die ganze
"wo war ich"-Sicht (URL, Transport, Tab, Selection je Explorer, Search-Queries) in
`sessionStorage` hält. Auto-Reconnect auf Mount wenn eine Session-URL existiert. Gelöscht
beim User-initiierten Disconnect. Stirbt mit dem Tab — genau richtig für diesen Use-Case.

**Cancel + Progress + Abort** — jeder Call läuft durch `useAbortableRun`. Der Composable
erzeugt einen `AbortController`, injiziert `signal` + `onProgress` in die Options des Calls,
pflegt `running/progress`-Refs und cleaned in `onBeforeUnmount` selbst auf (User switcht Tool
während running → Component unmountet → Call wird abgebrochen). User-initiiertes Cancel
führt zu einem History-Entry mit `error: 'Abgebrochen'` — das UI rendert das als "Aborted"
in `warning`-Farbe, nicht als Fehler.

**Server-Notifications** — im `connect()` werden vier Handler registriert:
`LoggingMessageNotificationSchema` (Server-Logs landen im gemeinsamen Log-Stream mit
`source='server'`), plus `ToolListChanged`, `ResourceListChanged`, `PromptListChanged`
(Auto-Refresh der Listen bei Runtime-Änderungen).

**Dark Mode** — `.dark` auf `<html>` wird von `useTheme` gesetzt. Tailwind v4's `dark:`
Variante ist per `@custom-variant dark (&:where(.dark, .dark *))` in `style.css` auf
class-based umgestellt. Light bleibt initial-default, `prefers-color-scheme` ist nur Hint
beim ersten Mount ohne gespeicherte Präferenz.

**URL-Routing** — `useRouter` ist ein eigener, minimaler Router (kein vue-router). **Hash-
basiert** damit's auf jedem Static-Host (GitHub Pages, S3, `file://`) ohne SPA-Fallback
läuft. Schema: `#/` (oder leer) = Landing, `#/s/<host>/<path>` = verbundener Server (https
implicit, `?s=http` als Hash-Query für http, `?t=sse` für SSE). OAuth-Callbacks landen mit
`?code+state` im top-level `search` (nicht im Hash — Provider forwarden den Hash nicht) und
werden über einen eigenen Branch in `parseLocation` erkannt. Komplexe URLs mit
Query/Hash/Creds fallen automatisch auf `#/s/<url-encoded>` zurück. `popstate`- und
`hashchange`-Handler syncen `router.current` → App's `syncToRoute(route)` macht
connect/disconnect.

**Restoring-State** — zwischen Route-Match und erster Verbindung (z.B. Direkt-Link auf /s/,
OAuth-Callback-Return, F5) rendern wir einen minimalen "Verbinde …"-Placeholder statt der
Landing-Form. Verhindert UX-Flash und hält die Ansicht stabil über Reloads hinweg.

**OAuth 2.1 + DCR** — `useOAuth.createOAuthProvider(url, transport, onRedirect?)` erzeugt
die SDK-`OAuthClientProvider`-Implementation (sessionStorage-Backend, keyed per MCP-URL).
SDK macht Discovery → DCR → PKCE → Redirect. `createProxyFetch` ist der kritische Klebstoff:
wrapped jeden fetch (Discovery-Calls, DCR, Token-Exchange, MCP-Traffic) durch `/api/mcp`
und verschiebt `Authorization`-Header in den bestehenden `x-mcp-forward-headers`-Seitenkanal
(sonst strippt unser Proxy den Auth-Header als SSRF-Hardening). `consumePendingCallback`
liest `?code&state` aus der URL beim Mount, validiert state, **rewriet die URL bei allen
Outcomes** (Erfolg, Cancel, State-Mismatch) auf `/s/<mcpUrl>` zurück — so kommt der User
nie aus dem Server-Kontext gerissen auf die Landing. Bei Erfolg gibt es
`{ mcpUrl, transport, code }` zurück, App.vue ruft `connect(..., code)` der via
`transport.finishAuth(code)` den Token-Exchange abschließt.

**OAuth-Probe + Silent-Failure-Detection** — `probeOAuthSupport(url)` ruft beide RFC-8414/
RFC-9728 `.well-known/`-Endpoints parallel ab (proxied) und sagt `true` wenn mindestens
einer gültiges JSON liefert. `AuthConfigPanel` debounced das (400 ms) auf URL-Änderungen
und zeigt je nach Ergebnis: `checking`-Loader → `supported` (Anmelden-Button) oder
`unsupported` (muted "Keine OAuth-Anmeldung verfügbar"-Hinweis). Zusätzlich erkennt
`beginOAuth`, wenn die SDK `'REDIRECT'` zurückgibt, ohne dass `provider.redirectToAuthorization`
tatsächlich gerufen wurde (Silent-Failure bei partiellen Metadaten) und wirft dann
einen expliziten Fehler — kein leises "Nichts-passiert" mehr. **Fehler aus `beginOAuth`
werden propagiert** (nicht in den globalen State geschrieben); `AuthConfigPanel` fängt
sie lokal und rendert sie inline, damit die umgebende Connected/Landing-Ansicht stabil
bleibt.

**Server-History** — `useServerHistory` hält die letzten 12 erfolgreich verbundenen Server
in `localStorage`. `touch(url, transport, serverName?)` wird in App.vue über `watch(state)`
aufgerufen, sobald `state === 'connected'`. Landing zeigt die Liste als `RecentServers` mit
Klick-zum-Connect und Entfernen-Knopf.

**JsonView Tree** — `JsonView` ist nicht mehr ein `<pre>`-Blob sondern ein kollabierbarer
Tree-Viewer. Das top-level `JsonView` hält Filter-Input + Copy-All, `JsonNode` ist rekursiv
(via `defineOptions({ name: 'JsonNode' })`). Filter: case-insensitive Substring-Match auf
Keys und Primitive-Werte; Parents von Matches bleiben sichtbar, Matches werden
gehighlightet, Nicht-Match-Zweige ausgeblendet. Default-Collapse ab Tiefe ≥ 2, damit tiefe
Schemas nicht als Wall of Text aufpoppen.

**ToolResultView 3-Modi** — `Pretty` (gerenderte Content-Blocks, Text-Items mit JSON-Inhalt
auto als Tree), `Explorer` (voller Result als Tree + Filter), `Raw` (reiner JSON-Text mit
Copy-Button). Beim ersten eintreffenden Result wählt `looksLikeJson` den Default: Explorer
wenn `structuredContent` gesetzt ist oder alle Content-Items JSON-parseable Text/Resource
sind, sonst Pretty. Die Wahl greift einmal pro Detail-Mount, danach bleibt der manuelle
Tab-Switch erhalten.

## Security Model (wichtig)

Der MCP-Proxy in `vite.config.ts` ist ein CORS-Breaker, kein blind forwarder:

1. **SSRF-Hardening** — Cloud-Metadata-IPs (`169.254.169.254`, `metadata.google.internal`,
   `metadata.goog`) sind hart geblockt. Protokoll muss `http:` oder `https:` sein.
2. **Header-Strip** — `authorization`, `cookie`, `origin`, `referer`, `host`, `connection`,
   `content-length`, `accept-encoding`, `x-mcp-forward-headers` werden aus Browser-Requests
   entfernt, bevor Upstream getroffen wird. Der Browser darf nicht sein Session-Cookie oder
   eine fremde Domain ins MCP-Ziel schleusen.
3. **Opt-in Auth via `x-mcp-forward-headers`** — Base64-kodiertes JSON-Object. Im Proxy:
   - Header-Name muss `/^[A-Za-z0-9-]{1,128}$/` matchen
   - Value: 1–8192 Zeichen, keine `\r`, `\n`, `\0`
   Grund: SSE via `EventSource` kann keine Custom-Header senden — dieser Umweg erlaubt
   Bearer-Tokens trotzdem, ohne die Strip-Regel zu brechen.
4. **Response-Header-Strip** — `content-encoding`, `content-length`, `transfer-encoding`
   werden vom Upstream nicht durchgereicht (sonst bricht Node/Undici das Streaming).

**Auth-Tokens liegen im `localStorage`** unter `mcp-playground:auth:<normalizedUrl>`.
Das ist für Solo-Devices OK, für Shared-Devices explizit gewarnt im UI. Nicht fürs öffentliche Web.

## Konventionen

- **SFC-Reihenfolge:** `<script setup lang="ts">` → `<template>` → `<style>` (wenn überhaupt).
- **No `any`, no `!`** — `unknown` narrow-guarden, Optional-Chaining statt Non-Null-Assertion.
- **Refs vs. shallowRef** — `shallowRef` für grosse Arrays (tools, resources, history). Plain
  `ref` nur für einfache Primitives/Summaries.
- **Pfad-Alias:** `~/` zeigt auf `src/` (in `tsconfig.json` und `vite.config.ts` definiert).
- **Keine Kommentare, die erklären was der Code tut** — nur bei nicht-offensichtlichen
  Entscheidungen (z.B. der Base64-Auth-Umweg oben).
- **i18n:** UI ist Deutsch. Echte Umlaute (ä, ö, ü, ß), niemals `ae/oe/ue/ss`-Ersatzschreibweise.
- **Keine neuen Dependencies ohne Rückfrage.**

## Gotchas

- **Keyboard-Shortcut `/`** — im `ToolExplorer` fokussiert `/` global die Suche (außer
  beim Fokus in Input/Textarea). Wenn du neue Explorer baust mit eigenem globalen Hotkey,
  den `onGlobalKey`-Guard in `ToolExplorer.vue` als Vorlage nehmen (Target-Tag-Check +
  `isContentEditable`). Immer in `onBeforeUnmount` abmelden.
- **Probe-Logic (`classifyConnectError`)** — Wenn `client.connect()` scheitert, feuert ein
  manueller `fetch` einen echten `initialize`-Request an den Proxy. HTTP 200 + nicht-MCP-Body
  bedeutet "erreichbar aber spricht kein MCP" → Button "mit anderem Transport versuchen".
- **Inline-Run via Promise-Callback-Props** — `ToolDetail/PromptDetail/ResourceDetail`
  bekommen `runTool` / `runPrompt` / `readResource` als Props und awaiten direkt. Kein
  Event-Emit-Round-Trip, sauberes `try/finally` für `running`. Parent reicht einfach
  `:run-tool="callTool"` etc. aus dem Composable durch. Nach `:key`-Unmount landen
  in-flight Promises im Nirvana — History wird aber im Composable festgehalten.
- **Spontaner Connection-Close** — `c.onclose` feuert NUR wenn der Server (oder das
  Transport) die Verbindung bricht. User-initiiertes `disconnect()` strippt den Handler
  über `cleanupClient()` vor dem Close. Deshalb setzt der Handler `state='error'` + baut
  `errorDetails` mit `code: 'CONNECTION_LOST'` — der ErrorPanel zeigt's mit Retry-Button.
- **Session-State Singleton** — `useSessionState` erzeugt einen Modul-level Singleton
  (`let singleton`). Alle Components greifen auf die gleichen Refs zu. Bewusst ohne
  `provide/inject` — zu viel Zeremonie für eine Browser-Storage-Synchronisation.
- **localStorage-Migration** — `useAuthConfig.ts` liest einmalig den alten `mcp-inspector:auth:`
  Prefix und schreibt ihn auf `mcp-playground:auth:` um. Der Fallback kann irgendwann in 2027
  ersatzlos raus.
- **EventSource + SSE** — Der SDK baut `EventSource` für SSE. Browser setzen da keine
  Custom-Header. Auth-Tokens gehen deshalb über den `x-mcp-forward-headers`-Seitenkanal,
  nicht über `requestInit.headers` alleine.
- **`defineEmits` Object-Syntax** — Wir nutzen das Vue-3.3+ Tuple-Format
  (`'event': [arg1: T, arg2: U]`), nicht die alte Call-Signature-Form. ESLint's
  `unified-signatures` würde die alte Form zusammenfassen wollen und Event-Namen verlieren.

## Was NICHT zu tun ist

- Keine Secrets in den Code. Auth läuft rein client-seitig via `localStorage`.
- Keine Backend-Logik einbauen — der Proxy ist Dev-only und soll das auch bleiben.
- Keine fremde JSON-Blob direkt `v-html`-en. `ToolResultView` rendert Text via `{{ }}`,
  Bilder nur bei MIME-Allowlist (`IMAGE_MIMES`). Die Trennung sauber halten.
- Kein Pinia, keine Router, keine i18n-Library — für diesen Scope Overkill.
