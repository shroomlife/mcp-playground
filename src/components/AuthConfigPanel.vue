<script setup lang="ts">
import { ref, computed, onBeforeUnmount, onMounted, watch } from 'vue'
import {
  AccordionRoot,
  AccordionItem,
  AccordionHeader,
  AccordionTrigger,
  AccordionContent,
  CollapsibleRoot,
  CollapsibleTrigger,
  CollapsibleContent,
} from 'reka-ui'
import {
  AlertTriangle,
  ChevronDown,
  CheckCircle2,
  Check,
  Copy,
  Eye,
  EyeOff,
  Info,
  KeyRound,
  Loader2,
  LogIn,
  LogOut,
  Plus,
  RotateCw,
  ShieldOff,
  Terminal,
  X,
  ShieldAlert,
  SlidersHorizontal,
} from 'lucide-vue-next'
import {
  clearOAuth,
  probeOAuthSupport,
  readOAuthSession,
  useOAuthRevision,
} from '~/composables/useOAuth'
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

// sessionStorage lives outside Vue's reactivity graph. `oauthRevision` gets bumped
// on every save/clear in useOAuth, so anything that reads storage (session-info,
// oauthActive) can subscribe to it to stay in sync with logout/refresh/login.
const oauthRevision = useOAuthRevision()

const session = computed(() => {
  // Track the revision so Vue re-runs this computed on any OAuth state change.
  void oauthRevision.value
  const u = props.url?.trim()
  if (!u) return null
  return readOAuthSession(u)
})

const oauthActive = computed(() => Boolean(session.value?.tokens?.access_token))

