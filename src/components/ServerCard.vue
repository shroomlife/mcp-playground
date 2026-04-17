<script setup lang="ts">
import { computed } from 'vue'
import { Sparkle } from 'lucide-vue-next'
import type { ServerSummary } from '~/composables/useMcpInspector'

const props = defineProps<{
  server: ServerSummary | null
  capabilities: string[]
  latencyMs: number | null
  connectedAt: number | null
  counts: { tools: number; resources: number; prompts: number }
}>()

const connectedAtLabel = computed(() => {
  if (!props.connectedAt) return '—'
  return new Date(props.connectedAt).toLocaleTimeString('de-DE')
})
</script>

<template>
  <section v-if="server" class="anim-in">
    <div class="flex items-baseline justify-between mb-3">
      <div class="flex items-baseline gap-3">
        <span class="text-[10px] uppercase tracking-[0.18em] text-muted">§ 02 —</span>
        <h2 class="font-display italic text-[22px] leading-none text-ink">Dossier</h2>
      </div>
      <div class="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-muted">
        <span class="size-1.5 rounded-full bg-moss pulse-dot" />
        online
      </div>
    </div>

    <div
      class="relative bg-white/80 border border-rule shadow-paper rounded-sm overflow-hidden"
    >
      <!-- Top bar with filing metadata -->
      <div
        class="flex items-center justify-between px-5 py-2 border-b border-hairline bg-paper-2/60"
      >
        <span class="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
          File № {{ (connectedAt ?? 0).toString(36).toUpperCase().slice(-6) }}
        </span>
        <span class="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
          protocol {{ server.protocolVersion }}
        </span>
      </div>

      <!-- Title block -->
      <div class="px-5 pt-5 pb-4 border-b border-hairline">
        <div class="flex items-start gap-4">
          <div class="pt-1">
            <Sparkle :size="18" :stroke-width="1.5" class="text-rust" />
          </div>
          <div class="flex-1 min-w-0">
            <div class="font-display text-[34px] md:text-[40px] leading-[1.02] text-ink tracking-tight break-all">
              {{ server.name }}<span class="italic text-rust">.</span>
            </div>
            <div class="mt-1 flex items-baseline gap-3 flex-wrap">
              <span class="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
                version
              </span>
              <span class="font-mono text-[13px] text-ink">{{ server.version }}</span>
              <span class="ascii-rule w-6" />
              <span class="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
                handshake
              </span>
              <span class="font-mono text-[13px] text-ink">
                {{ latencyMs !== null ? `${latencyMs}ms` : '—' }}
              </span>
              <span class="ascii-rule w-6" />
              <span class="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
                opened
              </span>
              <span class="font-mono text-[13px] text-ink">{{ connectedAtLabel }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Instructions -->
      <div
        v-if="server.instructions"
        class="px-5 py-4 border-b border-hairline bg-paper/50"
      >
        <div class="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-1.5">
          Server note
        </div>
        <p
          class="font-display italic text-[17px] leading-[1.4] text-ink-2 max-w-3xl"
        >
          &ldquo;{{ server.instructions }}&rdquo;
        </p>
      </div>

      <!-- Capabilities + counts grid -->
      <div class="grid grid-cols-2 md:grid-cols-4 divide-x divide-hairline border-b border-hairline">
        <div class="px-5 py-4">
          <div class="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
            Tools
          </div>
          <div class="font-display text-[32px] leading-none mt-1.5 text-ink">
            {{ String(counts.tools).padStart(2, '0') }}
          </div>
        </div>
        <div class="px-5 py-4">
          <div class="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
            Resources
          </div>
          <div class="font-display text-[32px] leading-none mt-1.5 text-ink">
            {{ String(counts.resources).padStart(2, '0') }}
          </div>
        </div>
        <div class="px-5 py-4">
          <div class="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
            Prompts
          </div>
          <div class="font-display text-[32px] leading-none mt-1.5 text-ink">
            {{ String(counts.prompts).padStart(2, '0') }}
          </div>
        </div>
        <div class="px-5 py-4">
          <div class="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
            Capabilities
          </div>
          <div class="font-display text-[32px] leading-none mt-1.5 text-ink">
            {{ String(capabilities.length).padStart(2, '0') }}
          </div>
        </div>
      </div>

      <!-- Capability chips -->
      <div class="px-5 py-3.5 flex flex-wrap items-center gap-1.5">
        <span class="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mr-2">
          declared ⟶
        </span>
        <span
          v-for="cap in capabilities"
          :key="cap"
          class="inline-flex items-center gap-1.5 px-2.5 py-1 border border-rule rounded-full font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink"
        >
          <span class="size-1 rounded-full bg-rust" />
          {{ cap }}
        </span>
        <span v-if="!capabilities.length" class="font-mono text-[11px] text-muted italic">
          keine capabilities gemeldet
        </span>
      </div>
    </div>
  </section>
</template>
