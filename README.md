# MCP Playground

> Ein Browser-Tool zum **Erkunden und Ausprobieren von MCP-Servern** — ohne
> Command-Line, ohne Setup, einfach URL rein und los.

Verbinde dich per HTTP-Streamable oder SSE mit einem **Model Context Protocol**-Server,
browse durch Tools / Resources / Prompts, führ sie direkt aus der UI aus, sieh Live-Progress
und Ergebnisse inline. OAuth 2.1 mit Dynamic Client Registration läuft automatisch, Tool-
Ergebnisse lassen sich als JSON-Tree filtern und durchsuchen.

Deploybar auf GitHub Pages in 2 Minuten. Läuft lokal mit SSRF-gehärtetem Dev-Proxy für
Server ohne CORS.

## Features

- 🔌 **Verbinden** per HTTP Streamable oder SSE, mit OAuth 2.1, Custom Auth-Headern oder
  Bearer-Token
- 🔐 **OAuth 2.1 + Dynamic Client Registration** — Discovery (RFC 9728), DCR (RFC 7591),
  PKCE, Token-Refresh. Kein manuelles Client-Setup, einfach "Anmelden" klicken
- 🔍 **Erkunden** — durchsuchbare Listen, volle Descriptions, strukturierte Parameter-Ansicht
- ▶️ **Ausführen direkt in der Detail-Pane** — kein Modal-Hopping, Form → Run → Result → History
  in einem Flow
- 📡 **Live-Progress und Cancel** — Server-Progress-Notifications als Balken, Stop-Button
  für laufende Calls
- 🌳 **JSON-Tree-Explorer** — Ergebnisse als kollabierbarer Tree mit Such-Filter (Keys und
  Werte), nicht mehr als JSON-Blob
- 📝 **Server-Logs inline** — `notifications/message` vom Server gesehen, direkt im Log-Tab
  mit SERVER/CLIENT-Kennzeichnung
- 🔄 **Auto-Refresh** bei `list_changed`-Notifications (Tools/Resources/Prompts ändern sich zur
  Laufzeit, Liste folgt)
- 🧪 **Tool-History pro Tool** — "laden" lädt die alten Args zurück ins Formular
- 🗂️ **URI-Templates** (`/users/{id}`) mit automatischen Platzhalter-Inputs
- 🔖 **URL-Routing** — jeder Server hat eine eigene URL (`/s/mcp.deepwiki.com/mcp`),
  Browser-Back/Forward funktioniert natürlich, URLs sind shareable
- 📚 **Server-History** — zuletzt verbundene Server auf der Startseite, ein Klick reicht
- 🌓 **Dark Mode** mit System-Hint, Toggle-Button, persistiert pro Browser
- 💾 **Session-Persistenz** — Tab, Selection, Suche bleiben beim F5 erhalten
  (`sessionStorage`, stirbt mit dem Tab)
- 🔐 **SSRF-gehärteter Dev-Proxy** — Cloud-Metadata-Blocks, strikte Header-Kontrolle, Connect-Timeout
- 📦 **Install-to-Claude-Code** — schreibt den verifizierten MCP-Server direkt in die
  `.mcp.json` eines lokalen Projektordners

## Quick Start

```bash
bun install
bun run dev
```

