# MCP Playground — Browser-Client für Model-Context-Protocol-Server

> Teste jeden **Model-Context-Protocol**-Server direkt im Browser: Tools ausführen,
> Resources lesen, Prompts ansehen, OAuth-Login, JSON-RPC-Trace — ohne CLI,
> ohne lokale Installation.

[![CI](https://github.com/shroomlife/mcp-playground/actions/workflows/ci.yml/badge.svg)](https://github.com/shroomlife/mcp-playground/actions/workflows/ci.yml)
[![Deploy to GitHub Pages](https://github.com/shroomlife/mcp-playground/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/shroomlife/mcp-playground/actions/workflows/deploy-pages.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Live Demo](https://img.shields.io/badge/live-shroomlife.github.io-6366f1)](https://shroomlife.github.io/mcp-playground/)

**Live-Demo → [shroomlife.github.io/mcp-playground](https://shroomlife.github.io/mcp-playground/)** · [Screenshots](#-screenshots) · [Features](#-features) · [Quick Start](#-quick-start) · [FAQ](#-faq)

![MCP Playground — Landing mit URL-Eingabe und Transport-Auswahl](./docs/screenshots/01-landing.png)

---

## Was ist das?

Der **MCP Playground** ist ein Open-Source-Client für das [Model Context Protocol](https://modelcontextprotocol.io/),
der komplett im Browser läuft. Du gibst die URL eines MCP-Servers ein — HTTP-Streamable oder
SSE — und bekommst:

- die vollständige Liste aller **Tools**, **Resources** und **Prompts**, die der Server anbietet,
- ein auto-generiertes **Formular** aus jedem JSON-Schema, damit du Tools **ohne
  Boilerplate** ausführen kannst,
- die komplette **JSON-RPC-Konversation** (Requests, Responses, Notifications) mit
  rpc-id, Size und Timestamp,
- **OAuth 2.1 mit Dynamic Client Registration** — Discovery, PKCE, Token-Refresh
  laufen automatisch,
- **direkten Export** des Servers in die `.mcp.json` von Claude Code, Cursor, VS Code
  oder Windsurf.

Kein Backend. Keine Telemetrie. Nur ein Vite-Build auf GitHub Pages.

## 🎯 Für wen?

- **MCP-Entwickler** — schneller iterieren als mit MCP-Inspector, stdio oder curl-Skripten.
- **Claude-Code-Nutzer** — Server verifizieren, bevor du ihn in `.mcp.json` einträgst.
- **Agenten-Autoren** — Prompts + Elicitation-Flows durchspielen, bevor sie in
  der Produktion landen.
- **Evaluatoren** — public MCP-Server (DeepWiki, Hugging Face MCP, Custom-Server)
  unkompliziert ausprobieren.

## 📸 Screenshots

### Connected-View — Tools/Resources/Prompts als Tabs

![MCP Playground Connected-View mit Tool-Liste, Argumenten-Form und Tab-Navigation](./docs/screenshots/02-connected-tools.png)

### Tool-Call mit strukturiertem Ergebnis-Tree

![Tool-Call Ergebnis mit Pretty/Explorer/Raw-Ansicht und Filter](./docs/screenshots/03-tool-result.png)

### Capability-Tabs (experimental / extensions)

![Experimental-Tab zeigt vom Server deklarierte Vendor-Features oder Empty-State](./docs/screenshots/04-experimental-tab.png)

### JSON-RPC Wire-Trace fürs Debugging

![JSON-RPC Trace Panel mit jeder Request/Response inklusive Method, ID, Size und Dauer](./docs/screenshots/05-rpc-trace.png)

## ✨ Features

### Verbinden & Authentifizieren

- 🔌 **HTTP Streamable oder SSE** mit OAuth 2.1, Bearer-Token oder Custom Auth-Headern
- 🔐 **OAuth 2.1 + Dynamic Client Registration** — Discovery (RFC 9728 + RFC 8414),
  DCR (RFC 7591), PKCE, Token-Refresh. Kein manuelles Client-Setup, einfach
  "Anmelden" klicken
- 🔑 **Token-Inspektor** nach OAuth-Login — Access-/Refresh-Token, Scope, Client-ID,
  Ablauf-Countdown, fertiger `curl`-Aufruf (Token standardmäßig maskiert,
  bewusstes Copy mit Warnhinweis)
- 🧭 **Server-Preview** auf der Landing — leichtgewichtiger `initialize`-Probe
  zeigt Name, Version und Auth-Mode, bevor du überhaupt verbindest
- 📚 **Zuletzt verbunden** — Server-History mit 1-Klick-Reconnect
  (cross-tab, `localStorage`)

### Erkunden & Ausführen

- 🔍 **Split-View Explorer** für Tools/Resources/Prompts — durchsuchbare Listen,
  Descriptions, Schemas, Ausführung inline in der Detail-Pane
- 🗂️ **Capabilities als Tabs** — `tools` / `resources` / `prompts` immer da,
  `experimental` + `extensions` erscheinen dynamisch mit den vom Server
  deklarierten Feature-Keys (inklusive Empty-State)
- ▶️ **Form → Run → Result → History** in einem Flow — kein Modal-Hopping
- 📡 **Live-Progress & Cancel** — Server-Progress-Notifications als Balken,
  Stop-Button für laufende Calls (via `AbortController`)
- 🌳 **3-Modi Result-Viewer** — Pretty (gerenderte Content-Blocks) / Explorer
  (Tree mit Such-Filter) / Raw (JSON-Text + Copy). Default wechselt automatisch
  auf Explorer bei JSON-Payloads
- 🧪 **Tool-History pro Tool** — alte Args per Klick zurück ins Formular laden
- 🗂️ **URI-Templates** (`/users/{id}`) mit automatischen Platzhalter-Inputs

### Debugging & Power-User

- 📻 **JSON-RPC Wire-Trace Panel** — jede Request / Response / Error / Notification
  inkl. rpc-id, Richtung, Method, Size, Timestamp. Durchsuchbar, ein-/ausklappbar
- ✏️ **Manual JSON-RPC Sender** — beliebige Methoden manuell ansteuern (ping,
  tools/call, logging/setLevel, completion/complete, …) mit Methoden-Autocomplete
- 💬 **Elicitation-Support** — MCP-Elicitation-Requests werden als Dialog angezeigt
  (Form + URL-Mode), Antwort geht zurück an den Server
- 💾 **Saved Fixtures** — Tool-Calls als Presets speichern und per Klick replayen
- 📝 **Server-Logs inline** — `notifications/message` mit SERVER/CLIENT-Kennzeichnung
- 🔄 **Auto-Refresh** bei `list_changed`-Notifications
- 🔗 **Recipe-URLs** — "Share"-Button auf jedem Tool erzeugt eine URL mit
  vorgefüllten Args. Empfänger kommt mit Formular schon befüllt an

### Install & Deploy

- 📦 **Multi-Client Install** — Claude Code, Cursor, VS Code, Windsurf. Für
  Claude Code direktes Schreiben in `.mcp.json` via File-System-Access-API,
  sonst Snippet-Copy
- 🔐 **Auth in `.mcp.json` übernehmen** — OAuth-Token oder Bearer werden als
  `Authorization: Bearer ${ENV_VAR}` geschrieben (Default, sicher, kein Token im
  committed File) oder optional inline mit Warn-Alert
- 🔖 **URL-Routing** — jeder Server hat eine eigene URL
  (`#/s/mcp.deepwiki.com/mcp`), Browser-Back/Forward funktioniert, URLs sind
  shareable

### DX / UX

- 🌓 **Dark Mode** mit System-Hint, Toggle-Button, persistiert pro Browser
- 💾 **Session-Persistenz** — Tab, Selection, Suche bleiben beim F5 erhalten.
  Server-Wechsel resettet State, damit keine alten Artefakte hängen bleiben
- ⌨️ **Keyboard-Nav** — `/` fokussiert Suche, Arrow-Keys navigieren die Listen
- 🔐 **SSRF-gehärteter Dev-Proxy** — Cloud-Metadata + Loopback + RFC-1918-Ranges
  geblockt, strikte Header-Kontrolle, Connect-Timeout. Nur für `bun run dev`

## 🚀 Quick Start

```bash
git clone https://github.com/shroomlife/mcp-playground.git
cd mcp-playground
bun install
bun run dev
```

Standardmäßig auf **[http://localhost:5775](http://localhost:5775)**. URL des
MCP-Servers eintragen, Transport wählen, verbinden.

**Zum Ausprobieren:** `https://mcp.deepwiki.com/mcp` (HTTP, kein Auth) — auf der
Landing schon als Beispiel-Button vorbereitet.

Oder nimm die [Live-Version auf GitHub Pages](https://shroomlife.github.io/mcp-playground/) —
kein Setup nötig.

## 🧰 Commands

| Script | Zweck |
|---|---|
| `bun run dev` | Vite dev-server + eingebauter MCP-Proxy (Port 5775) |
| `bun run typecheck` | `vue-tsc --noEmit` |
| `bun run lint` | ESLint v10 (flat config, `strict`-Preset) |
| `bun run lint:fix` | Auto-fix wo möglich |
| `bun run build` | Typecheck + Vite production build |
| `bun run preview` | Lokale Preview des Builds |

## 🧬 Tech-Stack

- **[Vue 3.5](https://vuejs.org/)** mit `<script setup>` + TypeScript strict
- **[Tailwind v4](https://tailwindcss.com/)** (CSS-first `@theme`, keine `tailwind.config.js`)
- **[Reka UI](https://reka-ui.com/)** für Tabs / Accordion / Dialog / Tooltip (headless, a11y)
- **[@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk)** als Client
- **[Vite 6](https://vitejs.dev/)** + **[Bun](https://bun.sh/)** als Runtime

## 🏗️ Architektur — wie das alles zusammenhängt

- **Nur Browser + optionaler Dev-Proxy** — keine Server-Logik. Der Vite-Proxy
  (in `bun run dev`) leitet Requests an MCP-Ziele weiter, wenn der Target-Server
  keine CORS-Header setzt.
- **Der Proxy ist SSRF-gehärtet**: Cloud-Metadata-IPs + Loopback + alle
  RFC-1918-Private-Ranges + IPv6-Link-Local/ULA geblockt. Request-Header
  werden auf eine enge Allowlist gestutzt. SSE-Auth läuft über einen
  `x-mcp-forward-headers` Seitenkanal (weil `EventSource` keine Custom-Header
  setzen kann).
- **Auth-Tokens**: OAuth-Tokens in `sessionStorage` (stirbt mit dem Tab),
  manueller Bearer/Custom-Header in `localStorage` pro URL.
- **Session-State im `sessionStorage`** — was du gerade tust, überlebt den
  Page-Reload; beim Server-Wechsel wird alles resettet.
- Details zur Architektur, Konventionen und Gotchas stehen in [`CLAUDE.md`](./CLAUDE.md).

## 🚫 Was der Playground *nicht* tut (bewusst)

- **Kein Sampling** — der Inspector ist kein LLM-Host
- **Keine Server-Implementierung** — nur Client / Explorer
- **Keine Test-Suite** — Typecheck + Lint sind die Quality Gates
- **Keine Server-Discovery-Verzeichnisse** — wir linken nicht auf unbekannte Public-Server,
  jeder bringt seine URL selbst mit

## 🌐 Deployment: GitHub Pages in 2 Minuten

1. Neues **public** Repo auf GitHub anlegen (Name egal, z.B. `mcp-playground`)
2. Code pushen:
   ```bash
   git remote add origin https://github.com/<user>/<repo>.git
   git push -u origin main
   ```
3. Repo-Settings → **Pages** → Source: `GitHub Actions` auswählen
4. Der mitgelieferte Workflow `.github/workflows/deploy-pages.yml` läuft beim
   nächsten Push automatisch. Nach ~1-2 Minuten ist die App online auf
   `https://<user>.github.io/<repo>/`.

### Lokal vs. Deployed — was funktioniert wo?

| Szenario | Lokal (`bun run dev`) | GitHub Pages |
|---|---|---|
| MCP-Server **mit** CORS | ✅ | ✅ |
| MCP-Server **ohne** CORS | ✅ (Dev-Proxy) | ❌ (Browser-CORS-Block) |
| SSRF-Härtung | ✅ | — (nicht nötig, kein Backend) |
| OAuth 2.1 + DCR | ✅ (proxied) | ✅ (direkt, wenn AS CORS hat) |
| URL-Stil | `/s/<url>` | `#/s/<url>` |

**Routing** läuft auf GitHub Pages per Hash (`#/s/<server-url>`), damit es ohne
SPA-Fallback-Config auf jedem Static-Host funktioniert. Browser-Back/Forward
funktioniert natürlich.

**Custom Domain**: wenn du eine eigene Domain per Pages-Einstellung anschließt,
editier `.github/workflows/deploy-pages.yml` und setz `BASE_PATH: /` — dann
fallen die Repo-Subpath-Prefixe im Asset-Loading weg.

## ❓ FAQ

### Ist das ein offizielles Anthropic-Tool?

Nein. Das ist ein unabhängiges Open-Source-Projekt, gebaut auf dem offiziellen
[@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk).

### Ist das ein Ersatz für MCP Inspector?

Ergänzung. Der MCP Inspector läuft als CLI und ist stark auf stdio-Transports
ausgelegt. Der Playground ist reine Browser-UI mit Fokus auf **HTTP/SSE**-Server
und **OAuth-Flows** — komplementär.

### Werden meine Tokens irgendwo hochgeladen?

Nein. Alles bleibt im Browser. OAuth-Tokens in `sessionStorage`, manuelle
Bearer/Custom-Header in `localStorage`. Kein Backend, keine Telemetrie, kein
Google Analytics. Der Source ist auditierbar.

### Warum scheitert mein lokaler MCP-Server auf der GitHub-Pages-Version?

Zwei häufige Gründe:
- **CORS**: dein Server sendet keinen `Access-Control-Allow-Origin`-Header. Auf
  GitHub Pages gibt's keinen Dev-Proxy, der das umgeht. Lösung: `bun run dev`
  lokal, oder CORS auf deinem Server aktivieren.
- **HTTP statt HTTPS**: die Pages-Version läuft auf HTTPS, Mixed-Content blockiert
  `http://localhost:xxx`. Lokal hosten.

### Kann ich das Tool self-hosten?

Ja. Das ist ein statischer Vite-Build — `bun run build` → `dist/` auf irgendeinen
Static-Host (Nginx, S3, Cloudflare Pages, Netlify, Vercel). Siehe oben:
`BASE_PATH`-Anpassung für Custom-Domain.

### Unterstützt ihr Resource-Subscriptions?

Aktuell nicht. Der MCP-Spec erlaubt `resources.subscribe` für Live-Updates auf
einzelne URIs, aber kaum ein produktiver Server bietet das an. Wenn du's
brauchst — Issue oder PR.

## 🔗 Links

- 🌐 [modelcontextprotocol.io](https://modelcontextprotocol.io/) — Offizielle
  MCP-Seite
- 📖 [MCP-Spec](https://modelcontextprotocol.io/specification)
- 🗂️ [Offizieller MCP-Server-Katalog](https://github.com/modelcontextprotocol/servers)
- 📦 [TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- 🧩 [Claude Code MCP-Docs](https://docs.claude.com/en/docs/claude-code/mcp) —
  so wird `.mcp.json` konsumiert

## 🤝 Mitmachen

Issues und PRs sind willkommen. Bevor du codest: bitte [`CLAUDE.md`](./CLAUDE.md)
anschauen — dort stehen die Architektur-Entscheidungen, Konventionen und die
Release-Choreografie.

## 📄 Lizenz

MIT — siehe [LICENSE](./LICENSE). Built by [@shroomlife](https://github.com/shroomlife).
