<script setup lang="ts">
import { computed, watch } from 'vue'
import { Search, X, MessageSquareText } from 'lucide-vue-next'
import PromptDetail from './PromptDetail.vue'
import { useSessionState } from '~/composables/useSessionState'
import type { CallHistoryEntry, CallOptions, McpPrompt } from '~/composables/useMcpPlayground'

const props = defineProps<{
  prompts: McpPrompt[]
  history: CallHistoryEntry[]
  isConnected: boolean
  runPrompt: (
    name: string,
    args: Record<string, string>,
    options?: CallOptions,
  ) => Promise<CallHistoryEntry>
}>()

const session = useSessionState()
const query = session.searchPrompts
const selectedName = session.promptName

const normalizedQuery = computed(() => query.value.trim().toLowerCase())

const filtered = computed(() => {
  const q = normalizedQuery.value
  if (!q) return props.prompts
  return props.prompts.filter((p) =>
    [p.name, p.title ?? '', p.description ?? ''].join(' ').toLowerCase().includes(q),
  )
})

const selected = computed<McpPrompt | null>(() => {
  if (!props.prompts.length) return null
  const match = props.prompts.find((p) => p.name === selectedName.value)
  if (match) return match
  return filtered.value[0] ?? props.prompts[0] ?? null
})

function selectPrompt(prompt: McpPrompt) {
  session.markUserSelection()
  selectedName.value = prompt.name
}

function clearQuery() {
  query.value = ''
}

watch(
  () => props.prompts,
  (next) => {
    if (!next.some((p) => p.name === selectedName.value)) {
      selectedName.value = next[0]?.name ?? null
    }
  },
  { immediate: true },
)
</script>

<template>
  <div v-if="prompts.length === 0" class="px-6 py-14 text-center">
    <div class="text-[13px] text-fg-muted">Keine Prompts vorhanden.</div>
  </div>

  <div
    v-else
    class="grid grid-cols-1 md:grid-cols-[minmax(320px,420px)_1fr] divide-y md:divide-y-0 md:divide-x divide-border min-h-[520px]"
  >
    <!-- List -->
    <div class="flex flex-col min-h-0">
      <div class="px-3.5 py-3 border-b border-border">
        <div class="relative">
          <Search
            :size="13"
            class="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-muted pointer-events-none"
          />
          <input
            v-model="query"
            type="search"
            :placeholder="`${prompts.length} Prompts durchsuchen …`"
            spellcheck="false"
            autocomplete="off"
            class="focus-ring w-full h-9 pl-8 pr-8 bg-surface-2 border border-border rounded-md text-[12.5px] text-fg placeholder:text-fg-muted focus:bg-surface focus:border-accent focus:outline-none transition-colors"
            aria-label="Prompts durchsuchen"
          />
          <button
            v-if="query"
            type="button"
            class="focus-ring absolute right-1.5 top-1/2 -translate-y-1/2 p-1 text-fg-muted hover:text-fg rounded"
            aria-label="Suche leeren"
            @click="clearQuery"
          >
            <X :size="12" />
          </button>
        </div>
      </div>

      <ul
        v-if="filtered.length > 0"
        class="flex-1 min-h-0 overflow-y-auto"
        role="listbox"
        aria-label="Prompt-Liste"
      >
        <li v-for="prompt in filtered" :key="prompt.name">
          <button
            type="button"
            role="option"
            :aria-selected="selected?.name === prompt.name"
            class="focus-ring w-full text-left px-4 py-2.5 border-b border-border flex items-start gap-2.5 hover:bg-surface-2 transition-colors data-[selected=true]:bg-cat-prompt-soft/60 data-[selected=true]:border-cat-prompt/25"
            :data-selected="selected?.name === prompt.name ? 'true' : 'false'"
            @click="selectPrompt(prompt)"
          >
            <MessageSquareText
              :size="13"
              :stroke-width="1.75"
              class="shrink-0 mt-0.5"
              :class="selected?.name === prompt.name ? 'text-cat-prompt' : 'text-fg-muted'"
            />
            <div class="flex-1 min-w-0">
              <div class="font-mono text-[12.5px] font-medium text-fg truncate">
                {{ prompt.name }}
              </div>
              <p
                v-if="prompt.description"
                class="mt-0.5 text-[11.5px] text-fg-muted leading-[1.4] truncate"
              >
                {{ prompt.description }}
              </p>
            </div>
          </button>
        </li>
      </ul>

      <div v-else class="flex-1 px-6 py-10 text-center">
        <div class="text-[12.5px] text-fg-muted">
          Keine Treffer für <span class="font-mono text-fg">"{{ query }}"</span>
        </div>
      </div>
    </div>

    <!-- Detail — keyed so state resets per prompt -->
    <PromptDetail
      v-if="selected"
      :key="selected.name"
      :prompt="selected"
      :history="history"
      :is-connected="isConnected"
      :run-prompt="runPrompt"
      class="overflow-y-auto"
    />
  </div>
</template>
