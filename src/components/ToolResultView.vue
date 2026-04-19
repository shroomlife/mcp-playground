<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { OctagonAlert, CircleSlash, FileText, Image as ImageIcon, Link2, Copy, Check } from 'lucide-vue-next'
import JsonView from './JsonView.vue'
import type { ToolCallResult } from '~/composables/useMcpPlayground'

const props = defineProps<{
  result: ToolCallResult | null
  error?: string
  durationMs?: number
}>()

const wasAborted = computed(() => props.error === 'Abgebrochen')

type Mode = 'pretty' | 'explorer' | 'raw'
const mode = ref<Mode>('pretty')

// Many MCP tools return their payload as a `text` content item whose body is itself
// a JSON string. We detect and parse that so the Pretty view and the default-mode
// heuristic both treat it as structured data instead of an opaque string blob.
function parseJsonText(text: unknown): unknown | undefined {
  if (typeof text !== 'string') return undefined
  const trimmed = text.trim()
  if (!trimmed) return undefined
  const firstChar = trimmed[0]
  if (firstChar !== '{' && firstChar !== '[') return undefined
  try {
    return JSON.parse(trimmed)
  } catch {
    return undefined
  }
}

const looksLikeJson = computed<boolean>(() => {
  const r = props.result
  if (!r) return false
  if (r.structuredContent !== undefined && r.structuredContent !== null) return true
  const content = r.content ?? []
  if (content.length === 0) return false
  // All content items must be either JSON-parseable text, or resource references —
  // i.e. no images or plain prose, which would benefit more from the Pretty renderer.
  return content.every((item) => {
    if (item.type === 'text') return parseJsonText(item.text) !== undefined
    if (item.type === 'resource') return true
    return false
  })
})

// Pick a sensible default mode the FIRST time a non-null result arrives, then respect
// the user's tab choice for subsequent runs of the same tool. Remount (new tool) gives
// a fresh default again because the whole component is keyed by `tool.name`.
let initialModeChosen = false
watch(
  () => props.result,
  (r) => {
    if (!initialModeChosen && r) {
      mode.value = looksLikeJson.value ? 'explorer' : 'pretty'
      initialModeChosen = true
    }
  },
  { immediate: true },
)

const rawJson = computed(() => {
  if (!props.result) return ''
  try {
    return JSON.stringify(props.result, null, 2)
  } catch {
    return String(props.result)
  }
})

const rawCopied = ref(false)
let rawCopyTimer: ReturnType<typeof setTimeout> | null = null
async function copyRaw() {
  try {
    await navigator.clipboard.writeText(rawJson.value)
    rawCopied.value = true
    if (rawCopyTimer) clearTimeout(rawCopyTimer)
    rawCopyTimer = setTimeout(() => (rawCopied.value = false), 1200)
  } catch {
    // clipboard not available
  }
}

const contentItems = computed(() => {
  if (!props.result?.content) return []
  return props.result.content
})

const hasStructured = computed(() => !!props.result?.structuredContent)

const IMAGE_MIMES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp'])

function isImageItem(item: Record<string, unknown>): boolean {
  return (
    item.type === 'image' &&
    typeof item.data === 'string' &&
    typeof item.mimeType === 'string' &&
    IMAGE_MIMES.has(item.mimeType)
  )
}

function asText(item: Record<string, unknown>): string {
  return typeof item.text === 'string' ? item.text : ''
}

function asImageSrc(item: Record<string, unknown>): string {
  const mime = item.mimeType as string
  const data = item.data as string
  return `data:${mime};base64,${data}`
}

function resourceUri(item: Record<string, unknown>): string {
  const res = item.resource as Record<string, unknown> | undefined
  return typeof res?.uri === 'string' ? res.uri : ''
}
</script>

