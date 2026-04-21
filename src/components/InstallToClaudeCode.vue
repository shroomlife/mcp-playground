<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  DialogRoot,
  DialogTrigger,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from 'reka-ui'
import {
  FolderPlus,
  Folder,
  FileCheck,
  FileWarning,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  KeyRound,
  Loader2,
  Copy,
  Check,
  X,
  Info,
} from 'lucide-vue-next'
import type { AuthHeader, TransportKind } from '~/composables/useMcpPlayground'
import {
  isDirectoryPickerSupported,
  pickProjectDirectory,
  inspectMcpJson,
  installToClaudeCode,
  sanitizeServerName,
  suggestEnvVarName,
  buildMcpEntry,
  CLIENT_TARGETS,
  type ClientTargetId,
  type ExistingFileInfo,
  type InstallResult,
} from '~/lib/claudeCodeInstall'

const props = defineProps<{
  url: string
  transport: TransportKind
  suggestedName: string
  /** Aktueller Bearer-Token aus dem AuthConfigPanel, wenn manuell gesetzt. */
  bearerToken?: string | null
  /** Custom-Header ohne Authorization, übernommen aus dem Playground-Auth-State. */
  customHeaders?: AuthHeader[]
  /** OAuth-Access-Token, wenn für diese URL ein OAuth-Login läuft. */
  oauthAccessToken?: string | null
}>()

const activeClientId = ref<ClientTargetId>('claude-code')
const activeClient = computed(() => {
  const found = CLIENT_TARGETS.find((c) => c.id === activeClientId.value)
  return found ?? CLIENT_TARGETS[0] ?? { id: 'claude-code' as ClientTargetId, label: 'Claude Code', filePath: '.mcp.json', pathNote: '', supportsDirectWrite: true, buildSnippet: () => '{}' }
})

type Phase = 'idle' | 'picking' | 'picked' | 'writing' | 'success' | 'error'

const open = ref(false)
const phase = ref<Phase>('idle')
const serverName = ref(props.suggestedName)
const dirHandle = ref<FileSystemDirectoryHandle | null>(null)
const fileInfo = ref<ExistingFileInfo | null>(null)
const result = ref<InstallResult | null>(null)
const errorMessage = ref<string | null>(null)
const copied = ref(false)

const supported = isDirectoryPickerSupported()

// Which auth source to inherit — determined once from what's available. User can
// switch. `none` means "don't write any headers", even if something is configured.
type AuthSource = 'oauth' | 'bearer' | 'headers' | 'none'

const hasOAuth = computed(() => Boolean(props.oauthAccessToken?.trim()))
const hasBearer = computed(() => Boolean(props.bearerToken?.trim()))
const hasCustomHeaders = computed(
  () => (props.customHeaders?.filter((h) => h.key.trim() && h.value).length ?? 0) > 0,
)
const hasAnyAuth = computed(() => hasOAuth.value || hasBearer.value || hasCustomHeaders.value)

const authSource = ref<AuthSource>('none')

function pickDefaultAuthSource(): AuthSource {
  if (hasOAuth.value) return 'oauth'
  if (hasBearer.value) return 'bearer'
  if (hasCustomHeaders.value) return 'headers'
  return 'none'
}

type TokenMode = 'env' | 'inline'
const tokenMode = ref<TokenMode>('env')
const envVarName = ref('')
const envVarEdited = ref(false)

const nameClean = computed(() => sanitizeServerName(serverName.value))
const nameValid = computed(() => nameClean.value.length > 0 && nameClean.value === serverName.value)

// Keep env-var name in sync with server name unless the user has explicitly edited it.
watch(
  nameClean,
  (next) => {
    if (!envVarEdited.value) envVarName.value = suggestEnvVarName(next)
  },
  { immediate: true },
)

const envVarValid = computed(() => /^[A-Z_][A-Z0-9_]*$/.test(envVarName.value))

/**
 * Picks up the bearer/oauth token based on the selected source and wraps it as an
 * `Authorization: Bearer …` header (or an `${ENV_VAR}` reference). Custom headers
 * flow through verbatim (filtered to meaningful pairs).
 */
function buildInstallHeaders(): Record<string, string> | undefined {
  const src = authSource.value
  if (src === 'none') return undefined

  const headers: Record<string, string> = {}

  if (src === 'headers') {
    const list = props.customHeaders ?? []
    for (const h of list) {
      const k = h.key.trim()
      const v = h.value
      if (k && v) headers[k] = v
    }
    return Object.keys(headers).length > 0 ? headers : undefined
  }

  // oauth + bearer both end up as `Authorization: Bearer …`.
  const rawToken = src === 'oauth' ? props.oauthAccessToken?.trim() : props.bearerToken?.trim()
  if (!rawToken) return undefined

  const value =
    tokenMode.value === 'env' && envVarValid.value
      ? `Bearer \${${envVarName.value}}`
      : `Bearer ${rawToken}`

  headers.Authorization = value
  return headers
}

