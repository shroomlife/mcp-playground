<script setup lang="ts">
import { ref, computed } from 'vue'
import { Plug, Unplug, Loader2 } from 'lucide-vue-next'
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
const isBusy = computed(() => isConnecting.value)

const submitDisabled = computed(() => {
  if (isBusy.value) return true
  if (isConnected.value) return false
  return !url.value.trim()
})

const examples = [
  { url: 'http://localhost:3000/mcp', transport: 'http' as const, label: 'Lokaler HTTP-Server' },
  { url: 'https://mcp.deepwiki.com/mcp', transport: 'http' as const, label: 'DeepWiki (öffentlich)' },
  { url: 'http://127.0.0.1:8787/sse', transport: 'sse' as const, label: 'Lokaler SSE-Server' },
]

function submit() {
  if (isBusy.value) return
  if (isConnected.value) {
    emit('disconnect')
    return
  }
  if (!url.value.trim()) return
  emit('connect', url.value, transport.value)
}

function useExample(ex: { url: string; transport: TransportKind }) {
  if (isBusy.value || isConnected.value) return
  url.value = ex.url
  transport.value = ex.transport
}
</script>

<template>
  <section class="fade-in">
    <form @submit.prevent="submit" class="space-y-3">
      <div class="bg-surface border border-border rounded-lg overflow-hidden">
        <div class="flex flex-col md:flex-row md:items-stretch">
          <label class="flex flex-col flex-1 min-w-0 px-4 py-2.5">
            <span class="text-[11px] uppercase tracking-wide text-fg-muted font-medium">
              Server-URL
            </span>
            <input
              v-model="url"
              type="url"
              inputmode="url"
              autocomplete="off"
              spellcheck="false"
              placeholder="https://mcp.example.com/mcp"
              :disabled="isConnected || isConnecting"
              class="focus-ring -mx-1 mt-0.5 px-1 py-0.5 bg-transparent font-mono text-[13.5px] text-fg placeholder:text-fg-subtle focus:outline-none disabled:text-fg-muted rounded"
            />
          </label>

          <div
            role="radiogroup"
            aria-label="Transport wählen"
            class="flex items-stretch border-t md:border-t-0 md:border-l border-border"
          >
            <button
              type="button"
              role="radio"
              :aria-checked="transport === 'http'"
              @click="transport = 'http'"
              :disabled="isConnected || isConnecting"
              class="focus-ring px-4 py-2 text-[12.5px] font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              :class="transport === 'http'
                ? 'bg-fg text-bg'
                : 'text-fg-2 hover:bg-surface-2'"
            >
              HTTP
            </button>
            <button
              type="button"
              role="radio"
              :aria-checked="transport === 'sse'"
              @click="transport = 'sse'"
              :disabled="isConnected || isConnecting"
              class="focus-ring px-4 py-2 text-[12.5px] font-medium transition-colors border-l border-border disabled:opacity-40 disabled:cursor-not-allowed"
              :class="transport === 'sse'
                ? 'bg-fg text-bg'
                : 'text-fg-2 hover:bg-surface-2'"
            >
              SSE
            </button>
          </div>

          <button
            type="submit"
            :disabled="submitDisabled"
            class="focus-ring flex items-center justify-center gap-2 px-5 py-3 text-[13px] font-medium transition-colors border-t md:border-t-0 md:border-l border-border disabled:opacity-40 disabled:cursor-not-allowed"
            :class="isConnected
              ? 'text-danger hover:bg-danger-soft'
              : 'bg-accent text-white hover:brightness-110'"
          >
            <Loader2 v-if="isConnecting" :size="14" class="animate-spin" />
            <Unplug v-else-if="isConnected" :size="14" />
            <Plug v-else :size="14" />
            <span>
              {{ isConnecting ? 'Verbinde …' : isConnected ? 'Trennen' : 'Verbinden' }}
            </span>
          </button>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px]">
        <span class="text-fg-muted">Beispiele:</span>
        <button
          v-for="ex in examples"
          :key="ex.url"
          type="button"
          @click="useExample(ex)"
          :disabled="isConnected || isConnecting"
          class="focus-ring text-accent hover:underline disabled:opacity-40 disabled:cursor-not-allowed font-mono"
          :title="ex.label"
        >
          {{ ex.url }}
        </button>
      </div>
    </form>
  </section>
</template>
