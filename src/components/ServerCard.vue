<script setup lang="ts">
import { computed } from 'vue'
import { Server, Clock, Activity } from 'lucide-vue-next'
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

const capabilityHint: Record<string, string> = {
  tools: 'Aufrufbare Funktionen, die der Client ausführen kann.',
  resources: 'Les­bare Daten­elemente (URIs), die der Server bereit­stellt.',
  prompts: 'Vorgefertigte Prompt-Templates mit Argumenten.',
  logging: 'Server kann Log-Nachrichten an den Client senden.',
  completions: 'Argument-Autocomplete für Prompts und Resources.',
  experimental: 'Nicht-standardisierte Erweiterungen dieses Servers.',
  sampling: 'Server kann LLM-Sampling beim Client anfordern.',
}
</script>

<template>
  <section v-if="server" class="fade-in">
    <header class="mb-3">
      <h2 class="text-[15px] font-semibold text-fg">Server-Info</h2>
      <p class="text-[13px] text-fg-muted mt-0.5 max-w-2xl">
        Basisdaten aus dem Initialize-Handshake — Name, Version und die deklarierten
        Capabilities bestimmen, was der Server anbietet.
      </p>
    </header>

    <div class="bg-surface border border-border rounded-lg">
      <!-- Identity -->
      <div class="flex items-start gap-3 p-4 border-b border-border">
        <div class="mt-0.5 p-1.5 bg-accent-soft text-accent rounded-md">
          <Server :size="16" :stroke-width="2" />
        </div>
        <div class="flex-1 min-w-0">
          <div class="font-mono text-[14px] font-medium text-fg break-all">
            {{ server.name }}
          </div>
          <div class="text-[12px] text-fg-muted mt-0.5">
            Version <span class="font-mono text-fg-2">{{ server.version }}</span>
          </div>
        </div>
        <dl class="hidden sm:flex items-start gap-5 text-[12px]">
          <div>
            <dt class="flex items-center gap-1 text-fg-muted">
              <Activity :size="11" />
              Handshake
            </dt>
            <dd class="font-mono text-fg mt-0.5">
              {{ latencyMs !== null ? `${latencyMs} ms` : '—' }}
            </dd>
          </div>
          <div>
            <dt class="flex items-center gap-1 text-fg-muted">
              <Clock :size="11" />
              Verbunden
            </dt>
            <dd class="font-mono text-fg mt-0.5">{{ connectedAtLabel }}</dd>
          </div>
        </dl>
      </div>

      <!-- Instructions -->
      <div v-if="server.instructions" class="p-4 border-b border-border bg-surface-2/60">
        <div class="text-[11px] uppercase tracking-wide text-fg-muted font-medium mb-1">
          Server-Hinweis
        </div>
        <p class="text-[13px] leading-[1.5] text-fg-2 max-w-3xl">
          {{ server.instructions }}
        </p>
      </div>

      <!-- Counts -->
      <div class="grid grid-cols-3 divide-x divide-border border-b border-border">
        <div class="p-4">
          <div class="text-[11px] uppercase tracking-wide text-fg-muted font-medium">
            Tools
          </div>
          <div class="text-[22px] font-semibold text-fg mt-0.5 tabular-nums">
            {{ counts.tools }}
          </div>
        </div>
        <div class="p-4">
          <div class="text-[11px] uppercase tracking-wide text-fg-muted font-medium">
            Resources
          </div>
          <div class="text-[22px] font-semibold text-fg mt-0.5 tabular-nums">
            {{ counts.resources }}
          </div>
        </div>
        <div class="p-4">
          <div class="text-[11px] uppercase tracking-wide text-fg-muted font-medium">
            Prompts
          </div>
          <div class="text-[22px] font-semibold text-fg mt-0.5 tabular-nums">
            {{ counts.prompts }}
          </div>
        </div>
      </div>

      <!-- Capabilities -->
      <div class="p-4">
        <div class="text-[11px] uppercase tracking-wide text-fg-muted font-medium mb-2">
          Capabilities
        </div>
        <div v-if="capabilities.length" class="flex flex-wrap gap-1.5">
          <span
            v-for="cap in capabilities"
            :key="cap"
            class="inline-flex items-center gap-1.5 px-2 py-1 border border-border rounded-md font-mono text-[11.5px] text-fg-2"
            :title="capabilityHint[cap] ?? 'Deklarierte Capability'"
          >
            <span class="size-1.5 rounded-full bg-success" />
            {{ cap }}
          </span>
        </div>
        <p v-else class="text-[12px] text-fg-muted italic">
          Keine Capabilities deklariert.
        </p>
      </div>
    </div>
  </section>
</template>