<template>
  <div class="space-y-3">
    <!-- Aborted state — user-initiated cancel, not a failure -->
    <div
      v-if="wasAborted"
      class="flex items-start gap-3 p-3 bg-warning-soft border border-warning/30 rounded-lg"
      role="status"
    >
      <CircleSlash :size="15" class="text-warning shrink-0 mt-0.5" />
      <div class="flex-1 min-w-0">
        <div class="text-[12.5px] font-medium text-fg">Abgebrochen</div>
        <p class="text-[12.5px] text-fg-muted mt-0.5">
          Du hast den Aufruf gestoppt, bevor eine Antwort ankam.
        </p>
      </div>
    </div>

    <!-- Error state -->
    <div
      v-else-if="error"
      class="flex items-start gap-3 p-3 bg-danger-soft border border-danger/30 rounded-lg"
      role="alert"
    >
      <OctagonAlert :size="15" class="text-danger shrink-0 mt-0.5" />
      <div class="flex-1 min-w-0">
        <div class="text-[12.5px] font-medium text-danger">Tool-Call fehlgeschlagen</div>
        <p class="text-[12.5px] text-fg-2 mt-0.5 break-words">{{ error }}</p>
      </div>
    </div>

    <template v-else-if="result">
      <!-- Meta strip -->
      <div class="flex items-center justify-between gap-3">
        <div class="flex items-center gap-2 text-[11.5px]">
          <span
            class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-medium"
            :class="result.isError
              ? 'bg-danger-soft text-danger'
              : 'bg-success-soft text-success'"
          >
            <span
              class="size-1.5 rounded-full"
              :class="result.isError ? 'bg-danger' : 'bg-success'"
            />
            {{ result.isError ? 'isError' : 'ok' }}
          </span>
          <span v-if="durationMs !== undefined" class="font-mono text-fg-muted">
            {{ durationMs }} ms
          </span>
        </div>
        <div
          role="tablist"
          aria-label="Darstellung"
          class="flex items-center p-0.5 bg-surface-2 border border-border rounded-md"
        >
          <button
            type="button"
            role="tab"
            :aria-selected="mode === 'pretty'"
            class="focus-ring px-2 h-6 rounded text-[11px] font-medium transition-colors"
            :class="mode === 'pretty' ? 'bg-surface text-fg' : 'text-fg-muted hover:text-fg'"
            title="Gerenderte Inhalts-Blöcke (Text, Bild, Resource)"
            @click="mode = 'pretty'"
          >
            Pretty
          </button>
          <button
            type="button"
            role="tab"
            :aria-selected="mode === 'explorer'"
            class="focus-ring px-2 h-6 rounded text-[11px] font-medium transition-colors"
            :class="mode === 'explorer' ? 'bg-surface text-fg' : 'text-fg-muted hover:text-fg'"
            title="Kollabierbarer JSON-Baum mit Such-Filter"
            @click="mode = 'explorer'"
          >
            Explorer
          </button>
          <button
            type="button"
            role="tab"
            :aria-selected="mode === 'raw'"
            class="focus-ring px-2 h-6 rounded text-[11px] font-medium transition-colors"
            :class="mode === 'raw' ? 'bg-surface text-fg' : 'text-fg-muted hover:text-fg'"
            title="Reiner JSON-Text zum Kopieren"
            @click="mode = 'raw'"
          >
            Raw
          </button>
        </div>
      </div>

      <!-- Pretty view -->
      <div v-if="mode === 'pretty'" class="space-y-3">
        <div
          v-if="contentItems.length === 0 && !hasStructured"
          class="text-[12.5px] text-fg-muted italic"
        >
          Tool hat keinen Content zurückgegeben.
        </div>

        <template v-for="(item, i) in contentItems" :key="i">
          <!-- text — if the body is JSON, render as a tree instead of an opaque blob -->
          <div v-if="item.type === 'text'">
            <div class="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-fg-muted font-medium mb-1">
              <FileText :size="11" />
              <span>text</span>
              <span v-if="parseJsonText(item.text) !== undefined" class="font-mono normal-case tracking-normal text-fg-subtle">· JSON</span>
            </div>
            <JsonView
              v-if="parseJsonText(item.text) !== undefined"
              :value="parseJsonText(item.text)"
            />
            <pre
              v-else
              class="font-mono text-[12px] leading-[1.55] whitespace-pre-wrap break-words text-fg bg-surface-2 border border-border rounded-md px-3 py-2.5"
            >{{ asText(item) }}</pre>
          </div>

          <!-- image (allowlist mimetypes) -->
          <div v-else-if="isImageItem(item)">
            <div class="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-fg-muted font-medium mb-1">
              <ImageIcon :size="11" /> image · {{ item.mimeType }}
            </div>
            <img
              :src="asImageSrc(item)"
              :alt="`Tool-Output Bild ${i + 1}`"
              class="max-w-full rounded-md border border-border"
            />
          </div>

          <!-- resource -->
          <div v-else-if="item.type === 'resource'">
            <div class="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-fg-muted font-medium mb-1">
              <Link2 :size="11" /> resource
            </div>
            <div class="p-2.5 bg-surface-2 border border-border rounded-md">
              <div v-if="resourceUri(item)" class="font-mono text-[12px] text-fg break-all">
                {{ resourceUri(item) }}
              </div>
              <JsonView :value="item" :max-lines="10" />
            </div>
          </div>

          <!-- unknown type fallback -->
          <div v-else>
            <div class="text-[11px] uppercase tracking-wide text-fg-muted font-medium mb-1">
              {{ item.type }}
            </div>
            <JsonView :value="item" :max-lines="20" />
          </div>
        </template>

        <!-- structuredContent -->
        <div v-if="hasStructured">
          <div class="text-[11px] uppercase tracking-wide text-fg-muted font-medium mb-1">
            structuredContent
          </div>
          <JsonView :value="result.structuredContent" />
        </div>
      </div>

      <!-- Explorer view — full result as searchable tree -->
      <div v-else-if="mode === 'explorer'">
        <JsonView :value="result" />
      </div>

      <!-- Raw view — plain JSON text, copy-friendly -->
      <div v-else class="relative group">
        <pre
          class="font-mono text-[12px] leading-[1.55] whitespace-pre-wrap break-words text-fg-2 bg-surface-2 border border-border rounded-md px-3 py-2.5 max-h-[480px] overflow-auto"
        >{{ rawJson }}</pre>
        <button
          type="button"
          class="focus-ring absolute top-2 right-2 inline-flex items-center gap-1 h-6 px-2 bg-surface border border-border rounded text-[10.5px] font-medium text-fg-muted hover:text-fg opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
          title="JSON in die Zwischenablage kopieren"
          @click="copyRaw"
        >
          <Check v-if="rawCopied" :size="11" class="text-success" />
          <Copy v-else :size="11" />
          {{ rawCopied ? 'kopiert' : 'kopieren' }}
        </button>
      </div>
    </template>

    <div v-else class="text-[12.5px] text-fg-muted italic">
      Noch kein Aufruf. Argumente eintragen und „Ausführen" drücken.
    </div>
  </div>
</template>