const installHeaders = computed(() => buildInstallHeaders())
const entry = computed(() => buildMcpEntry(props.url, props.transport, installHeaders.value))
const snippet = computed(() =>
  activeClient.value.buildSnippet(sanitizeServerName(serverName.value), entry.value),
)

watch(open, (isOpen) => {
  if (isOpen) {
    serverName.value = props.suggestedName
    phase.value = 'idle'
    dirHandle.value = null
    fileInfo.value = null
    result.value = null
    errorMessage.value = null
    authSource.value = pickDefaultAuthSource()
    tokenMode.value = 'env'
    envVarEdited.value = false
    envVarName.value = suggestEnvVarName(sanitizeServerName(props.suggestedName))
  }
})

async function pickFolder() {
  errorMessage.value = null
  phase.value = 'picking'
  try {
    const handle = await pickProjectDirectory()
    dirHandle.value = handle
    fileInfo.value = await inspectMcpJson(handle, nameClean.value)
    phase.value = 'picked'
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      phase.value = 'idle'
      return
    }
    errorMessage.value = err instanceof Error ? err.message : String(err)
    phase.value = 'error'
  }
}

async function confirmInstall() {
  if (!dirHandle.value) return
  errorMessage.value = null
  phase.value = 'writing'
  try {
    const res = await installToClaudeCode(dirHandle.value, nameClean.value, entry.value)
    result.value = res
    phase.value = 'success'
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : String(err)
    phase.value = 'error'
  }
}

function resetToPicked() {
  if (dirHandle.value) {
    phase.value = 'picked'
    errorMessage.value = null
  } else {
    phase.value = 'idle'
    errorMessage.value = null
  }
}

