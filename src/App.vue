<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { Loader2 } from 'lucide-vue-next'
import { useMcpPlayground } from '~/composables/useMcpPlayground'
import { useAuthConfig } from '~/composables/useAuthConfig'
import { useSessionState } from '~/composables/useSessionState'
import ConnectionForm from '~/components/ConnectionForm.vue'
import ConnectedHeader from '~/components/ConnectedHeader.vue'
import ServerInstructions from '~/components/ServerInstructions.vue'
import InspectorPanels from '~/components/InspectorPanels.vue'
import ErrorPanel from '~/components/ErrorPanel.vue'
import AuthConfigPanel from '~/components/AuthConfigPanel.vue'
import RecentServers from '~/components/RecentServers.vue'
import ServerRegistry from '~/components/ServerRegistry.vue'
import ThemeToggle from '~/components/ThemeToggle.vue'
import ElicitationDialog from '~/components/ElicitationDialog.vue'
import { useTheme } from '~/composables/useTheme'
import { consumePendingCallback } from '~/composables/useOAuth'
import { useRouter, type RouteState } from '~/composables/useRouter'
import { useServerHistory } from '~/composables/useServerHistory'
import { stashRecipe } from '~/composables/useRecipeInbox'
import type { AuthHeader, TransportKind } from '~/composables/useMcpPlayground'

const playground = useMcpPlayground()
const {
  state,
  errorDetails,
  url,
  transportKind,
  latencyMs,
  server,
  tools,
  resources,
  resourceTemplates,
  prompts,
  log,
  callHistory,
  capabilityList,
  counts,
  connect,
  disconnect,
  retryWithOtherTransport,
  callTool,
  readResource,
  getPrompt,
  beginOAuth,
  traceEntries,
  sendCustomRequest,
} = playground

function handleBeginOAuth(nextUrl: string, transport: TransportKind) {
  void beginOAuth(nextUrl, transport)
}

function handleAuthReconnect() {
  if (!url.value) return
  void connect(url.value, transportKind.value, auth.headers.value)
}

const auth = useAuthConfig()
const session = useSessionState()
const router = useRouter()
const serverHistory = useServerHistory()
// Initialize theme (applies class on <html> + wires the toggle singleton).
useTheme()

// Touch the server history whenever a handshake completes, so the Landing page can
// surface "zuletzt verbunden" in newest-first order. Survives across tabs/sessions.
watch(
  () => state.value,
  (next) => {
    if (next === 'connected' && url.value) {
      serverHistory.touch(url.value, transportKind.value, server.value?.name)
    }
  },
)

// If the browser returned from an OAuth redirect, consume the code and rewrite the URL
// to the proper /s/<mcpUrl> form so the watcher below sees a clean server-route.
const oauthCallback = consumePendingCallback()
if (oauthCallback) {
  router.replaceWithServer(oauthCallback.mcpUrl, oauthCallback.transport)
}

// Pre-seed the form URL so Landing already shows the remembered URL during reconnect.
if (router.current.value.path === 'server' && router.current.value.mcpUrl) {
  url.value = router.current.value.mcpUrl
  transportKind.value = router.current.value.transport ?? 'http'
} else if (session.url.value && !url.value) {
  url.value = session.url.value
  transportKind.value = session.transport.value
}

const isConnected = computed(() => state.value === 'connected')

// When the URL targets a specific server (direct visit, OAuth return, F5 on a connection),
// we don't want the Landing form to briefly flash before the handshake starts.
// Instead render a stable "restoring" placeholder while the connection settles.
const isRestoring = computed(() => {
  const r = router.current.value
  if (state.value === 'connected' || state.value === 'error') return false
  return r.path === 'server' || r.path === 'oauth-callback'
})

const isLanding = computed(() => !isConnected.value && !isRestoring.value)
const bearerToken = computed(() => auth.getBearerToken())

const activeAuthCount = computed(() => {
  return auth.headers.value.filter((h) => h.key.trim() && h.value).length
})

/**
 * Bring the connection in line with the current route. Called on mount (with the
 * optional OAuth authorization code) and by the router watcher for Back/Forward.
 */
async function syncToRoute(route: RouteState, authCode?: string) {
  if (route.path === 'oauth-callback') {
    // If we got here with an unresolved callback URL (state mismatch or direct visit),
    // just go back to landing — nothing actionable to do.
    router.replaceWithLanding()
    return
  }
  if (route.path === 'landing') {
    if (state.value !== 'idle') {
      session.clearConnection()
      await disconnect()
    }
    return
  }
  if (route.path === 'server' && route.mcpUrl) {
    const t: TransportKind = route.transport ?? 'http'
    const recipe = route.recipe
    if (recipe) {
      // Preselect the recipe's tool + stash its args for the about-to-mount ToolDetail.
      session.toolName.value = recipe.toolName
      session.tab.value = 'tools'
      if (recipe.args) stashRecipe(recipe.toolName, recipe.args)
      // Strip the recipe from the URL so browser-refresh doesn't re-apply it.
      router.replaceWithServer(route.mcpUrl, t)
    }
    const alreadyThere =
      state.value === 'connected' &&
      url.value === route.mcpUrl &&
      transportKind.value === t
    if (alreadyThere) return
    session.url.value = route.mcpUrl
    session.transport.value = t
    auth.loadForUrl(route.mcpUrl)
    await connect(route.mcpUrl, t, auth.headers.value, authCode)
  }
}

