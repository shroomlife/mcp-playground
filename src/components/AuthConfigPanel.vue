<script setup lang="ts">
import { ref, computed, onBeforeUnmount, watch } from 'vue'
import {
  AccordionRoot,
  AccordionItem,
  AccordionHeader,
  AccordionTrigger,
  AccordionContent,
} from 'reka-ui'
import {
  AlertTriangle,
  ChevronDown,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LogIn,
  LogOut,
  Plus,
  RotateCw,
  ShieldOff,
  X,
  ShieldAlert,
} from 'lucide-vue-next'
import { clearOAuth, hasOAuthTokens, probeOAuthSupport } from '~/composables/useOAuth'
import type { OAuthProbeResult } from '~/composables/useOAuth'
import type { AuthHeader } from '~/composables/useMcpPlayground'

const props = defineProps<{
  headers: AuthHeader[]
  bearerToken: string
  disabled?: boolean
  reconnecting?: boolean
  url?: string
  canReconnect?: boolean
  onBeginOAuth?: () => void | Promise<void>
}>()

const emit = defineEmits<{
  'update:bearer': [token: string]
  'update-header': [index: number, header: AuthHeader]
  'add-header': []
  'remove-header': [index: number]
  clear: []
  'oauth-cleared': []
  reconnect: []
}>()

// hasOAuthTokens reads sessionStorage directly — Vue can't see that. We track a
// local tick so the computed recomputes after logout. Tokens are only *saved* during
// the OAuth callback flow, which arrives via a full page reload — so the initial
// read on mount is always fresh.
const oauthTick = ref(0)
const oauthActive = computed(() => {
  // Track the tick as a reactive dep so logoutOAuth below forces a recompute.
  const _tick = oauthTick.value
  void _tick
  const u = props.url?.trim()
  return Boolean(u) && hasOAuthTokens(u as string)
})

function logoutOAuth() {
  if (!props.url) return
  clearOAuth(props.url)
  oauthTick.value += 1
  emit('oauth-cleared')
}

const oauthError = ref<string | null>(null)
const oauthPending = ref(false)

async function startOAuth() {
  if (!props.onBeginOAuth || oauthPending.value) return
  oauthError.value = null
  oauthPending.value = true
  try {
    await props.onBeginOAuth()
    // Success path triggers a browser redirect — we may not reach this line.
  } catch (err) {
    // Keep the error LOCAL to the component so the surrounding view (Connected /
    // Landing) doesn't get pushed into a global error state. User can read the
    // reason right next to the button they clicked.
    oauthError.value = err instanceof Error ? err.message : String(err)
  } finally {
    oauthPending.value = false
  }
}

function dismissOAuthError() {
  oauthError.value = null
}

const canStartOAuth = computed(
  () => Boolean(props.url?.trim()) && Boolean(props.onBeginOAuth) && !oauthActive.value,
)

// Proactive OAuth-Capability probe: we don't want the "Anmelden"-Button to be a
// dead-end for servers that don't publish OAuth metadata.
type ProbeState = 'idle' | 'checking' | 'supported' | 'unsupported'
const probeState = ref<ProbeState>('idle')
const probeResult = ref<OAuthProbeResult | null>(null)
const showProbeDetails = ref(false)
let probeAbort: AbortController | null = null
let probeTimer: ReturnType<typeof setTimeout> | null = null

function cancelProbe() {
  probeAbort?.abort()
  probeAbort = null
  if (probeTimer) {
    clearTimeout(probeTimer)
    probeTimer = null
  }
}

