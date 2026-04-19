<script setup lang="ts">
import { computed } from 'vue'
import { Clock, Server, X } from 'lucide-vue-next'
import { useServerHistory } from '~/composables/useServerHistory'
import type { TransportKind } from '~/composables/useMcpPlayground'

defineEmits<{
  select: [url: string, transport: TransportKind]
}>()

const history = useServerHistory()

const entries = computed(() => history.entries.value)

function relative(at: number): string {
  const diffMs = Date.now() - at
  const s = Math.round(diffMs / 1000)
  if (s < 60) return 'gerade eben'
  const m = Math.round(s / 60)
  if (m < 60) return `vor ${m} Min.`
  const h = Math.round(m / 60)
  if (h < 24) return `vor ${h} Std.`
  const d = Math.round(h / 24)
  if (d < 30) return `vor ${d} Tag${d === 1 ? '' : 'en'}`
  const mo = Math.round(d / 30)
  return `vor ${mo} Mon.`
}

function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}
</script>

<template>
  <section
    v-if="entries.length > 0"
    class="mt-8 bg-surface/80 backdrop-blur-sm border border-border rounded-xl p-5"
  >
    <div class="flex items-baseline justify-between mb-3">
      <h3 class="text-[12px] uppercase tracking-wide font-semibold text-fg-muted">
        Zuletzt verbunden
      </h3>
      <button
        type="button"
        class="focus-ring text-[11px] text-fg-muted hover:text-danger underline underline-offset-2"
        @click="history.clear()"
      >
        Alle löschen
      </button>
    </div>

    <ul class="space-y-1.5">
      <li
        v-for="entry in entries"
        :key="entry.url"
        class="group flex items-stretch gap-2"
      >
        <button
          type="button"
          class="focus-ring flex-1 min-w-0 flex items-center gap-3 px-3 py-2 bg-surface border border-border rounded-md hover:border-accent/40 hover:bg-accent-soft/30 text-left transition-colors"
          @click="$emit('select', entry.url, entry.transport)"
        >
          <Server :size="13" class="shrink-0 text-accent" />
          <div class="flex-1 min-w-0">
            <div class="flex items-baseline gap-2">
              <span class="text-[13px] font-medium text-fg truncate">
                {{ entry.lastName ?? hostOf(entry.url) }}
              </span>
              <span class="font-mono uppercase text-[9.5px] text-fg-subtle tracking-wide shrink-0">
                {{ entry.transport }}
              </span>
            </div>
            <div class="font-mono text-[11.5px] text-fg-muted truncate mt-0.5">
              {{ entry.url }}
            </div>
          </div>
          <div class="hidden sm:flex items-center gap-1 text-[11px] text-fg-muted shrink-0">
            <Clock :size="10" />
            <span>{{ relative(entry.lastUsed) }}</span>
          </div>
        </button>
        <button
          type="button"
          class="focus-ring shrink-0 w-8 flex items-center justify-center bg-surface border border-border rounded-md text-fg-muted hover:text-danger hover:border-danger/40 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all"
          :aria-label="`${entry.url} aus Liste entfernen`"
          @click="history.remove(entry.url)"
        >
          <X :size="12" />
        </button>
      </li>
    </ul>
  </section>
</template>
