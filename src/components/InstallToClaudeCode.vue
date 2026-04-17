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
  Loader2,
  Copy,
  Check,
  X,
  Info,
} from 'lucide-vue-next'
import type { TransportKind } from '~/composables/useMcpInspector'
import {
  isDirectoryPickerSupported,
  pickProjectDirectory,
  inspectMcpJson,
  installToClaudeCode,
  sanitizeServerName,
  buildMcpEntry,
  buildSnippet,
  type ExistingFileInfo,
  type InstallResult,
} from '~/lib/claudeCodeInstall'

const props = defineProps<{
  url: string
  transport: TransportKind
  suggestedName: string
}>()

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

const entry = computed(() => buildMcpEntry(props.url, props.transport))
const snippet = computed(() =>
  buildSnippet(sanitizeServerName(serverName.value), entry.value),
)

const nameClean = computed(() => sanitizeServerName(serverName.value))
const nameValid = computed(() => nameClean.value.length > 0 && nameClean.value === serverName.value)

watch(open, (isOpen) => {
  if (isOpen) {
    serverName.value = props.suggestedName
    phase.value = 'idle'
    dirHandle.value = null
    fileInfo.value = null
    result.value = null
    errorMessage.value = null
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
              Für Claude Code installieren
            </DialogTitle>
            <DialogDescription class="text-[13px] text-fg-muted mt-0.5">
              Fügt diesen MCP-Server zur <code class="font-mono text-fg-2">.mcp.json</code>
              eines Projekt­ordners hinzu.
            </DialogDescription>
          </div>
          <DialogClose
            class="focus-ring shrink-0 p-1 text-fg-muted hover:text-fg rounded-md"
            aria-label="Schließen"
          >
            <X :size="16" />
          </DialogClose>
        </div>

        <div class="p-5 space-y-4 overflow-y-auto">
          <!-- Feature detection fallback -->
          <div
            v-if="!supported"
            class="p-3 bg-warning-soft border border-warning/30 rounded-lg text-[12.5px] text-fg-2 flex items-start gap-2"
          >
            <Info :size="14" class="text-warning shrink-0 mt-0.5" />
            <div>
              Dein Browser unterstützt keine Ordner-Auswahl (nur Chrome/Edge).
              Kopier stattdessen diesen Snippet in deine <code class="font-mono">.mcp.json</code>:
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

          <!-- Folder status -->
          <div v-if="supported">
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
                Browser öffnet den Windows-Ordner-Dialog. Der Inspector lädt nichts hoch —
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