watch(
  () => props.url,
  (nextUrl) => {
    cancelProbe()
    const trimmed = nextUrl?.trim() ?? ''
    if (!trimmed || !props.onBeginOAuth) {
      probeState.value = 'idle'
      probeResult.value = null
      return
    }
    // Debounce so typing in the URL field doesn't fire a probe per keystroke.
    probeTimer = setTimeout(() => {
      const controller = new AbortController()
      probeAbort = controller
      probeState.value = 'checking'
      probeResult.value = null
      probeOAuthSupport(trimmed, controller.signal)
        .then((result) => {
          if (controller.signal.aborted) return
          probeResult.value = result
          probeState.value = result.supported ? 'supported' : 'unsupported'
        })
        .catch(() => {
          if (controller.signal.aborted) return
          probeResult.value = null
          probeState.value = 'unsupported'
        })
    }, 400)
  },
  { immediate: true },
)

onBeforeUnmount(cancelProbe)

// Derive a single reason for why OAuth looks unavailable. Priority: CORS wins
// because it's the most actionable (server admin fixes it) and easiest to miss.
type UnsupportedReason = 'cors' | 'invalid_json' | 'http_error' | 'not_found' | 'unknown'
const unsupportedReason = computed<UnsupportedReason>(() => {
  const result = probeResult.value
  if (!result || result.endpoints.length === 0) return 'unknown'
  if (result.endpoints.some((e) => e.status === 'cors_or_network')) return 'cors'
  if (result.endpoints.some((e) => e.status === 'invalid_json')) return 'invalid_json'
  if (result.endpoints.some((e) => e.status === 'http_error')) return 'http_error'
  if (result.endpoints.every((e) => e.status === 'not_found')) return 'not_found'
  return 'unknown'
})

function endpointPath(url: string): string {
  try {
    return new URL(url).pathname
  } catch {
    return url
  }
}

const endpointStatusLabel: Record<string, string> = {
  ok: 'OK (200 + JSON)',
  not_found: 'nicht gefunden',
  http_error: 'HTTP-Fehler',
  cors_or_network: 'CORS oder Netzwerk',
  invalid_json: 'kein gültiges JSON',
  url_invalid: 'URL ungültig',
}

const expanded = ref<string[]>([])
const showBearer = ref(false)
const visibleValueIndexes = ref<Set<number>>(new Set())

const activeCount = computed(() => {
  const bearerActive = props.bearerToken.trim().length > 0 ? 1 : 0
  const customActive = props.headers.filter(
    (h) => h.key.trim().toLowerCase() !== 'authorization' && h.key.trim() && h.value,
  ).length
  return bearerActive + customActive
})

const customHeaders = computed(() =>
  props.headers
    .map((header, index) => ({ header, index }))
    .filter(
      ({ header }) => header.key.trim().toLowerCase() !== 'authorization',
    ),
)

function toggleValueVisibility(index: number) {
  const next = new Set(visibleValueIndexes.value)
  if (next.has(index)) {
    next.delete(index)
  } else {
    next.add(index)
  }
  visibleValueIndexes.value = next
}

function updateKey(index: number, key: string) {
  const current = props.headers[index]
  if (!current) return
  emit('update-header', index, { key, value: current.value })
}

function updateValue(index: number, value: string) {
  const current = props.headers[index]
  if (!current) return
  emit('update-header', index, { key: current.key, value })
}
</script>