async function copySnippet() {
  try {
    await navigator.clipboard.writeText(snippet.value)
    copied.value = true
    setTimeout(() => { copied.value = false }, 1500)
  } catch {
    // ignore
  }
}
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogTrigger as-child>
      <button
        type="button"
        class="focus-ring inline-flex items-center gap-2 h-9 px-3.5 bg-fg text-bg rounded-md text-[12.5px] font-medium hover:bg-fg-2 transition-colors"
      >
        <FolderPlus :size="14" />
        Für Claude Code installieren
      </button>
    </DialogTrigger>

    <DialogPortal>
      <DialogOverlay
        class="fixed inset-0 z-40 bg-fg/20 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
      />
      <DialogContent
        class="fixed left-1/2 top-1/2 z-50 w-[min(560px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 bg-surface border border-border rounded-xl shadow-2xl overflow-hidden focus:outline-none max-h-[calc(100vh-4rem)] flex flex-col"
      >
        <!-- Header -->
        <div class="flex items-start justify-between gap-4 p-5 border-b border-border">
          <div>
            <DialogTitle class="text-[15px] font-semibold text-fg">
              In MCP-Client installieren
            </DialogTitle>
            <DialogDescription class="text-[13px] text-fg-muted mt-0.5">
              Fügt diesen MCP-Server zur Config des gewählten Clients hinzu —
              direkt schreiben oder Snippet kopieren.
            </DialogDescription>
          </div>
          <DialogClose
            class="focus-ring shrink-0 p-1 text-fg-muted hover:text-fg rounded-md"
            aria-label="Schließen"
          >
            <X :size="16" />
          </DialogClose>
        </div>

        <!-- Client tabs -->
        <div
          role="tablist"
          aria-label="MCP-Client"
          class="flex items-center gap-1 px-3 border-b border-border bg-surface-2/50 overflow-x-auto"
        >
          <button
            v-for="client in CLIENT_TARGETS"
            :key="client.id"
            type="button"
            role="tab"
            :aria-selected="activeClientId === client.id"
            class="focus-ring h-10 px-3 text-[12.5px] font-medium transition-colors whitespace-nowrap border-b-2"
            :class="activeClientId === client.id
              ? 'text-fg border-accent'
              : 'text-fg-muted border-transparent hover:text-fg'"
            @click="activeClientId = client.id"
          >
            {{ client.label }}
          </button>
        </div>

        <div class="p-5 space-y-4 overflow-y-auto">
          <!-- Client path hint + docs link -->
          <div class="p-3 bg-surface-2 border border-border rounded-lg text-[12px] text-fg-2 flex items-start gap-2">
            <Info :size="14" class="text-accent shrink-0 mt-0.5" />
            <div class="flex-1 leading-[1.5]">
              <div>
                Zieldatei für <strong class="font-medium text-fg">{{ activeClient.label }}</strong>:
                <code class="font-mono text-fg">{{ activeClient.filePath }}</code>
              </div>
              <div class="text-fg-muted mt-0.5">{{ activeClient.pathNote }}</div>
            </div>
            <a
              :href="activeClient.docsUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="focus-ring shrink-0 inline-flex items-center gap-1 text-[11px] text-accent hover:underline"
            >
              Docs ↗
            </a>
          </div>

          <!-- Feature detection fallback (only for targets supporting direct-write) -->
          <div
            v-if="activeClient.supportsDirectWrite && !supported"
            class="p-3 bg-warning-soft border border-warning/30 rounded-lg text-[12.5px] text-fg-2 flex items-start gap-2"
          >
            <Info :size="14" class="text-warning shrink-0 mt-0.5" />
            <div>
              Dein Browser unterstützt keine Ordner-Auswahl (nur Chrome/Edge).
              Kopier stattdessen diesen Snippet unten in die Config-Datei.
            </div>
          </div>

          <!-- Server config form -->
          <div class="space-y-3">
            <div>
              <label for="install-name" class="block text-[12px] font-medium text-fg-2 mb-1">
                Server-Name
                <span class="text-fg-muted font-normal">
                  — Key unter <code class="font-mono">mcpServers</code>
                </span>
              </label>
              <input
                id="install-name"
                v-model="serverName"
                type="text"
                spellcheck="false"
                autocomplete="off"
                :disabled="phase === 'writing' || phase === 'success'"
                class="focus-ring w-full h-10 px-3 bg-surface border border-border-strong rounded-md font-mono text-[13px] text-fg focus:border-accent focus:outline-none disabled:bg-surface-2 disabled:text-fg-muted"
              />
              <div v-if="!nameValid" class="mt-1 text-[11.5px] text-warning">
                Wird normalisiert zu <code class="font-mono">{{ nameClean }}</code>
              </div>
            </div>

            <div class="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1.5 text-[12px]">
              <div class="text-fg-muted">Transport</div>
              <div class="font-mono text-fg uppercase">{{ transport }}</div>
              <div class="text-fg-muted">URL</div>
              <div class="font-mono text-fg break-all">{{ url }}</div>
            </div>
          </div>

          <!-- Authentifizierung übernehmen (nur wenn im Playground was konfiguriert ist) -->
          <div
            v-if="hasAnyAuth"
            class="p-3 bg-surface-2/60 border border-border rounded-lg space-y-2.5"
          >
            <div class="flex items-center gap-2">
              <KeyRound :size="13" class="text-accent" />
              <div class="text-[12.5px] font-medium text-fg">Authentifizierung übernehmen</div>
            </div>

            <div class="flex flex-wrap gap-1.5">
              <button
                v-if="hasOAuth"
                type="button"
                class="focus-ring inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11.5px] border transition-colors"
                :class="authSource === 'oauth'
                  ? 'bg-accent text-white border-accent'
                  : 'bg-surface text-fg-2 border-border hover:text-fg'"
                @click="authSource = 'oauth'"
              >OAuth-Access-Token</button>
              <button
                v-if="hasBearer"
                type="button"
                class="focus-ring inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11.5px] border transition-colors"
                :class="authSource === 'bearer'
                  ? 'bg-accent text-white border-accent'
                  : 'bg-surface text-fg-2 border-border hover:text-fg'"
                @click="authSource = 'bearer'"
              >Bearer-Token</button>
              <button
                v-if="hasCustomHeaders"
                type="button"
                class="focus-ring inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11.5px] border transition-colors"
                :class="authSource === 'headers'
                  ? 'bg-accent text-white border-accent'
                  : 'bg-surface text-fg-2 border-border hover:text-fg'"
                @click="authSource = 'headers'"
              >Custom-Header</button>
              <button
                type="button"
                class="focus-ring inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11.5px] border transition-colors"
                :class="authSource === 'none'
                  ? 'bg-fg text-bg border-fg'
                  : 'bg-surface text-fg-2 border-border hover:text-fg'"
                @click="authSource = 'none'"
              >keine Auth</button>
            </div>

            <!-- Token-Mode + ENV-Var-Input (nur bei oauth/bearer) -->
            <div
              v-if="authSource === 'oauth' || authSource === 'bearer'"
              class="space-y-2 pt-1"
            >
              <div class="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  class="focus-ring inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11.5px] border transition-colors"
                  :class="tokenMode === 'env'
                    ? 'bg-success-soft text-success border-success/40'
                    : 'bg-surface text-fg-2 border-border hover:text-fg'"
                  @click="tokenMode = 'env'"
                >
                  via Umgebungsvariable
                  <span class="text-[10px] uppercase tracking-wide opacity-70">empfohlen</span>
                </button>
                <button
                  type="button"
                  class="focus-ring inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11.5px] border transition-colors"
                  :class="tokenMode === 'inline'
                    ? 'bg-warning-soft text-warning border-warning/40'
                    : 'bg-surface text-fg-2 border-border hover:text-fg'"
                  @click="tokenMode = 'inline'"
                >Token direkt einbetten</button>
              </div>

              <div v-if="tokenMode === 'env'" class="space-y-1.5">
                <label for="install-env" class="block text-[11.5px] text-fg-2">
                  Name der Umgebungsvariable
                </label>
                <input
                  id="install-env"
                  v-model="envVarName"
                  type="text"
                  spellcheck="false"
                  autocomplete="off"
                  class="focus-ring w-full h-9 px-3 bg-surface border border-border-strong rounded-md font-mono text-[12.5px] text-fg focus:border-accent focus:outline-none"
                  @input="envVarEdited = true"
                />
                <div v-if="!envVarValid" class="text-[11px] text-warning">
                  Nur Großbuchstaben, Ziffern und Unterstriche erlaubt.
                </div>
                <div class="text-[11px] text-fg-muted leading-[1.5]">
                  Die <code class="font-mono">.mcp.json</code> enthält nur den Platzhalter
                  <code class="font-mono">${{ '{' }}{{ envVarName }}{{ '}' }}</code>. Vor dem Start
                  von Claude Code:
                  <code class="font-mono">export {{ envVarName }}=&lt;token&gt;</code>
                  (bzw. <code class="font-mono">$env:{{ envVarName }}</code> in PowerShell).
                </div>
              </div>

              <div
                v-else
                class="flex items-start gap-2 p-2 bg-warning-soft border border-warning/30 rounded-md text-[11.5px] text-fg-2"
                role="alert"
              >
                <AlertTriangle :size="13" class="text-warning shrink-0 mt-0.5" />
                <div class="leading-[1.4]">
                  Der Token wird im Klartext in <code class="font-mono">.mcp.json</code>
                  geschrieben. Datei sollte danach nicht eingecheckt werden.
                </div>
              </div>
            </div>

            <div v-else-if="authSource === 'headers'" class="text-[11px] text-fg-muted leading-[1.5]">
              Alle Header aus dem Playground-Auth-Panel werden 1:1 übernommen.
              Werte landen im Klartext in der Datei.
            </div>
          </div>

          <!-- JSON preview -->
          <div>
            <div class="flex items-center justify-between mb-1.5">
              <div class="text-[11px] uppercase tracking-wide text-fg-muted font-medium">
                Wird geschrieben
              </div>
              <button
                type="button"
                @click="copySnippet"
                class="focus-ring flex items-center gap-1 text-[11.5px] text-fg-muted hover:text-fg"
                aria-label="JSON kopieren"
              >
                <Check v-if="copied" :size="11" class="text-success" />
                <Copy v-else :size="11" />
                {{ copied ? 'kopiert' : 'kopieren' }}
              </button>
            </div>
            <pre
              class="font-mono text-[11.5px] leading-[1.55] whitespace-pre-wrap break-words text-fg-2 bg-surface-2 border border-border rounded-md px-3 py-2.5"
            >{{ snippet }}</pre>
          </div>

          <!-- Folder-based direct-write flow (currently only Claude Code) -->
          <div v-if="activeClient.supportsDirectWrite && supported">
            <div v-if="!dirHandle" class="flex flex-col gap-2">
              <button
                type="button"
                @click="pickFolder"
                :disabled="phase === 'picking' || !nameClean"
                class="focus-ring flex items-center justify-center gap-2 h-10 px-4 bg-accent text-white rounded-md text-[13px] font-medium hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Loader2 v-if="phase === 'picking'" :size="14" class="animate-spin" />
                <Folder v-else :size="14" />
                Projektordner wählen
              </button>
              <p class="text-[11.5px] text-fg-muted text-center">
                Browser öffnet den Windows-Ordner-Dialog. Der Playground lädt nichts hoch —
                alles passiert lokal.
              </p>
            </div>

            <div v-else class="space-y-3">
              <div class="flex items-start gap-3 p-3 bg-surface-2 border border-border rounded-lg">
                <Folder :size="16" class="text-accent shrink-0 mt-0.5" />
                <div class="flex-1 min-w-0">
                  <div class="text-[12.5px] font-medium text-fg break-all">
                    {{ dirHandle.name }}/
                  </div>
                  <div v-if="fileInfo" class="mt-1 text-[12px]">
                    <div v-if="!fileInfo.exists" class="flex items-center gap-1.5 text-success">
                      <FileCheck :size="13" />
                      <span><code class="font-mono">.mcp.json</code> wird neu angelegt</span>
                    </div>
                    <div v-else class="space-y-1">
                      <div class="flex items-center gap-1.5 text-fg-2">
                        <FileCheck :size="13" class="text-success" />
                        <span>
                          Bestehende <code class="font-mono">.mcp.json</code> mit
                          {{ fileInfo.serverNames.length }}
                          {{ fileInfo.serverNames.length === 1 ? 'Server' : 'Servern' }}
                        </span>
                      </div>
                      <div
                        v-if="fileInfo.hasNameCollision"
                        class="flex items-start gap-1.5 text-warning"
                      >
                        <FileWarning :size="13" class="mt-0.5" />
                        <span>
                          <code class="font-mono">{{ nameClean }}</code> existiert schon —
                          wird überschrieben
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  @click="dirHandle = null; fileInfo = null; phase = 'idle'"
                  class="focus-ring text-[11.5px] text-fg-muted hover:text-fg underline underline-offset-2"
                >
                  ändern
                </button>
              </div>

              <button
                type="button"
                @click="confirmInstall"
                :disabled="phase === 'writing' || !nameClean"
                class="focus-ring flex items-center justify-center gap-2 w-full h-10 px-4 bg-fg text-bg rounded-md text-[13px] font-medium hover:bg-fg-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Loader2 v-if="phase === 'writing'" :size="14" class="animate-spin" />
                <FolderPlus v-else :size="14" />
                {{
                  phase === 'writing'
                    ? 'Schreibe …'
                    : fileInfo?.exists
                    ? fileInfo.hasNameCollision
                      ? `„${nameClean}“ überschreiben`
                      : `Zu ${dirHandle.name}/.mcp.json hinzufügen`
                    : `.mcp.json in ${dirHandle.name}/ erstellen`
                }}
              </button>
            </div>
          </div>

          <!-- Success -->
          <div
            v-if="phase === 'success' && result"
            class="p-3 bg-success-soft border border-success/30 rounded-lg flex items-start gap-3"
          >
            <CheckCircle2 :size="16" class="text-success shrink-0 mt-0.5" />
            <div class="flex-1 min-w-0">
              <div class="text-[13px] font-medium text-fg">
                {{ result.created ? 'Datei erstellt' : result.overwrote ? 'Eintrag überschrieben' : 'Eintrag ergänzt' }}
              </div>
              <div class="text-[12px] text-fg-2 mt-0.5 font-mono break-all">
                {{ result.path }}
              </div>
              <div class="text-[12px] text-fg-muted mt-1">
                Datei enthält jetzt {{ result.serverCount }}
                {{ result.serverCount === 1 ? 'Server' : 'Server' }}. Claude Code
                im Projekt neu starten, damit der Server geladen wird.
              </div>
            </div>
          </div>

          <!-- Error -->
          <div
            v-if="phase === 'error' && errorMessage"
            class="p-3 bg-danger-soft border border-danger/30 rounded-lg flex items-start gap-3"
          >
            <AlertCircle :size="16" class="text-danger shrink-0 mt-0.5" />
            <div class="flex-1 min-w-0">
              <div class="text-[13px] font-medium text-fg">Fehler</div>
              <div class="text-[12.5px] text-fg-2 mt-0.5 break-words">
                {{ errorMessage }}
              </div>
              <button
                type="button"
                @click="resetToPicked"
                class="focus-ring mt-2 text-[11.5px] text-danger hover:underline"
              >
                Erneut versuchen
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<style scoped>
@keyframes fade-in-0 {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes fade-out-0 {
  from { opacity: 1; }
  to { opacity: 0; }
}
.animate-in { animation-duration: 160ms; animation-timing-function: ease-out; }
.animate-out { animation-duration: 120ms; animation-timing-function: ease-in; }
.fade-in-0 { animation-name: fade-in-0; }
.fade-out-0 { animation-name: fade-out-0; }
</style>
