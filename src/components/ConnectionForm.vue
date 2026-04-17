<script setup lang="ts">
import { ref, computed } from 'vue'
import { Plug, PlugZap, Loader2, Radio, Cable } from 'lucide-vue-next'
import type { ConnectionState, TransportKind } from '~/composables/useMcpInspector'

const props = defineProps<{
  state: ConnectionState
  initialUrl?: string
}>()

const emit = defineEmits<{
  (e: 'connect', url: string, transport: TransportKind): void
  (e: 'disconnect'): void
}>()

const url = ref(props.initialUrl ?? '')
const transport = ref<TransportKind>('http')

const isConnecting = computed(() => props.state === 'connecting')
const isConnected = computed(() => props.state === 'connected')

const examples = [
  'http://localhost:3000/mcp',
  'https://mcp.deepwiki.com/mcp',
  'http://127.0.0.1:8787/sse',
]

function submit() {
  if (isConnected.value) {
    emit('disconnect')
    return
  }
  emit('connect', url.value, transport.value)
}

function useExample(example: string) {
  url.value = example
  transport.value = example.endsWith('/sse') ? 'sse' : 'http'
}
</script>

<template>
  <section class="anim-in">
    <div class="flex items-baseline justify-between mb-3">
      <div class="flex items-baseline gap-3">
        <span class="text-[10px] uppercase tracking-[0.18em] text-muted">§ 01 —</span>
        <h2 class="font-display italic text-[22px] leading-none text-ink">
          Establish&nbsp;contact
        </h2>
      </div>
      <div class="hidden md:flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-muted">
        <span class="marquee-border h-[3px] w-16" />
        <span>Transport · Session · Handshake</span>
      </div>
    </div>

    <form @submit.prevent="submit" class="space-y-3">
      <div
        class="flex flex-col md:flex-row md:items-stretch gap-0 md:gap-0 bg-white/70 backdrop-blur-sm border border-rule rounded-sm overflow-hidden shadow-paper"
      >
        <div class="flex items-center gap-2 px-4 py-3 md:border-r border-hairline md:w-auto">
          <span class="text-rust">◎</span>
          <span class="text-[10px] uppercase tracking-[0.18em] text-muted font-mono">URL</span>
          <span class="caret text-ink">|</span>
        </div>

        <input
          v-model="url"
          type="text"
          inputmode="url"
          autocomplete="off"
          spellcheck="false"
          placeholder="https://mcp.example.com/mcp"
          class="flex-1 min-w-0 px-4 py-3.5 bg-transparent font-mono text-[13.5px] text-ink placeholder:text-muted/70 focus:outline-none focus:bg-paper-2/50"
          :disabled="isConnected || isConnecting"
        />

        <div
          class="flex items-center border-t md:border-t-0 md:border-l border-hairline divide-x divide-hairline"
        >
          <button
            type="button"
            @click="transport = 'http'"
            :disabled="isConnected || isConnecting"
            class="flex items-center gap-1.5 px-3 py-3 text-[10px] uppercase tracking-[0.16em] transition-colors"
            :class="transport === 'http' ? 'bg-ink text-paper' : 'text-muted hover:text-ink'"
          >
            <Cable :size="11" :stroke-width="2" />
            HTTP
          </button>
          <button
            type="button"
            @click="transport = 'sse'"
            :disabled="isConnected || isConnecting"
            class="flex items-center gap-1.5 px-3 py-3 text-[10px] uppercase tracking-[0.16em] transition-colors"
            :class="transport === 'sse' ? 'bg-ink text-paper' : 'text-muted hover:text-ink'"
          >
            <Radio :size="11" :stroke-width="2" />
            SSE
          </button>
        </div>

        <button
          type="submit"
          :disabled="!url.trim() && !isConnected"
          class="flex items-center gap-2 px-5 py-3.5 text-[11px] uppercase tracking-[0.2em] font-mono transition-colors border-t md:border-t-0 md:border-l border-hairline disabled:opacity-40 disabled:cursor-not-allowed"
          :class="
            isConnected
              ? 'bg-paper-2 text-ink hover:bg-paper-3'
              : 'bg-rust text-paper hover:bg-ink'
          "
        >
          <Loader2 v-if="isConnecting" :size="13" class="animate-spin" />
          <PlugZap v-else-if="isConnected" :size="13" />
          <Plug v-else :size="13" />
          <span>
            {{ isConnecting ? 'handshake…' : isConnected ? 'disconnect' : 'inspect' }}
          </span>
        </button>
      </div>

      <div class="flex flex-wrap items-center gap-2 pl-1">
        <span class="text-[10px] uppercase tracking-[0.16em] text-muted">Templates</span>
        <span class="ascii-rule w-6" />
        <button
          v-for="ex in examples"
          :key="ex"
          type="button"
          @click="useExample(ex)"
          class="font-mono text-[11px] text-muted hover:text-rust transition-colors border-b border-dotted border-transparent hover:border-rust/60"
          :disabled="isConnected || isConnecting"
        >
          {{ ex }}
        </button>
      </div>
    </form>
  </section>
</template>