onMounted(() => {
  // One-shot consume of the OAuth code for the *initial* connect attempt.
  void syncToRoute(router.current.value, oauthCallback?.code)
})

watch(
  () => router.current.value,
  (route) => {
    void syncToRoute(route)
  },
)

function handleUrlChange(nextUrl: string) {
  auth.loadForUrl(nextUrl)
}

function handleConnect(nextUrl: string, transport: TransportKind, _authHeaders: AuthHeader[]) {
  // Auth headers come from `auth.headers` (loaded per URL from localStorage); the
  // emit parameter is kept for signature parity with ConnectionForm. Route change
  // triggers syncToRoute which runs connect(). New history entry means Back → Landing.
  session.url.value = nextUrl
  session.transport.value = transport
  auth.loadForUrl(nextUrl)
  router.navigateToServer(nextUrl, transport)
}

function handleRetry() {
  if (!url.value) return
  void connect(url.value, transportKind.value, auth.headers.value)
}

function handleTryOther() {
  void retryWithOtherTransport()
}

// Mirror any transport change (including from retryWithOtherTransport) into the session.
// Also keep the URL in sync when the composable's transport changes internally.
watch(transportKind, (next) => {
  session.transport.value = next
  if (state.value === 'connected' && url.value) {
    router.replaceWithServer(url.value, next)
  }
})

function handleDisconnect() {
  session.clearConnection()
  router.navigateToLanding()
  // syncToRoute via watcher will call disconnect().
}
</script>

