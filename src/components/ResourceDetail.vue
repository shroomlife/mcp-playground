<script setup lang="ts">
import { computed, nextTick, onMounted, ref, useTemplateRef } from 'vue'
import { Loader2, Play, FileText, Link2, Download, Clock, Square, Eye } from 'lucide-vue-next'
import JsonView from './JsonView.vue'
import { useAbortableRun } from '~/composables/useAbortableRun'
import type {
  CallHistoryEntry,
  CallOptions,
  McpResource,
  McpResourceTemplate,
  ResourceReadResult,
} from '~/composables/useMcpPlayground'

const props = defineProps<{
  target:
    | { kind: 'static'; resource: McpResource }
    | { kind: 'template'; resource: McpResourceTemplate }
  history: CallHistoryEntry[]
  isConnected: boolean
  readResource: (uri: string, options?: CallOptions) => Promise<CallHistoryEntry>
}>()

const PLACEHOLDER_RE = /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g

function extractPlaceholders(template: string): string[] {
  const found = new Set<string>()
  for (const match of template.matchAll(PLACEHOLDER_RE)) {
    const name = match[1]
    if (name) found.add(name)
  }
  return [...found]
}

const uriTemplate = computed(() =>
  props.target.kind === 'template' ? props.target.resource.uriTemplate : props.target.resource.uri,
)

const placeholders = computed(() =>
  props.target.kind === 'template' ? extractPlaceholders(uriTemplate.value) : [],
)

function initialValues(): Record<string, string> {
  const record: Record<string, string> = {}
  for (const p of placeholders.value) record[p] = ''
  return record
}

const values = ref<Record<string, string>>(initialValues())
const lastEntry = ref<CallHistoryEntry | null>(null)
const rootRef = useTemplateRef<HTMLDivElement>('rootRef')
const formRef = useTemplateRef<HTMLFormElement>('formRef')