function logoutOAuth() {
  if (!props.url) return
  clearOAuth(props.url)
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

// Token-Inspektor: Collapse + copy-feedback + masked-visibility for each field.
const tokenDetailsOpen = ref(false)
const showAccessToken = ref(false)
const showRefreshToken = ref(false)
const showCurlToken = ref(false)
const copiedField = ref<string | null>(null)
let copyResetTimer: ReturnType<typeof setTimeout> | null = null

async function copyValue(fieldId: string, value: string) {
  if (!value) return
  try {
    await navigator.clipboard.writeText(value)
    copiedField.value = fieldId
    if (copyResetTimer) clearTimeout(copyResetTimer)
    copyResetTimer = setTimeout(() => {
      copiedField.value = null
    }, 1500)
  } catch {
    // clipboard denied — no-op, user will notice the missing state flip
  }
}

// Ticks once per 30s so the relative expiry countdown below stays fresh without
// hammering the render loop. Only armed while the details are actually open.
const now = ref(Date.now())
let tickInterval: ReturnType<typeof setInterval> | null = null

watch(tokenDetailsOpen, (open) => {
  if (open) {
    now.value = Date.now()
    if (!tickInterval) {
      tickInterval = setInterval(() => {
        now.value = Date.now()
      }, 30_000)
    }
  } else if (tickInterval) {
    clearInterval(tickInterval)
    tickInterval = null
  }
})

onMounted(() => {
  now.value = Date.now()
})

onBeforeUnmount(() => {
  if (tickInterval) clearInterval(tickInterval)
  if (copyResetTimer) clearTimeout(copyResetTimer)
})

interface TokenExpiry {
  expiresAt: number
  remainingMs: number
  expired: boolean
  critical: boolean
  relative: string
  absolute: string
}

function formatRelativeMs(ms: number): string {
  const abs = Math.abs(ms)
  const minutes = Math.round(abs / 60_000)
  const hours = Math.floor(minutes / 60)
  const leftover = minutes % 60
  if (hours >= 24) {
    const days = Math.floor(hours / 24)
    const hoursLeft = hours % 24
    return hoursLeft > 0 ? `${days} Tg ${hoursLeft} Std` : `${days} Tg`
  }
  if (hours > 0) return leftover > 0 ? `${hours} Std ${leftover} min` : `${hours} Std`
  if (minutes === 0) return 'unter 1 min'
  return `${minutes} min`
}

const absoluteFormatter = new Intl.DateTimeFormat('de-DE', {
  dateStyle: 'short',
  timeStyle: 'short',
})

const tokenExpiry = computed<TokenExpiry | null>(() => {
  const s = session.value
  if (!s?.tokens || !s.issuedAt || typeof s.tokens.expires_in !== 'number') return null
  const expiresAt = s.issuedAt + s.tokens.expires_in * 1000
  const remainingMs = expiresAt - now.value
  const expired = remainingMs <= 0
  return {
    expiresAt,
    remainingMs,
    expired,
    critical: !expired && remainingMs < 5 * 60 * 1000,
    relative: expired ? `abgelaufen vor ${formatRelativeMs(remainingMs)}` : `in ${formatRelativeMs(remainingMs)}`,
    absolute: absoluteFormatter.format(new Date(expiresAt)),
  }
})

function formatTimestampSeconds(ts: number | undefined): string | null {
  if (typeof ts !== 'number' || !Number.isFinite(ts) || ts <= 0) return null
  return absoluteFormatter.format(new Date(ts * 1000))
}

const clientIdIssuedAtLabel = computed(() =>
  formatTimestampSeconds(session.value?.client?.client_id_issued_at),
)

// Flat accessors for the template — vue-tsc struggles to narrow optional chains
// across nested v-if blocks, and the readonly input values never need to change
// independently, so flattening keeps markup + types simple.
const accessTokenValue = computed(() => session.value?.tokens?.access_token ?? '')
const refreshTokenValue = computed(() => session.value?.tokens?.refresh_token ?? '')
const tokenTypeValue = computed(() => session.value?.tokens?.token_type ?? '')
const scopeValue = computed(() => session.value?.tokens?.scope ?? '')
const clientIdValue = computed(() => session.value?.client?.client_id ?? '')

const curlSnippetRaw = computed(() => {
  const u = props.url?.trim()
  const token = accessTokenValue.value
  if (!u || !token) return ''
  return `curl -H "Authorization: Bearer ${token}" "${u}"`
})

// Der sichtbare Snippet masked den Token standardmäßig mit einem $ACCESS_TOKEN-
// Platzhalter, damit der Klartext nicht neben den maskierten Eye-Fields im UI
// liegt. Copy-Button kopiert immer den echten Snippet — das ist der bewusste
// Action-Moment.
const CURL_TOKEN_PLACEHOLDER = '$ACCESS_TOKEN'
const curlSnippetDisplay = computed(() => {
  const u = props.url?.trim()
  const token = accessTokenValue.value
  if (!u || !token) return ''
  const shown = showCurlToken.value ? token : CURL_TOKEN_PLACEHOLDER
  return `curl -H "Authorization: Bearer ${shown}" "${u}"`
})

// Manual header visibility: hidden by default when OAuth is active (the panel then
// leads with the Token-Inspektor), otherwise shown like before. Watched so it snaps
// closed right after a successful login and re-opens on logout.
const manualHeadersOpen = ref(true)

watch(
  oauthActive,
  (active) => {
    manualHeadersOpen.value = !active
  },
  { immediate: true },
)

// Spiegelt, was tatsächlich Richtung Server gesendet wird: jeder gesetzte Header
// (inkl. manuellem Authorization mit nicht-Bearer-Scheme wie Basic) zählt einmal.
// Der Bearer-Shortcut landet auch hier drin (als Authorization-Header), also keine
// Doppelzählung nötig.
const activeCount = computed(
  () => props.headers.filter((h) => h.key.trim() && h.value).length,
)

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
            class="pt-3.5 space-y-3"
          >
            <div class="flex items-center justify-between gap-3 p-3 bg-accent-soft/60 border border-accent/20 rounded-lg">
              <div class="flex items-start gap-2.5 min-w-0">
                <CheckCircle2 :size="16" class="text-accent shrink-0 mt-0.5" />
                <div class="min-w-0">
                  <div class="text-[13px] font-medium text-fg">Über OAuth angemeldet</div>
                  <div class="text-[12px] text-fg-muted mt-1 leading-[1.5]">
                    Tokens liegen nur in dieser Browser-Session. Die manuellen Felder unten
                    werden ignoriert, solange OAuth aktiv ist.
                  </div>
                </div>
              </div>
              <button
                type="button"
                :disabled="disabled"
                class="focus-ring shrink-0 inline-flex items-center gap-1.5 h-8 px-3 bg-surface border border-border-strong rounded-md text-[12px] text-fg-2 hover:text-danger hover:border-danger/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                @click="logoutOAuth"
              >
                <LogOut :size="13" />
                Abmelden
              </button>
            </div>

            <!-- Token-Inspektor: collapse so it doesn't dominate the panel by default,
                 but all details (access, refresh, scope, expiry, client) are one click
                 away — including a ready-to-paste curl line. Tokens sind in allen
                 Ansichten maskiert; Eye zeigt, Copy kopiert bewusst den Klartext. -->
            <CollapsibleRoot
              v-model:open="tokenDetailsOpen"
              class="bg-surface-2/40 border border-border rounded-lg overflow-hidden"
            >
              <CollapsibleTrigger
                class="focus-ring w-full flex items-center gap-2.5 px-4 py-3 text-[13px] text-fg-2 hover:text-fg transition-colors"
              >
                <Info :size="14" class="text-accent shrink-0" />
                <span class="font-medium">Token-Details</span>
                <span
                  v-if="tokenExpiry?.expired"
                  class="inline-flex items-center h-5 px-2 bg-danger-soft text-danger rounded text-[11px] font-medium"
                  title="Access-Token ist abgelaufen"
                >abgelaufen</span>
                <span
                  v-else-if="tokenExpiry?.critical"
                  class="inline-flex items-center h-5 px-2 bg-warning-soft text-warning rounded text-[11px] font-medium"
                  :title="`Ablauf ${tokenExpiry.relative}`"
                >läuft bald ab</span>
                <ChevronDown
                  :size="14"
                  class="ml-auto text-fg-muted transition-transform"
                  :class="{ 'rotate-180': tokenDetailsOpen }"
                />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div class="p-4 pt-0 space-y-4 border-t border-border">
                  <!-- Expiry row (shows only when expires_in is known) -->
                  <div
                    v-if="tokenExpiry"
                    :class="[
                      'flex items-center gap-2 px-3 py-2 rounded-md border text-[12.5px]',
                      tokenExpiry.expired
                        ? 'bg-danger-soft border-danger/30 text-danger'
                        : tokenExpiry.critical
                          ? 'bg-warning-soft border-warning/30 text-warning'
                          : 'bg-surface border-border text-fg-2',
                    ]"
                  >
                    <AlertTriangle v-if="tokenExpiry.expired || tokenExpiry.critical" :size="14" class="shrink-0" />
                    <CheckCircle2 v-else :size="14" class="shrink-0 text-success" />
                    <span class="font-medium">Gültig bis</span>
                    <span class="font-mono">{{ tokenExpiry.absolute }}</span>
                    <span class="text-fg-muted">· {{ tokenExpiry.relative }}</span>
                  </div>

                  <!-- Access-Token row -->
                  <div v-if="accessTokenValue" class="space-y-1.5">
                    <div class="flex items-center justify-between gap-2">
                      <label class="text-[12.5px] font-medium text-fg-2">
                        Access-Token
                      </label>
                      <div class="flex items-center gap-1">
                        <button
                          type="button"
                          class="focus-ring inline-flex items-center gap-1.5 h-7 px-2 rounded-md text-[12px] text-fg-muted hover:text-fg hover:bg-surface-2"
                          @click="showAccessToken = !showAccessToken"
                        >
                          <EyeOff v-if="showAccessToken" :size="13" />
                          <Eye v-else :size="13" />
                          {{ showAccessToken ? 'verbergen' : 'anzeigen' }}
                        </button>
                        <button
                          type="button"
                          class="focus-ring inline-flex items-center gap-1.5 h-7 px-2 rounded-md text-[12px] text-fg-muted hover:text-fg hover:bg-surface-2"
                          :aria-label="copiedField === 'access' ? 'kopiert' : 'Access-Token kopieren'"
                          @click="copyValue('access', accessTokenValue)"
                        >
                          <Check v-if="copiedField === 'access'" :size="13" class="text-success" />
                          <Copy v-else :size="13" />
                          {{ copiedField === 'access' ? 'kopiert' : 'kopieren' }}
                        </button>
                      </div>
                    </div>
                    <input
                      :value="accessTokenValue"
                      :type="showAccessToken ? 'text' : 'password'"
                      readonly
                      spellcheck="false"
                      class="focus-ring w-full h-10 px-3 bg-surface border border-border rounded-md font-mono text-[12.5px] text-fg select-all"
                      @focus="($event.target as HTMLInputElement).select()"
                    />
                  </div>

                  <!-- Metadata grid (token_type, scope, client_id, issued_at) -->
                  <dl
                    v-if="tokenTypeValue || scopeValue || clientIdValue || clientIdIssuedAtLabel"
                    class="grid grid-cols-[120px_1fr] gap-x-4 gap-y-2 text-[12.5px] items-center"
                  >
                    <template v-if="tokenTypeValue">
                      <dt class="text-fg-muted">Token-Typ</dt>
                      <dd class="font-mono text-fg-2">{{ tokenTypeValue }}</dd>
                    </template>
                    <template v-if="scopeValue">
                      <dt class="text-fg-muted self-start pt-0.5">Scope</dt>
                      <dd class="font-mono text-fg-2 break-all">{{ scopeValue }}</dd>
                    </template>
                    <template v-if="clientIdValue">
                      <dt class="text-fg-muted">Client ID</dt>
                      <dd class="flex items-center gap-2 min-w-0">
                        <span class="font-mono text-fg-2 truncate flex-1" :title="clientIdValue">
                          {{ clientIdValue }}
                        </span>
                        <button
                          type="button"
                          class="focus-ring shrink-0 inline-flex items-center justify-center h-6 w-6 rounded-md text-fg-muted hover:text-fg hover:bg-surface-2"
                          :aria-label="copiedField === 'client' ? 'kopiert' : 'Client-ID kopieren'"
                          :title="copiedField === 'client' ? 'kopiert' : 'Client-ID kopieren'"
                          @click="copyValue('client', clientIdValue)"
                        >
                          <Check v-if="copiedField === 'client'" :size="12" class="text-success" />
                          <Copy v-else :size="12" />
                        </button>
                      </dd>
                    </template>
                    <template v-if="clientIdIssuedAtLabel">
                      <dt class="text-fg-muted">Registriert</dt>
                      <dd class="font-mono text-fg-2">{{ clientIdIssuedAtLabel }}</dd>
                    </template>
                  </dl>

                  <!-- Refresh token (optional) -->
                  <div v-if="refreshTokenValue" class="space-y-1.5">
                    <div class="flex items-center justify-between gap-2">
                      <label class="text-[12.5px] font-medium text-fg-2">
                        Refresh-Token
                      </label>
                      <div class="flex items-center gap-1">
                        <button
                          type="button"
                          class="focus-ring inline-flex items-center gap-1.5 h-7 px-2 rounded-md text-[12px] text-fg-muted hover:text-fg hover:bg-surface-2"
                          @click="showRefreshToken = !showRefreshToken"
                        >
                          <EyeOff v-if="showRefreshToken" :size="13" />
                          <Eye v-else :size="13" />
                          {{ showRefreshToken ? 'verbergen' : 'anzeigen' }}
                        </button>
                        <button
                          type="button"
                          class="focus-ring inline-flex items-center gap-1.5 h-7 px-2 rounded-md text-[12px] text-fg-muted hover:text-fg hover:bg-surface-2"
                          :aria-label="copiedField === 'refresh' ? 'kopiert' : 'Refresh-Token kopieren'"
                          @click="copyValue('refresh', refreshTokenValue)"
                        >
                          <Check v-if="copiedField === 'refresh'" :size="13" class="text-success" />
                          <Copy v-else :size="13" />
                          {{ copiedField === 'refresh' ? 'kopiert' : 'kopieren' }}
                        </button>
                      </div>
                    </div>
                    <input
                      :value="refreshTokenValue"
                      :type="showRefreshToken ? 'text' : 'password'"
                      readonly
                      spellcheck="false"
                      class="focus-ring w-full h-10 px-3 bg-surface border border-border rounded-md font-mono text-[12.5px] text-fg-2 select-all"
                      @focus="($event.target as HTMLInputElement).select()"
                    />
                  </div>

                  <!-- Curl snippet — Token standardmäßig maskiert, Eye zeigt, Copy kopiert Klartext -->
                  <div v-if="curlSnippetDisplay" class="space-y-1.5">
                    <div class="flex items-center justify-between gap-2">
                      <label class="text-[12.5px] font-medium text-fg-2 inline-flex items-center gap-1.5">
                        <Terminal :size="13" class="text-fg-muted" />
                        curl-Aufruf
                      </label>
                      <div class="flex items-center gap-1">
                        <button
                          type="button"
                          class="focus-ring inline-flex items-center gap-1.5 h-7 px-2 rounded-md text-[12px] text-fg-muted hover:text-fg hover:bg-surface-2"
                          @click="showCurlToken = !showCurlToken"
                        >
                          <EyeOff v-if="showCurlToken" :size="13" />
                          <Eye v-else :size="13" />
                          {{ showCurlToken ? 'verbergen' : 'anzeigen' }}
                        </button>
                        <button
                          type="button"
                          class="focus-ring inline-flex items-center gap-1.5 h-7 px-2 rounded-md text-[12px] text-fg-muted hover:text-fg hover:bg-surface-2"
                          :aria-label="copiedField === 'curl' ? 'kopiert' : 'curl mit Token kopieren'"
                          @click="copyValue('curl', curlSnippetRaw)"
                        >
                          <Check v-if="copiedField === 'curl'" :size="13" class="text-success" />
                          <Copy v-else :size="13" />
                          {{ copiedField === 'curl' ? 'kopiert' : 'kopieren' }}
                        </button>
                      </div>
                    </div>
                    <pre
                      class="font-mono text-[12px] leading-[1.55] whitespace-pre-wrap break-all text-fg-2 bg-surface border border-border rounded-md px-3 py-2.5"
                    >{{ curlSnippetDisplay }}</pre>
                    <p class="text-[11.5px] text-fg-muted leading-[1.5]">
                      <template v-if="showCurlToken">
                        Enthält deinen Access-Token im Klartext. Nur an vertrauenswürdige Stellen einfügen.
                      </template>
                      <template v-else>
                        <code class="font-mono">{{ CURL_TOKEN_PLACEHOLDER }}</code> ist Platzhalter —
                        Kopieren ersetzt ihn automatisch mit dem echten Token.
                      </template>
                    </p>
                  </div>
                </div>
              </CollapsibleContent>
            </CollapsibleRoot>
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

          <!-- Manuelle Header — bei aktivem OAuth hinter Toggle verborgen, sonst direkt
               sichtbar. v-if (nicht v-show) entfernt die Inputs komplett aus dem DOM,
               damit sie im eingeklappten Zustand nicht per Tab fokussierbar bleiben. -->
          <div v-if="oauthActive">
            <button
              type="button"
              class="focus-ring w-full flex items-center gap-2.5 px-4 py-3 text-[13px] text-fg-2 hover:text-fg bg-surface-2/40 border border-border rounded-lg transition-colors"
              :aria-expanded="manualHeadersOpen"
              aria-controls="auth-manual-headers"
              @click="manualHeadersOpen = !manualHeadersOpen"
            >
              <SlidersHorizontal :size="14" class="shrink-0 text-fg-muted" />
              <span class="font-medium">Manuelle Header</span>
              <span class="text-[11.5px] text-fg-muted">
                — werden ignoriert, solange OAuth aktiv ist
              </span>
              <ChevronDown
                :size="14"
                class="ml-auto text-fg-muted transition-transform"
                :class="{ 'rotate-180': manualHeadersOpen }"
              />
            </button>
          </div>

          <div
            v-if="!oauthActive || manualHeadersOpen"
            id="auth-manual-headers"
            class="space-y-3.5"
            :class="oauthActive ? 'pt-1' : ''"
          >
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
          </div><!-- /manual headers wrapper -->

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
