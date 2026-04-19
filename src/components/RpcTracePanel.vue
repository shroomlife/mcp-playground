<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowUp, ArrowDown, ChevronRight, Search, X, Bell, Zap, OctagonAlert, CheckCircle2 } from 'lucide-vue-next'
import JsonView from './JsonView.vue'
import type { TraceEntry } from '~/composables/useMcpPlayground'

const props = defineProps<{
  entries: TraceEntry[]
}>()

const query = ref('')
const normalized = computed(() => query.value.trim().toLowerCase())

const filtered = computed(() => {
  const q = normalized.value
  if (!q) return props.entries
  return props.entries.filter((e) => {
    if (e.method && e.method.toLowerCase().includes(q)) return true
    if (e.rpcId !== undefined && String(e.rpcId).includes(q)) return true
    if (e.kind.includes(q)) return true
    return false
  })
})

const expanded = ref<Set<number>>(new Set())
function toggle(id: number) {
  const next = new Set(expanded.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expanded.value = next
}

function formatTime(at: number): string {
  const d = new Date(at)
  return (
    d.toLocaleTimeString('de-DE', { hour12: false }) +
    '.' +
    String(d.getMilliseconds()).padStart(3, '0')
  )
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function entryPayload(e: TraceEntry): unknown {
  if (e.kind === 'response') return e.result
  if (e.kind === 'error') return e.error
  return e.params
}
</script>

<template>
  <div v-if="entries.length === 0" class="px-6 py-14 text-center">
    <div class="text-[13px] text-fg-muted">Noch kein Traffic. Sobald du Tools aufrufst, siehst du hier jeden JSON-RPC-Request + die Antwort.</div>
  </div>

  <div v-else class="flex flex-col">
    <div class="px-3.5 py-2.5 border-b border-border flex items-center gap-2">
      <Search :size="12" class="text-fg-muted shrink-0" />
      <input
        v-model="query"
        type="search"
        placeholder="Filter: Method, rpc-id, kind"
        spellcheck="false"
        autocomplete="off"
        aria-label="Trace durchsuchen"
        class="focus-ring flex-1 h-7 bg-transparent text-[12px] text-fg placeholder:text-fg-muted focus:outline-none font-mono"
      />
      <button
        v-if="query"
        type="button"
        class="focus-ring shrink-0 p-1 text-fg-muted hover:text-fg rounded"
        aria-label="Filter leeren"
        @click="query = ''"
      >
        <X :size="11" />
      </button>
      <span class="font-mono text-[11px] text-fg-muted tabular-nums">
        {{ filtered.length }} / {{ entries.length }}
      </span>
    </div>

    <ul
      class="divide-y divide-border max-h-[560px] overflow-y-auto"
      role="log"
      aria-label="JSON-RPC-Trace"
    >
      <li
        v-for="entry in filtered"
        :key="entry.id"
        class="flex flex-col"
      >
        <button
          type="button"
          class="focus-ring w-full flex items-center gap-2.5 px-4 py-1.5 text-left hover:bg-surface-2 transition-colors font-mono text-[11.5px]"
          :aria-expanded="expanded.has(entry.id)"
          @click="toggle(entry.id)"
        >
          <ChevronRight
            :size="10"
            class="text-fg-muted shrink-0 transition-transform"
            :class="expanded.has(entry.id) ? 'rotate-90' : ''"
          />
          <span class="shrink-0 w-[14px] flex items-center justify-center">
            <ArrowUp
              v-if="entry.direction === 'outgoing'"
              :size="10"
              class="text-accent"
            />
            <ArrowDown
              v-else-if="entry.kind === 'error'"
              :size="10"
              class="text-danger"
            />
            <Bell
              v-else-if="entry.kind === 'notification'"
              :size="10"
              class="text-warning"
            />
            <CheckCircle2
              v-else-if="entry.kind === 'response'"
              :size="10"
              class="text-success"
            />
            <Zap
              v-else
              :size="10"
              class="text-fg-muted"
            />
          </span>
          <span class="shrink-0 text-fg-muted tabular-nums w-24">
            {{ formatTime(entry.at) }}
          </span>
          <span
            class="shrink-0 w-14 text-[9.5px] uppercase tracking-wide font-medium"
            :class="{
              'text-accent': entry.direction === 'outgoing',
              'text-danger': entry.kind === 'error',
              'text-warning': entry.kind === 'notification' && entry.direction === 'incoming',
              'text-success': entry.kind === 'response',
              'text-fg-muted': entry.kind === 'request' && entry.direction === 'incoming',
            }"
          >
            {{ entry.kind }}
          </span>
          <span
            v-if="entry.rpcId !== undefined"
            class="shrink-0 text-fg-subtle tabular-nums w-14"
          >
            #{{ entry.rpcId }}
          </span>
          <span v-else class="shrink-0 w-14" />
          <span class="flex-1 min-w-0 truncate text-fg">
            {{ entry.method ?? '—' }}
          </span>
          <span class="shrink-0 text-fg-subtle tabular-nums">
            {{ formatSize(entry.sizeBytes) }}
          </span>
        </button>
        <div
          v-if="expanded.has(entry.id)"
          class="px-8 pb-3 pt-1 bg-surface-2/40 border-t border-border"
        >
          <div class="flex items-center gap-1.5 mb-1 text-[10.5px] uppercase tracking-wide text-fg-muted">
            <OctagonAlert v-if="entry.kind === 'error'" :size="10" class="text-danger" />
            {{
              entry.kind === 'error' ? 'Error'
                : entry.kind === 'response' ? 'Result'
                  : 'Params'
            }}
          </div>
          <JsonView
            :value="entryPayload(entry)"
            initially-expanded
          />
        </div>
      </li>
    </ul>
  </div>
</template>
