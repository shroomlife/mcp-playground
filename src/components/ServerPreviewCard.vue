<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Loader2, Server, CheckCircle2, KeyRound, Wrench, FileText, MessageSquareText, ShieldOff, AlertCircle } from 'lucide-vue-next'
import { previewServer, type ServerPreview } from '~/composables/useServerPreview'

const props = defineProps<{
  url: string
  /** Pass the landing form's connection-state so we stop probing once a real connection is underway. */
  skip?: boolean
}>()

type ProbeState = 'idle' | 'checking' | 'found' | 'empty' | 'unreachable'
const probeState = ref<ProbeState>('idle')
const preview = ref<ServerPreview | null>(null)
let abort: AbortController | null = null
let timer: ReturnType<typeof setTimeout> | null = null

function cancel() {
  abort?.abort()
  abort = null
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
}

watch(
  () => [props.url, props.skip] as const,
  ([url, skip]) => {
    cancel()
    const trimmed = url.trim()
    if (skip || !trimmed) {
      probeState.value = 'idle'
      preview.value = null
      return
    }
    try {
      new URL(trimmed)
    } catch {
      probeState.value = 'idle'
      preview.value = null
      return
    }
    probeState.value = 'checking'
    timer = setTimeout(() => {
      const controller = new AbortController()
      abort = controller
      previewServer(trimmed, controller.signal)
        .then((result) => {
          if (controller.signal.aborted) return
          if (result) {
            preview.value = result
            probeState.value = 'found'
          } else {
            preview.value = null
            probeState.value = 'empty'
          }
        })
        .catch(() => {
          if (controller.signal.aborted) return
          preview.value = null
          probeState.value = 'unreachable'
        })
    }, 500)
  },
  { immediate: true },
)

const title = computed<string>(() => {
  const p = preview.value
  if (p?.name) return p.name
  // URL kann zwischen Watcher und Render-Cycle ungültig werden — den TypeError
  // nicht propagieren lassen, stattdessen auf den Raw-String zurückfallen.
  try {
    return new URL(props.url).host
  } catch {
    return props.url
  }
})

const sortedCounts = computed(() => {
  const p = preview.value
  if (!p) return []
  const items: { icon: typeof Wrench; label: string; count: number | undefined }[] = []
  if (typeof p.toolCount === 'number') items.push({ icon: Wrench, label: 'Tools', count: p.toolCount })
  if (typeof p.resourceCount === 'number') items.push({ icon: FileText, label: 'Resources', count: p.resourceCount })
  if (typeof p.promptCount === 'number') items.push({ icon: MessageSquareText, label: 'Prompts', count: p.promptCount })
  return items
})
</script>

<template>
  <div
    v-if="probeState !== 'idle'"
    class="mt-3 bg-surface/70 backdrop-blur-sm border border-border rounded-lg overflow-hidden"
  >
    <!-- Checking -->
    <div
      v-if="probeState === 'checking'"
      class="flex items-center gap-2 px-3.5 py-2.5 text-[12px] text-fg-muted"
    >
      <Loader2 :size="12" class="animate-spin shrink-0" />
      <span>Server wird erkundet …</span>
    </div>

    <!-- Found -->
    <div v-else-if="probeState === 'found' && preview" class="flex items-start gap-3 px-3.5 py-3">
      <div class="mt-0.5 p-1.5 rounded-md bg-accent-soft text-accent shrink-0">
        <Server :size="14" :stroke-width="2" />
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-baseline gap-2 flex-wrap">
          <span class="font-mono text-[13.5px] font-semibold text-fg truncate">
            {{ title }}
          </span>
          <span v-if="preview.version" class="font-mono text-[11px] text-fg-muted tabular-nums">
            v{{ preview.version }}
          </span>
          <span class="text-[10.5px] uppercase tracking-wide text-fg-subtle font-medium">
            · Initialize-Probe
          </span>
        </div>
        <p
          v-if="preview.description"
          class="mt-1 text-[12px] text-fg-2 leading-[1.45] line-clamp-2"
        >
          {{ preview.description }}
        </p>
        <div class="mt-2 flex items-center gap-3 text-[11px] text-fg-muted flex-wrap">
          <span
            v-for="item in sortedCounts"
            :key="item.label"
            class="flex items-center gap-1 font-mono"
          >
            <component :is="item.icon" :size="11" class="text-accent" />
            <span class="tabular-nums">{{ item.count }}</span>
            {{ item.label }}
          </span>
          <span
            v-if="preview.authMode === 'oauth'"
            class="flex items-center gap-1 text-accent"
          >
            <KeyRound :size="11" />
            OAuth erforderlich
          </span>
          <span
            v-else-if="preview.authMode === 'none'"
            class="flex items-center gap-1 text-success"
          >
            <CheckCircle2 :size="11" />
            keine Auth
          </span>
        </div>
      </div>
    </div>

    <!-- Empty: probe ran aber kein Server-Info zurück — Server antwortet, liefert
         aber keinen validen initialize-Response. Muted hint statt Rot. -->
    <div
      v-else-if="probeState === 'empty'"
      class="flex items-center gap-2 px-3.5 py-2.5 text-[11.5px] text-fg-muted"
    >
      <ShieldOff :size="12" class="shrink-0" />
      <span>
        Keine Server-Metadaten aus dem <code class="font-mono">initialize</code>-Probe.
        Beim Verbinden wird es neu versucht.
      </span>
    </div>

    <!-- Unreachable: probe error. Likely network / CORS / typo. -->
    <div
      v-else-if="probeState === 'unreachable'"
      class="flex items-center gap-2 px-3.5 py-2.5 text-[11.5px] text-warning"
    >
      <AlertCircle :size="12" class="shrink-0" />
      <span>Server nicht erreichbar — Host, Port und Protokoll prüfen.</span>
    </div>
  </div>
</template>