<template>
  <div class="relative min-h-screen">
    <!-- Gradient background — full on landing, fades when connected; dimmed in dark mode -->
    <div
      aria-hidden="true"
      class="pointer-events-none fixed inset-0 transition-opacity duration-500 gradient-bg"
      :class="isLanding ? 'opacity-100 dark:opacity-60' : 'opacity-25 dark:opacity-15'"
    >
      <div class="absolute inset-0 bg-bg" />
      <div class="absolute inset-0 gradient-blobs" />
      <div
        class="absolute inset-0 opacity-[0.035] mix-blend-multiply dark:opacity-0"
        style="
          background-image: url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22160%22 height=%22160%22><filter id=%22n%22><feTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22 numOctaves=%222%22 stitchTiles=%22stitch%22/></filter><rect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22 opacity=%220.6%22/></svg>');
        "
      />
    </div>

    <!-- Restoring placeholder: shown briefly when returning to a /s/<url> route
         (direct visit, F5, or OAuth callback) so the Landing form never flashes. -->
    <template v-if="isRestoring">
      <header
        class="relative z-10 flex items-center justify-between px-6 md:px-10 py-5"
      >
        <div class="flex items-center gap-2.5">
          <div class="size-2 rounded-full bg-accent" />
          <span class="text-[13px] font-medium text-fg">MCP Playground</span>
        </div>
        <ThemeToggle />
      </header>

      <main class="relative z-10 min-h-[calc(100vh-5rem)] flex items-center justify-center px-6 pb-12">
        <div class="flex flex-col items-center gap-3 text-center">
          <Loader2 :size="22" class="animate-spin text-accent" />
          <div>
            <div class="text-[14px] font-medium text-fg">
              {{ router.current.value.path === 'oauth-callback'
                ? 'Authentifizierung wird abgeschlossen …'
                : 'Verbinde …' }}
            </div>
            <div
              v-if="url"
              class="mt-1 font-mono text-[12px] text-fg-muted max-w-[32rem] break-all"
            >
              {{ url }}
            </div>
          </div>
        </div>
      </main>
    </template>

    <!-- Landing: centered form -->
    <template v-else-if="isLanding">
      <header
        class="relative z-10 flex items-center justify-between px-6 md:px-10 py-5"
      >
        <div class="flex items-center gap-2.5">
          <div class="size-2 rounded-full bg-accent" />
          <span class="text-[13px] font-medium text-fg">MCP Playground</span>
        </div>
        <div class="flex items-center gap-3">
          <div class="flex items-center gap-2 text-[12px] text-fg-muted">
            <span
              class="size-1.5 rounded-full"
              :class="{
                'bg-fg-subtle': state === 'idle',
                'bg-warning pulse-dot': state === 'connecting',
                'bg-danger pulse-dot': state === 'error',
              }"
            />
            <span class="font-mono">
              {{
                state === 'idle' ? 'bereit'
                  : state === 'connecting' ? 'verbindet'
                    : 'fehler'
              }}
            </span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main
        class="relative z-10 min-h-[calc(100vh-5rem)] flex items-center justify-center px-6 pb-12"
      >
        <div class="w-full max-w-[640px]">
          <div class="text-center mb-8">
            <h1 class="text-[34px] md:text-[40px] font-semibold tracking-tight text-fg leading-[1.1]">
              Einen MCP-Server kennenlernen
            </h1>
            <p class="text-[14px] text-fg-2 mt-3 max-w-[460px] mx-auto">
              Ein kleines Werkzeug für das Model Context Protocol.
              URL eintragen, verbinden, Tools &amp; Resources erkunden.
            </p>
          </div>

          <div class="bg-surface/90 backdrop-blur-sm border border-border rounded-xl p-6 shadow-[0_8px_40px_-20px_rgba(0,0,0,0.12)]">
            <ConnectionForm
              :state="state"
              :initial-url="url"
              :auth-headers="auth.headers.value"
              :bearer-token="bearerToken"
              :on-begin-o-auth="handleBeginOAuth"
              @connect="handleConnect"
              @url-change="handleUrlChange"
              @update:bearer="(t: string) => auth.setBearer(t)"
              @update-header="(i: number, h: AuthHeader) => auth.updateHeader(i, h)"
              @add-header="() => auth.addHeader()"
              @remove-header="(i: number) => auth.removeHeader(i)"
              @clear-auth="() => auth.clear()"
            />
          </div>

          <div
            v-if="state === 'connecting'"
            class="mt-5 flex items-center justify-center gap-2 text-[13px] text-fg-muted"
          >
            <Loader2 :size="14" class="animate-spin" />
            <span>Handshake läuft — Capabilities werden abgefragt …</span>
          </div>

          <Transition name="fade">
            <div v-if="state === 'error' && errorDetails" class="mt-5">
              <ErrorPanel
                :details="errorDetails"
                @retry="handleRetry"
                @try-other="handleTryOther"
              />
            </div>
          </Transition>

          <RecentServers
            @select="(u, t) => handleConnect(u, t, auth.headers.value)"
          />

          <ServerRegistry
            @select="(u, t) => handleConnect(u, t, auth.headers.value)"
          />

          <div class="mt-10 pt-6 border-t border-border text-center space-y-3">
            <div class="text-[11px] uppercase tracking-wide text-fg-muted font-medium">
              Erfahre mehr über MCP
            </div>
            <div class="flex items-center justify-center gap-4 flex-wrap text-[12px]">
              <a
                href="https://modelcontextprotocol.io/"
                target="_blank"
                rel="noopener noreferrer"
                class="focus-ring text-accent hover:underline"
              >modelcontextprotocol.io ↗</a>
              <a
                href="https://modelcontextprotocol.io/specification"
                target="_blank"
                rel="noopener noreferrer"
                class="focus-ring text-accent hover:underline"
              >Spec ↗</a>
              <a
                href="https://github.com/modelcontextprotocol/servers"
                target="_blank"
                rel="noopener noreferrer"
                class="focus-ring text-accent hover:underline"
              >Server-Katalog ↗</a>
              <a
                href="https://github.com/shroomlife/mcp-playground"
                target="_blank"
                rel="noopener noreferrer"
                class="focus-ring text-accent hover:underline"
              >Dieses Repo ↗</a>
            </div>
            <div class="text-[11px] text-fg-subtle">
              Tailwind v4 · Vue 3.5 · Reka UI · MCP SDK
            </div>
          </div>
        </div>
      </main>
    </template>

    <!-- Connected: header + explorer -->
    <template v-else>
      <ConnectedHeader
        :server="server"
        :capabilities="capabilityList"
        :latency-ms="latencyMs"
        :counts="counts"
        :url="url"
        :transport="transportKind"
        :auth-header-count="activeAuthCount"
        @disconnect="handleDisconnect"
      />

      <main class="relative z-10 mx-auto max-w-[1200px] px-4 md:px-8 py-6 md:py-8 space-y-5">
        <ServerInstructions
          v-if="server?.instructions"
          :instructions="server.instructions"
        />

        <!-- Auth nachträglich setzen / OAuth-Flow starten, ohne Disconnect -->
        <AuthConfigPanel
          :headers="auth.headers.value"
          :bearer-token="bearerToken"
          :disabled="state === 'connecting'"
          :url="url"
          can-reconnect
          :on-begin-o-auth="() => handleBeginOAuth(url, transportKind)"
          @update:bearer="(t: string) => auth.setBearer(t)"
          @update-header="(i: number, h: AuthHeader) => auth.updateHeader(i, h)"
          @add-header="() => auth.addHeader()"
          @remove-header="(i: number) => auth.removeHeader(i)"
          @clear="() => auth.clear()"
          @oauth-cleared="handleAuthReconnect"
          @reconnect="handleAuthReconnect"
        />

        <InspectorPanels
          :tools="tools"
          :resources="resources"
          :resource-templates="resourceTemplates"
          :prompts="prompts"
          :log="log"
          :call-history="callHistory"
          :trace-entries="traceEntries"
          :is-connected="isConnected"
          :run-tool="callTool"
          :run-prompt="getPrompt"
          :read-resource="readResource"
          :send-custom-request="sendCustomRequest"
        />
      </main>
    </template>

    <!-- Global: shown whenever the server sends an elicitation/create request -->
    <ElicitationDialog />
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 180ms ease, transform 180ms ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(4px);
}
</style>