<template>
  <AccordionRoot
    v-model="expanded"
    type="multiple"
    class="bg-surface-2/40 border border-border rounded-lg overflow-hidden"
  >
    <AccordionItem value="auth" class="group">
      <AccordionHeader as-child>
        <AccordionTrigger
          class="focus-ring w-full flex items-center gap-2 px-3.5 py-2.5 text-[12.5px] text-fg-2 hover:text-fg transition-colors"
        >
          <KeyRound :size="13" :stroke-width="1.75" />
          <span class="font-medium">Authentifizierung</span>
          <span
            v-if="oauthActive"
            class="inline-flex items-center gap-1 h-5 px-1.5 bg-accent-soft text-accent rounded text-[10.5px] font-medium"
            title="OAuth-Tokens für diese URL gespeichert"
          >
            <CheckCircle2 :size="10" />
            OAuth
          </span>
          <span
            v-else-if="activeCount > 0"
            class="inline-flex items-center h-5 px-1.5 bg-success-soft text-success rounded text-[10.5px] font-medium"
          >
            {{ activeCount }} aktiv
          </span>
          <span v-else class="text-fg-muted font-normal">(optional)</span>
          <ChevronDown
            :size="13"
            class="ml-auto text-fg-muted transition-transform group-data-[state=open]:rotate-180"
          />
        </AccordionTrigger>
      </AccordionHeader>

      <AccordionContent>
        <div class="p-3.5 pt-0 space-y-3.5 border-t border-border bg-surface">
          <!-- OAuth status (only shown when tokens exist for the current URL) -->
          <div
            v-if="oauthActive"
            class="pt-3.5"
          >
            <div class="flex items-center justify-between gap-2 p-2.5 bg-accent-soft/60 border border-accent/20 rounded-md">
              <div class="flex items-start gap-2 min-w-0">
                <CheckCircle2 :size="14" class="text-accent shrink-0 mt-0.5" />
                <div class="min-w-0">
                  <div class="text-[12px] font-medium text-fg">Über OAuth angemeldet</div>
                  <div class="text-[11px] text-fg-muted mt-0.5">
                    Tokens liegen nur in dieser Browser-Session. Die manuellen Felder unten
                    werden ignoriert, solange OAuth aktiv ist.
                  </div>
                </div>
              </div>
              <button
                type="button"
                :disabled="disabled"
                class="focus-ring shrink-0 inline-flex items-center gap-1.5 h-7 px-2.5 bg-surface border border-border-strong rounded-md text-[11px] text-fg-2 hover:text-danger hover:border-danger/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                @click="logoutOAuth"
              >
                <LogOut :size="11" />
                Abmelden
              </button>
            </div>
          </div>

          <!-- OAuth section (no tokens yet + url present + onBeginOAuth wired) -->
          <div
            v-else-if="canStartOAuth"
            class="pt-3.5 space-y-2"
          >
            <!-- Probe in flight -->
            <div
              v-if="probeState === 'checking'"
              class="flex items-center gap-2 p-2.5 bg-surface-2 border border-border rounded-md text-[11.5px] text-fg-muted"
            >
              <Loader2 :size="12" class="animate-spin shrink-0" />
              <span>OAuth-Support wird geprüft …</span>
            </div>

            <!-- Probe says: OAuth looks unavailable. Which specific reason we show
                 depends on what actually failed — CORS-block gets a distinct
                 treatment because it's an admin-fixable issue, not a missing feature. -->
            <div
              v-else-if="probeState === 'unsupported'"
              class="space-y-2"
            >
              <div
                :class="[
                  'flex items-start gap-2 p-2.5 border rounded-md',
                  unsupportedReason === 'cors'
                    ? 'bg-warning-soft/40 border-warning/30'
                    : 'bg-surface-2 border-border',
                ]"
              >
                <ShieldAlert
                  v-if="unsupportedReason === 'cors'"
                  :size="13"
                  class="text-warning shrink-0 mt-0.5"
                />
                <ShieldOff
                  v-else
                  :size="13"
                  class="text-fg-muted shrink-0 mt-0.5"
                />
                <div class="flex-1 min-w-0 text-[11.5px] leading-[1.4]">
                  <template v-if="unsupportedReason === 'cors'">
                    <span class="font-medium text-fg">OAuth-Metadaten durch CORS blockiert.</span>
                    <span class="text-fg-2">
                      Der Server liefert möglicherweise OAuth, aber der Browser darf
                      <code class="font-mono">.well-known/oauth-*</code> nicht lesen. Auf dem
                      Server <code class="font-mono">Access-Control-Allow-Origin</code> für
                      diese Pfade setzen.
                    </span>
                  </template>
                  <template v-else-if="unsupportedReason === 'invalid_json'">
                    <span class="font-medium text-fg-2">OAuth-Endpoint antwortet, liefert aber kein gültiges JSON.</span>
                    <span class="text-fg-muted"> Server-Logs prüfen — evtl. HTML-Errorseite statt JSON.</span>
                  </template>
                  <template v-else-if="unsupportedReason === 'http_error'">
                    <span class="font-medium text-fg-2">OAuth-Endpoint antwortet mit HTTP-Fehler.</span>
                    <span class="text-fg-muted"> Details unten — 5xx deutet auf Server-Bug, 401/403 auf einen Auth-Wrapper vor der Discovery.</span>
                  </template>
                  <template v-else>
                    <span class="font-medium text-fg-2">Keine OAuth-Anmeldung verfügbar.</span>
                    <span class="text-fg-muted">
                      Der Server stellt keine OAuth-Metadaten bereit
                      (<code class="font-mono">.well-known/oauth-authorization-server</code>).
                      Falls der Server doch Auth braucht, trag einen Bearer-Token oder
                      Custom-Header unten ein.
                    </span>
                  </template>
                </div>
              </div>

              <button
                v-if="probeResult && probeResult.endpoints.length > 0"
                type="button"
                class="focus-ring w-full flex items-center justify-between gap-1.5 px-2.5 py-1.5 bg-surface border border-border rounded-md text-[11px] text-fg-muted hover:text-fg-2 transition-colors"
                :aria-expanded="showProbeDetails"
                @click="showProbeDetails = !showProbeDetails"
              >
                <span>Probe-Details {{ showProbeDetails ? 'ausblenden' : 'anzeigen' }}</span>
                <ChevronDown
                  :size="11"
                  class="transition-transform"
                  :class="{ 'rotate-180': showProbeDetails }"
                />
              </button>
              <div
                v-if="showProbeDetails && probeResult"
                class="p-2.5 bg-surface border border-border rounded-md"
              >
                <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[11px] font-mono">
                  <template v-for="endpoint in probeResult.endpoints" :key="endpoint.url">
                    <dt class="text-fg-muted truncate" :title="endpoint.url">
                      {{ endpointPath(endpoint.url) }}
                    </dt>
                    <dd
                      :class="[
                        endpoint.status === 'ok' ? 'text-success' : 'text-fg-2',
                        'break-all',
                      ]"
                    >
                      {{ endpointStatusLabel[endpoint.status] ?? endpoint.status }}<template v-if="endpoint.httpStatus"> · HTTP {{ endpoint.httpStatus }}</template>
                      <template v-if="endpoint.detail"> · {{ endpoint.detail }}</template>
                    </dd>
                  </template>
                </dl>
              </div>
            </div>

            <!-- Probe says: OAuth is supported. Show actionable Anmelden-Button. -->
            <div
              v-else
              class="flex items-start gap-2 p-2.5 bg-surface-2 border border-border rounded-md"
            >
              <LogIn :size="14" class="text-accent shrink-0 mt-0.5" />
              <div class="flex-1 min-w-0">
                <div class="text-[12px] font-medium text-fg">Mit OAuth anmelden</div>
                <div class="text-[11px] text-fg-muted mt-0.5 leading-[1.4]">
                  Discovery, Dynamic Client Registration und Redirect zum Provider werden
                  automatisch abgewickelt. Du landest zurück hier.
                </div>
              </div>
              <button
                type="button"
                :disabled="disabled || oauthPending"
                class="focus-ring shrink-0 inline-flex items-center gap-1.5 h-7 px-2.5 bg-accent text-white rounded-md text-[11px] font-medium hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                @click="startOAuth"
              >
                <Loader2 v-if="oauthPending" :size="11" class="animate-spin" />
                <LogIn v-else :size="11" />
                {{ oauthPending ? 'Starte …' : 'Anmelden' }}
              </button>
            </div>

            <!-- Inline error — stays in the panel so the enclosing Landing/Connected
                 view doesn't flip into a global error state. -->
            <div
              v-if="oauthError"
              class="flex items-start gap-2 p-2.5 bg-danger-soft border border-danger/30 rounded-md"
              role="alert"
            >
              <AlertTriangle :size="13" class="text-danger shrink-0 mt-0.5" />
              <div class="flex-1 min-w-0">
                <div class="text-[11.5px] font-medium text-danger">
                  OAuth-Flow konnte nicht gestartet werden
                </div>
                <p class="text-[11px] text-fg-2 mt-0.5 leading-[1.4] break-words">
                  {{ oauthError }}
                </p>
                <p class="text-[11px] text-fg-muted mt-1 leading-[1.4]">
                  Bearer-Token manuell unten eintragen ist eine Alternative, wenn der
                  Server Auth per Header unterstützt.
                </p>
              </div>
              <button
                type="button"
                aria-label="Hinweis schließen"
                class="focus-ring shrink-0 p-1 text-fg-muted hover:text-fg rounded"
                @click="dismissOAuthError"
              >
                <X :size="11" />
              </button>
            </div>
          </div>

          <!-- Bearer shortcut -->
          <div :class="oauthActive ? '' : 'pt-3.5'">
            <label
              for="auth-bearer"
              class="block text-[11.5px] font-medium text-fg-2 mb-1"
            >
              Bearer-Token
              <span class="text-fg-muted font-normal">
                — wird als
                <code class="font-mono text-fg-2">Authorization: Bearer …</code> gesendet
              </span>
            </label>
            <div class="flex items-stretch gap-2">
              <div class="flex-1 relative">
                <input
                  id="auth-bearer"
                  :value="bearerToken"
                  :type="showBearer ? 'text' : 'password'"
                  autocomplete="off"
                  spellcheck="false"
                  :disabled="disabled"
                  placeholder="eyJhbGciOiJI…"
                  class="focus-ring w-full h-9 pl-3 pr-9 bg-surface border border-border-strong rounded-md font-mono text-[12.5px] text-fg placeholder:text-fg-subtle focus:border-accent focus:outline-none disabled:bg-surface-2 disabled:text-fg-muted"
                  @input="emit('update:bearer', ($event.target as HTMLInputElement).value)"
                />
                <button
                  type="button"
                  @click="showBearer = !showBearer"
                  :aria-label="showBearer ? 'Token verbergen' : 'Token anzeigen'"
                  class="focus-ring absolute right-1.5 top-1/2 -translate-y-1/2 p-1 text-fg-muted hover:text-fg rounded"
                >
                  <EyeOff v-if="showBearer" :size="13" />
                  <Eye v-else :size="13" />
                </button>
              </div>
            </div>
          </div>

          <!-- Custom headers -->
          <div>
            <div class="flex items-center justify-between mb-1.5">
              <label class="text-[11.5px] font-medium text-fg-2">
                Weitere Headers
              </label>
              <button
                v-if="activeCount > 0"
                type="button"
                @click="emit('clear')"
                :disabled="disabled"
                class="focus-ring text-[11px] text-fg-muted hover:text-danger underline underline-offset-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                alles löschen
              </button>
            </div>
            <div class="space-y-2">
              <div
                v-for="{ header, index } in customHeaders"
                :key="index"
                class="flex items-stretch gap-2"
              >
                <input
                  :value="header.key"
                  type="text"
                  spellcheck="false"
                  autocomplete="off"
                  placeholder="X-Api-Key"
                  :disabled="disabled"
                  class="focus-ring w-36 shrink-0 h-9 px-2.5 bg-surface border border-border-strong rounded-md font-mono text-[12px] text-fg placeholder:text-fg-subtle focus:border-accent focus:outline-none disabled:bg-surface-2"
                  :aria-label="`Header ${index + 1} Name`"
                  @input="updateKey(index, ($event.target as HTMLInputElement).value)"
                />
                <div class="flex-1 relative">
                  <input
                    :value="header.value"
                    :type="visibleValueIndexes.has(index) ? 'text' : 'password'"
                    spellcheck="false"
                    autocomplete="off"
                    placeholder="Wert"
                    :disabled="disabled"
                    class="focus-ring w-full h-9 pl-2.5 pr-9 bg-surface border border-border-strong rounded-md font-mono text-[12px] text-fg placeholder:text-fg-subtle focus:border-accent focus:outline-none disabled:bg-surface-2"
                    :aria-label="`Header ${index + 1} Wert`"
                    @input="updateValue(index, ($event.target as HTMLInputElement).value)"
                  />
                  <button
                    type="button"
                    @click="toggleValueVisibility(index)"
                    :aria-label="visibleValueIndexes.has(index) ? 'Wert verbergen' : 'Wert anzeigen'"
                    class="focus-ring absolute right-1 top-1/2 -translate-y-1/2 p-1 text-fg-muted hover:text-fg rounded"
                  >
                    <EyeOff v-if="visibleValueIndexes.has(index)" :size="12" />
                    <Eye v-else :size="12" />
                  </button>
                </div>
                <button
                  type="button"
                  @click="emit('remove-header', index)"
                  :disabled="disabled"
                  class="focus-ring shrink-0 w-9 h-9 flex items-center justify-center bg-surface border border-border-strong rounded-md text-fg-muted hover:text-danger hover:border-danger/50 disabled:opacity-40 disabled:cursor-not-allowed"
                  :aria-label="`Header ${index + 1} entfernen`"
                >
                  <X :size="13" />
                </button>
              </div>

              <button
                type="button"
                @click="emit('add-header')"
                :disabled="disabled"
                class="focus-ring inline-flex items-center gap-1.5 h-8 px-2.5 border border-dashed border-border-strong rounded-md text-[11.5px] text-fg-muted hover:text-fg hover:border-fg/30 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Plus :size="12" />
                Header hinzufügen
              </button>
            </div>
          </div>

          <!-- Reconnect action — only meaningful in Connected view. Sits inside the
               accordion so the compact header doesn't carry a second action button. -->
          <div
            v-if="canReconnect"
            class="flex items-center justify-between gap-3 p-2.5 bg-accent-soft/40 border border-accent/20 rounded-md"
          >
            <p class="text-[11.5px] text-fg-2 leading-[1.4] flex-1 min-w-0">
              Änderungen greifen erst nach einem Reconnect. Die aktuelle Verbindung
              bleibt sonst mit den alten Credentials bestehen.
            </p>
            <button
              type="button"
              :disabled="disabled"
              class="focus-ring shrink-0 inline-flex items-center gap-1.5 h-7 px-2.5 bg-accent text-white rounded-md text-[11px] font-medium hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              title="Handshake mit aktuell eingestellter Auth erneut ausführen — Tools &amp; Listen bleiben sichtbar"
              @click="emit('reconnect')"
            >
              <Loader2 v-if="reconnecting" :size="11" class="animate-spin" />
              <RotateCw v-else :size="11" />
              {{ reconnecting ? 'Reconnect läuft …' : 'Neu verbinden' }}
            </button>
          </div>

          <!-- Warning -->
          <div class="flex items-start gap-2 p-2.5 bg-warning-soft/60 border border-warning/30 rounded-md">
            <ShieldAlert :size="13" class="text-warning shrink-0 mt-0.5" />
            <p class="text-[11.5px] text-fg-2 leading-[1.4]">
              Headers werden pro URL im Browser (<code class="font-mono">localStorage</code>)
              gespeichert. Auf shared Devices nicht verwenden — jeder mit Zugriff auf dieses
              Profil liest die Tokens.
            </p>
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  </AccordionRoot>
</template>