Standardmäßig auf **[http://localhost:5775](http://localhost:5775)**. URL des MCP-Servers
eintragen, Transport wählen, verbinden.

Zum Ausprobieren: `https://mcp.deepwiki.com/mcp` (HTTP) ist public und ohne Auth erreichbar.

## Commands

| Script | Zweck |
|---|---|
| `bun run dev` | Vite dev-server + eingebauter MCP-Proxy |
| `bun run typecheck` | `vue-tsc --noEmit` |
| `bun run lint` | ESLint v10 (flat config, `strict`-Preset) |
| `bun run lint:fix` | Auto-fix wo möglich |
| `bun run build` | Typecheck + Vite production build |
| `bun run preview` | Lokale Preview des Builds |

## Tech-Stack

- **Vue 3.5** mit `<script setup>` + TypeScript strict
- **Tailwind v4** (CSS-first `@theme`, keine `tailwind.config.js`)
- **Reka UI** für Tabs/Accordion/Dialog (headless, a11y)
- **@modelcontextprotocol/sdk** als Client
- **Vite 6** + **Bun** als Runtime

## Wie das alles zusammenhängt

- **Nur Browser + Dev-Proxy** — keine Server-Logik. Der Vite-Proxy leitet Requests an
  MCP-Ziele weiter, weil Browser sonst an CORS scheitern.
- **Der Proxy ist SSRF-gehärtet**: Cloud-Metadata-IPs geblockt, Request-Header
  werden auf einen engen Allowlist gestutzt, SSE-Auth läuft über einen signierten
  `x-mcp-forward-headers` Seitenkanal (weil `EventSource` keine Custom-Header setzen kann).
- **Auth-Tokens liegen im `localStorage`** pro URL — lokales Dev-Pattern, nicht für Shared-Devices.
- **Session-State im `sessionStorage`** — was du gerade tust, überlebt den Page-Reload.
- Details zur Architektur, Konventionen und Gotchas stehen in [`CLAUDE.md`](./CLAUDE.md).

## Was der Playground *nicht* tut (bewusst)

- **Kein Sampling** — der Inspector ist kein LLM-Host
- **Keine Server-Implementierung** — nur Client/Explorer
- **Keine Test-Suite** — Typecheck + Lint sind die Quality Gates
- **Kein Resource-Subscribe** — zu niche, kaum Server bieten's an

## Deployment: GitHub Pages

Einen Klick entfernt, sobald dein Repo auf GitHub liegt:

1. Neues **public** Repo auf GitHub anlegen (Name egal, z.B. `mcp-playground`)
2. Code pushen:
   ```bash
   git remote add origin https://github.com/<user>/<repo>.git
   git push -u origin main
   ```
3. In den Repo-Settings unter **Settings → Pages**:
   - **Source**: `GitHub Actions` auswählen
4. Der mitgelieferte Workflow `.github/workflows/deploy-pages.yml` läuft beim nächsten Push automatisch. Nach ~1–2 Minuten ist die App online auf
   `https://<user>.github.io/<repo>/`.

**Wichtig: Was in der GitHub-Pages-Version funktioniert (und was nicht):**

- ✅ Alle UI-Features (Tools/Resources/Prompts Explorer, History, OAuth-Flow,
  JSON-Tree, Dark Mode, Session-Persistenz)
- ✅ MCP-Server die **CORS** für Browser erlauben (typische public MCP-Server für
  Web-Clients, die der Spec folgen)
- ✅ OAuth 2.1 — der Auth-Server muss ebenfalls CORS für Browser unterstützen
  (das ist per MCP-Auth-Spec der Default)
- ❌ MCP-Server **ohne CORS** — werden vom Browser geblockt. Für die gibt's den
  Dev-Proxy in `bun run dev` lokal. Beispiel: DeepWiki (`mcp.deepwiki.com/mcp`)
  setzt keine CORS-Header → geht nur lokal.

**Routing** läuft auf GitHub Pages per Hash (`#/s/<server-url>`), damit es ohne
SPA-Fallback-Config auf jedem Static-Host funktioniert. Browser-Back/Forward
funktioniert natürlich.

**Custom Domain**: wenn du eine eigene Domain per Pages-Einstellung anschließt, editier
`.github/workflows/deploy-pages.yml` und setz `BASE_PATH: /` — dann fallen die
Repo-Subpath-Prefixe im Asset-Loading weg.

## Lokal entwickeln vs. deployed

| Scenario | Lokal (`bun run dev`) | GitHub Pages |
|---|---|---|
| MCP-Server mit CORS | ✅ | ✅ |
| MCP-Server ohne CORS | ✅ (Dev-Proxy) | ❌ (Browser-CORS-Block) |
| SSRF-Härtung | ✅ | — (nicht nötig, kein Backend) |
| OAuth Discovery/DCR | ✅ (proxied) | ✅ (direkt, wenn AS CORS hat) |
| URL-Stil | `/s/<url>` | `#/s/<url>` |

## Lizenz

MIT — siehe [LICENSE](./LICENSE). Built by [@shroomlife](https://github.com/shroomlife).