// See ToolDetail for rationale — scroll the header into view after the remount.
onMounted(() => {
  void nextTick(() => {
    rootRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
})

const { running, progress, progressPercent, run, cancel } = useAbortableRun<CallHistoryEntry>()

const missingPlaceholders = computed(() =>
  placeholders.value.filter((p) => !(values.value[p] ?? '').trim()),
)

const builtUri = computed(() => {
  if (props.target.kind === 'static') return props.target.resource.uri
  return uriTemplate.value.replace(PLACEHOLDER_RE, (_match, name: string) => {
    const v = values.value[name] ?? ''
    return encodeURIComponent(v)
  })
})

const canRead = computed(
  () => props.isConnected && !running.value && missingPlaceholders.value.length === 0,
)

async function submit() {
  if (!canRead.value) return
  const entry = await run((options) => props.readResource(builtUri.value, options))
  if (entry) lastEntry.value = entry
}

const lastResult = computed<ResourceReadResult | null>(() => {
  const r = lastEntry.value?.result
  return r ? (r as ResourceReadResult) : null
})

// Match entries for THIS resource: exact URI for static, regex for templates.
const templateMatcher = computed<RegExp | null>(() => {
  if (props.target.kind !== 'template') return null
  const pattern = uriTemplate.value.replace(
    /[.*+?^${}()|[\]\\]/g,
    (ch) => `\\${ch}`,
  ).replace(/\\\{[a-zA-Z_][a-zA-Z0-9_]*\\\}/g, '[^/]*')
  return new RegExp(`^${pattern}$`)
})

const recentHistory = computed(() => {
  const target = props.target
  const matcher = templateMatcher.value
  return props.history
    .filter((entry) => {
      if (entry.kind !== 'resource') return false
      if (target.kind === 'static') return entry.name === target.resource.uri
      return matcher?.test(entry.name) ?? false
    })
    .slice(0, 8)
})

function replay(entry: CallHistoryEntry) {
  lastEntry.value = entry
  resultRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const resultRef = useTemplateRef<HTMLElement>('resultRef')

function formatTime(at: number): string {
  return new Date(at).toLocaleTimeString('de-DE', { hour12: false })
}

function blobInfo(content: { mimeType?: string; blob?: string }): { kb: number; mime: string } {
  const bytes = content.blob ? Math.ceil((content.blob.length * 3) / 4) : 0
  return { kb: Math.round(bytes / 102.4) / 10, mime: content.mimeType ?? 'application/octet-stream' }
}

function downloadBlob(content: { uri: string; mimeType?: string; blob?: string }) {
  if (!content.blob) return
  const mime = content.mimeType ?? 'application/octet-stream'
  const link = document.createElement('a')
  link.href = `data:${mime};base64,${content.blob}`
  const name = content.uri.split('/').pop() || 'resource'
  link.download = name
  link.click()
}
</script>

<template>
  <div ref="rootRef" class="flex flex-col min-h-0">
    <!-- Head -->
    <header class="px-5 md:px-6 pt-5 pb-4 border-b border-border bg-surface-2/30">
      <div class="flex items-center gap-2 text-[11px] uppercase tracking-wide text-fg-muted font-medium mb-1">
        <component :is="target.kind === 'template' ? Link2 : FileText" :size="11" />
        <span>{{ target.kind === 'template' ? 'Resource-Template' : 'Resource' }}</span>
      </div>
      <div class="font-mono text-[14.5px] text-fg break-all">
        {{ uriTemplate }}
      </div>
      <p
        v-if="target.resource.description"
        class="mt-2 text-[13px] text-fg-2 leading-[1.55] whitespace-pre-line max-w-[62ch]"
      >
        {{ target.resource.description }}
      </p>
      <dl
        v-if="target.resource.name || target.resource.title || target.resource.mimeType"
        class="mt-3 grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-[11.5px]"
      >
        <template v-if="target.resource.name">
          <dt class="text-fg-muted">Name</dt>
          <dd class="font-mono text-fg-2 break-all">
            {{ target.resource.name }}
          </dd>
        </template>
        <template v-if="target.resource.title">
          <dt class="text-fg-muted">Titel</dt>
          <dd class="text-fg-2">
            {{ target.resource.title }}
          </dd>
        </template>
        <template v-if="target.resource.mimeType">
          <dt class="text-fg-muted">MIME</dt>
          <dd class="font-mono text-fg-2">
            {{ target.resource.mimeType }}
          </dd>
        </template>
      </dl>
    </header>

    <!-- Form section -->
    <form
      ref="formRef"
      class="px-5 md:px-6 py-5 border-b border-border"
      @submit.prevent="submit"
    >
      <div v-if="target.kind === 'static'" class="text-[12.5px] text-fg-muted">
        Statische Resource — keine Platzhalter.
        Der URI oben wird direkt an <code class="font-mono text-fg-2">resources/read</code>
        geschickt.
      </div>

      <div v-else>
        <div class="flex items-baseline justify-between mb-3">
          <h4 class="text-[11px] uppercase tracking-wide text-fg-muted font-medium">
            Platzhalter
          </h4>
          <span class="text-[11px] text-fg-subtle font-mono">
            {{ placeholders.length }} · alle required
          </span>
        </div>
        <div class="space-y-3">
          <div
            v-for="name in placeholders"
            :key="name"
            class="space-y-1"
          >
            <label
              :for="`placeholder-${name}`"
              class="block text-[12px] font-medium text-fg-2"
            >
              <span class="font-mono">{{ '{' }}{{ name }}{{ '}' }}</span>
              <span class="text-danger ml-0.5">*</span>
            </label>
            <input
              :id="`placeholder-${name}`"
              v-model="values[name]"
              type="text"
              spellcheck="false"
              autocomplete="off"
              :disabled="!isConnected || running"
              class="focus-ring w-full h-9 px-2.5 bg-surface border border-border-strong rounded-md font-mono text-[12.5px] text-fg placeholder:text-fg-subtle focus:border-accent focus:outline-none disabled:bg-surface-2"
            />
          </div>
        </div>

        <div
          class="mt-3 p-2.5 bg-surface-2 border border-border rounded-md font-mono text-[11.5px] text-fg-2 break-all"
          aria-label="Resultierender URI"
        >
          <span class="text-fg-muted uppercase tracking-wide text-[10px] mr-2">URI</span>
          {{ builtUri }}
        </div>
      </div>

      <div
        class="flex items-center gap-3 flex-wrap"
        :class="target.kind === 'template' ? 'mt-4' : ''"
      >
        <button
          v-if="!running"
          type="submit"
          :disabled="!isConnected || missingPlaceholders.length > 0"
          class="focus-ring inline-flex items-center gap-2 h-10 px-4 bg-accent text-white rounded-md text-[13px] font-medium hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Play :size="14" />
          Inhalt lesen
        </button>
        <button
          v-else
          type="button"
          class="focus-ring inline-flex items-center gap-2 h-10 px-4 bg-surface border border-danger/30 text-danger rounded-md text-[13px] font-medium hover:bg-danger-soft transition-colors"
          @click="cancel"
        >
          <Square :size="12" :stroke-width="2.5" class="fill-current" />
          Abbrechen
        </button>
        <p
          v-if="!isConnected"
          class="text-[11.5px] text-danger"
        >
          Nicht verbunden.
        </p>
        <p
          v-else-if="!running && missingPlaceholders.length > 0"
          class="text-[11.5px] text-danger"
        >
          Platzhalter fehlt: {{ missingPlaceholders.join(', ') }}
        </p>
      </div>

      <div v-if="running" class="mt-4 space-y-1.5" role="status" aria-live="polite">
        <div class="h-1.5 bg-surface-2 border border-border rounded-full overflow-hidden">
          <div
            v-if="progressPercent !== null"
            class="h-full bg-accent transition-[width] duration-300 ease-out"
            :style="{ width: `${progressPercent}%` }"
          />
          <div v-else class="h-full w-1/3 bg-accent rounded-full indeterminate-bar" />
        </div>
        <div class="flex items-baseline justify-between gap-3 text-[11.5px] text-fg-muted">
          <span class="truncate">
            <Loader2 :size="11" class="inline-block mr-1 animate-spin align-[-1px]" />
            <span v-if="progress?.message">{{ progress.message }}</span>
            <span v-else>Läuft — warte auf Server-Antwort …</span>
          </span>
          <span v-if="progressPercent !== null" class="font-mono tabular-nums shrink-0">
            {{ progressPercent }}%
          </span>
        </div>
      </div>
    </form>

    <!-- Result -->
    <section
      v-if="lastEntry"
      ref="resultRef"
      class="px-5 md:px-6 py-5 border-b border-border"
    >
      <div class="flex items-baseline justify-between mb-3">
        <h4 class="text-[11px] uppercase tracking-wide text-fg-muted font-medium">
          Inhalt
        </h4>
        <span class="text-[11px] text-fg-muted font-mono tabular-nums">
          {{ formatTime(lastEntry.at) }} · {{ lastEntry.durationMs }} ms
        </span>
      </div>

      <div
        v-if="lastEntry.error === 'Abgebrochen'"
        class="p-3 bg-warning-soft border border-warning/30 rounded-lg text-[12.5px] text-fg-muted"
        role="status"
      >
        Abgebrochen — du hast den Read gestoppt, bevor eine Antwort ankam.
      </div>
      <div
        v-else-if="lastEntry.error"
        class="p-3 bg-danger-soft border border-danger/30 rounded-lg text-[12.5px] text-danger"
        role="alert"
      >
        {{ lastEntry.error }}
      </div>

      <div
        v-else-if="lastResult && (!Array.isArray(lastResult.contents) || lastResult.contents.length === 0)"
        class="text-[12.5px] text-fg-muted italic"
      >
        Kein Inhalt zurückgegeben.
      </div>

      <ul v-else-if="lastResult && Array.isArray(lastResult.contents)" class="space-y-3">
        <li
          v-for="(content, i) in lastResult.contents"
          :key="i"
          class="border border-border rounded-lg overflow-hidden"
        >
          <div class="flex items-center justify-between gap-2 px-3 py-1.5 bg-surface-2 border-b border-border text-[11px] text-fg-muted font-mono">
            <span class="truncate">{{ content.uri }}</span>
            <span v-if="content.mimeType" class="shrink-0">{{ content.mimeType }}</span>
          </div>
          <div class="bg-surface">
            <pre
              v-if="typeof content.text === 'string'"
              class="font-mono text-[12px] leading-[1.55] whitespace-pre-wrap break-words text-fg-2 px-3 py-2.5 max-h-[360px] overflow-auto"
            >{{ content.text }}</pre>
            <div
              v-else-if="content.blob"
              class="flex items-center justify-between gap-3 px-3 py-2.5"
            >
              <div class="text-[12px] text-fg-muted">
                Binärer Inhalt — {{ blobInfo(content).kb }} KB
                <span class="font-mono text-fg-2">
                  ({{ blobInfo(content).mime }})
                </span>
              </div>
              <button
                type="button"
                class="focus-ring inline-flex items-center gap-1.5 h-8 px-3 bg-surface border border-border-strong rounded-md text-[12px] text-fg-2 hover:text-fg hover:border-fg/30 transition-colors"
                @click="downloadBlob(content)"
              >
                <Download :size="12" />
                Herunterladen
              </button>
            </div>
            <div v-else class="px-3 py-2.5">
              <JsonView :value="content" :max-lines="10" />
            </div>
          </div>
        </li>
      </ul>
    </section>

    <!-- History -->
    <section
      v-if="recentHistory.length > 0"
      class="px-5 md:px-6 py-5"
    >
      <div class="flex items-baseline justify-between mb-3">
        <h4 class="text-[11px] uppercase tracking-wide text-fg-muted font-medium">
          Letzte Reads
        </h4>
        <span class="text-[11px] text-fg-subtle font-mono">
          URI &amp; Response — klick zum Anzeigen
        </span>
      </div>
      <ul class="space-y-1">
        <li
          v-for="entry in recentHistory"
          :key="entry.id"
          class="flex items-center gap-3 px-3 py-1.5 bg-surface border border-border rounded-md font-mono text-[11.5px] hover:bg-surface-2 transition-colors"
          :class="lastEntry?.id === entry.id ? 'border-cat-resource/40 bg-cat-resource-soft/40' : ''"
        >
          <span
            class="size-1.5 rounded-full shrink-0"
            :class="entry.success ? 'bg-success' : 'bg-danger'"
          />
          <span class="text-fg-muted tabular-nums w-12 shrink-0">
            {{ formatTime(entry.at) }}
          </span>
          <span class="flex items-center gap-1 text-fg-muted shrink-0 w-14">
            <Clock :size="10" />
            <span class="tabular-nums">{{ entry.durationMs }}ms</span>
          </span>
          <button
            type="button"
            class="focus-ring flex-1 min-w-0 truncate text-left text-fg-2 hover:text-fg"
            title="Response dieses Reads anzeigen"
            @click="replay(entry)"
          >
            {{ entry.name }}
          </button>
          <button
            type="button"
            class="focus-ring shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10.5px] text-fg-muted hover:text-cat-resource hover:bg-cat-resource-soft/60 transition-colors"
            title="Response anzeigen"
            @click="replay(entry)"
          >
            <Eye :size="11" />
            Response
          </button>
        </li>
      </ul>
    </section>
  </div>
</template>
