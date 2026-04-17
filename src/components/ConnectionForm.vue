<script setup lang="ts">
import { ref, computed } from 'vue'
import { Plug, Loader2, ArrowRight } from 'lucide-vue-next'
import type { ConnectionState, TransportKind } from '~/composables/useMcpInspector'

const props = defineProps<{
  state: ConnectionState
  initialUrl?: string
}>()

const emit = defineEmits<{
  (e: 'connect', url: string, transport: TransportKind): void
}>()

const url = ref(props.initialUrl ?? '')
const transport = ref<TransportKind>('http')

const isConnecting = computed(() => props.state === 'connecting')
const submitDisabled = computed(() => isConnecting.value || !url.value.trim())

const examples = [
  { url: 'https://mcp.deepwiki.com/mcp', transport: 'http' as const, label: 'DeepWiki' },
  { url: 'http://localhost:3000/mcp', transport: 'http' as const, label: 'Localhost HTTP' },
  { url: 'http://127.0.0.1:8787/sse', transport: 'sse' as const, label: 'Localhost SSE' },
]

function submit() {
  if (submitDisabled.value) return
  emit('connect', url.value.trim(), transport.value)
}

function useExample(ex: { url: string; transport: TransportKind }) {
  if (isConnecting.value) return
  url.value = ex.url
  transport.value = ex.transport
}
</script>

<template>
  <form @submit.prevent="submit" class="space-y-5 fade-in">
    <!-- URL field -->
    <div>
      <label for="mcp-url" class="block text-[12px] font-medium text-fg-2 mb-1.5">
        Server-URL
      </label>
      <input
        id="mcp-url"
        v-model="url"
        type="url"
        inputmode="url"
        autocomplete="off"
        spellcheck="false"
        placeholder="https://mcp.example.com/mcp"
        :disabled="isConnecting"
        class="focus-ring w-full h-11 px-3.5 bg-surface border border-border-strong rounded-lg font-mono text-[14px] text-fg placeholder:text-fg-subtle focus:border-accent focus:outline-none disabled:bg-surface-2 disabled:text-fg-muted transition-colors"
      />
    </div>

    <!-- Transport -->
    <div>
      <label class="block text-[12px] font-medium text-fg-2 mb-1.5">
        Transport
      </label>
      <div
        role="radiogroup"
        aria-label="MCP-Transport wählen"
        class="flex items-center p-1 bg-surface-2 border border-border rounded-lg gap-1"
      >
        <button
          type="button"
          role="radio"
          :aria-checked="transport === 'http'"
          @click="transport = 'http'"
          :disabled="isConnecting"
          class="focus-ring flex-1 h-9 px-3 rounded-md text-[13px] font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          :class="transport === 'http'
            ? 'bg-surface text-fg shadow-sm border border-border'
            : 'text-fg-muted hover:text-fg'"
        >
          <span class="flex items-center justify-center gap-2">
            HTTP
            <span class="text-[10px] font-normal text-fg-subtle hidden sm:inline">
              Streamable
            </span>
          </span>
        </button>
        <button
          type="button"
          role="radio"
          :aria-checked="transport === 'sse'"
          @click="transport = 'sse'"
          :disabled="isConnecting"
          class="focus-ring flex-1 h-9 px-3 rounded-md text-[13px] font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          :class="transport === 'sse'
            ? 'bg-surface text-fg shadow-sm border border-border'
            : 'text-fg-muted hover:text-fg'"
        >
          <span class="flex items-center justify-center gap-2">
            SSE
            <span class="text-[10px] font-normal text-fg-subtle hidden sm:inline">
              Server-Sent Events
            </span>
          </span>
        </button>
      </div>
    </div>

    <!-- Submit -->
    <button
      type="submit"
      :disabled="submitDisabled"
      class="focus-ring group w-full h-11 px-4 bg-fg text-bg rounded-lg font-medium text-[13.5px] flex items-center justify-center gap-2 hover:bg-fg-2 active:scale-[0.99] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-fg"
    >
      <Loader2 v-if="isConnecting" :size="15" class="animate-spin" />
      <Plug v-else :size="15" />
      <span>{{ isConnecting ? 'Verbinde …' : 'Verbinden' }}</span>
      <ArrowRight
        v-if="!isConnecting"
        :size="15"
        class="opacity-60 group-hover:translate-x-0.5 transition-transform"
      />
    </button>

    <!-- Examples -->
    <div class="pt-2 border-t border-border">
      <div class="text-[11.5px] text-fg-muted mb-2">Beispiele</div>
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="ex in examples"
          :key="ex.url"
          type="button"
          @click="useExample(ex)"
          :disabled="isConnecting"
          class="focus-ring flex items-center gap-1.5 px-2.5 py-1 bg-surface border border-border rounded-md text-[11.5px] text-fg-2 hover:border-border-strong hover:text-fg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          :title="ex.url"
        >
          <span class="font-medium">{{ ex.label }}</span>
          <span class="text-fg-subtle font-mono uppercase text-[10px]">
            {{ ex.transport }}
          </span>
        </button>
      </div>
    </div>
  </form>
</template>
