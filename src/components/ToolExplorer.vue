<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, useTemplateRef, watch } from 'vue'
import { Search, X, Wrench } from 'lucide-vue-next'
import ToolDetail from './ToolDetail.vue'
import { useSessionState } from '~/composables/useSessionState'
import type { CallHistoryEntry, CallOptions, McpTool } from '~/composables/useMcpPlayground'

const props = defineProps<{
  tools: McpTool[]
  history: CallHistoryEntry[]
  isConnected: boolean
  runTool: (
    name: string,
    args: Record<string, unknown>,
    options?: CallOptions,
  ) => Promise<CallHistoryEntry>
}>()

const session = useSessionState()
const query = session.searchTools
const selectedName = session.toolName
const searchRef = useTemplateRef<HTMLInputElement>('searchInput')

const normalizedQuery = computed(() => query.value.trim().toLowerCase())

const filtered = computed(() => {
  const q = normalizedQuery.value
  if (!q) return props.tools
  return props.tools.filter((tool) => {
    const haystack = [tool.name, tool.title ?? '', tool.description ?? ''].join(' ').toLowerCase()
    return haystack.includes(q)
  })
})

const selectedTool = computed<McpTool | null>(() => {
  if (!props.tools.length) return null
  const byName = props.tools.find((t) => t.name === selectedName.value)
  if (byName) return byName
  return filtered.value[0] ?? props.tools[0] ?? null
})

function selectTool(tool: McpTool) {
  selectedName.value = tool.name
}

function clearQuery() {
  query.value = ''
  searchRef.value?.focus()
}

function onSearchKey(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    if (query.value) {
      clearQuery()
      event.preventDefault()
    } else {
      searchRef.value?.blur()
    }
    return
  }
  if (event.key === 'ArrowDown' && filtered.value.length > 0) {
    event.preventDefault()
    const first = filtered.value[0]
    if (first) {
      selectTool(first)
      focusListItem(0)
    }
  }
}

function onListKey(event: KeyboardEvent, index: number) {
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    const next = Math.min(index + 1, filtered.value.length - 1)
    const tool = filtered.value[next]
    if (tool) {
      selectTool(tool)
      focusListItem(next)
    }
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    if (index === 0) {
      searchRef.value?.focus()
      return
    }
    const prev = index - 1
    const tool = filtered.value[prev]
    if (tool) {
      selectTool(tool)
      focusListItem(prev)
    }
  }
}

function focusListItem(index: number) {
  void nextTick(() => {
    const el = document.querySelector<HTMLButtonElement>(
      `[data-tool-index="${index}"]`,
    )
    el?.focus()
  })
}

// Global "/" shortcut focuses search — only when the input is actually visible
// (Reka UI may keep inactive Tabs in the DOM; offsetParent === null means hidden).
function onGlobalKey(event: KeyboardEvent) {
  if (event.key !== '/') return
  const target = event.target as HTMLElement | null
  if (target && /input|textarea|select/i.test(target.tagName)) return
  if (target?.isContentEditable) return
  const input = searchRef.value
  if (!input || input.offsetParent === null) return
  event.preventDefault()
  input.focus()
  input.select()
}

onMounted(() => {
  window.addEventListener('keydown', onGlobalKey)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onGlobalKey)
})

watch(
  () => props.tools,
  (next) => {
    if (next.length === 0) {
      selectedName.value = null
      return
    }
    if (!next.some((t) => t.name === selectedName.value)) {
      selectedName.value = next[0]?.name ?? null
    }
  },
  { immediate: true },
)
</script>

<template>
  <div v-if="tools.length === 0" class="px-6 py-14 text-center">
    <div class="text-[13px] text-fg-muted">Dieser Server deklariert keine Tools.</div>
  </div>

  <div
    v-else
    class="grid grid-cols-1 md:grid-cols-[minmax(280px,360px)_1fr] divide-y md:divide-y-0 md:divide-x divide-border min-h-[560px]"
  >
    <!-- List column -->
    <div class="flex flex-col min-h-0">
      <div class="px-3.5 py-3 border-b border-border">
        <div class="relative">
          <Search
            :size="13"
            class="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-muted pointer-events-none"
          />
          <input
            ref="searchInput"
            v-model="query"
            type="search"
            :placeholder="`${tools.length} Tools durchsuchen …`"
            spellcheck="false"
            autocomplete="off"
            class="focus-ring w-full h-9 pl-8 pr-8 bg-surface-2 border border-border rounded-md text-[12.5px] text-fg placeholder:text-fg-muted focus:bg-surface focus:border-accent focus:outline-none transition-colors"
            aria-label="Tools durchsuchen"
            @keydown="onSearchKey"
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
          <kbd
            v-else
            class="hidden sm:inline-flex absolute right-2 top-1/2 -translate-y-1/2 items-center h-5 px-1.5 font-mono text-[10px] text-fg-muted bg-surface border border-border rounded"
            aria-hidden="true"
          >
            /
          </kbd>
        </div>
      </div>

      <ul
        v-if="filtered.length > 0"
        class="flex-1 min-h-0 overflow-y-auto"
        role="listbox"
        aria-label="Tool-Liste"
      >
        <li v-for="(tool, i) in filtered" :key="tool.name">
          <button
            type="button"
            role="option"
            :data-tool-index="i"
            :aria-selected="selectedTool?.name === tool.name"
            class="focus-ring w-full text-left px-4 py-2.5 border-b border-border flex items-start gap-2.5 hover:bg-surface-2 transition-colors data-[selected=true]:bg-accent-soft/50 data-[selected=true]:border-accent/20"
            :data-selected="selectedTool?.name === tool.name ? 'true' : 'false'"
            @click="selectTool(tool)"
            @keydown="onListKey($event, i)"
          >
            <Wrench
              :size="13"
              :stroke-width="1.75"
              class="shrink-0 mt-0.5"
              :class="selectedTool?.name === tool.name ? 'text-accent' : 'text-fg-muted'"
            />
            <div class="flex-1 min-w-0">
              <div class="font-mono text-[12.5px] font-medium text-fg truncate">
                {{ tool.name }}
              </div>
              <p
                v-if="tool.description"
                class="mt-0.5 text-[11.5px] text-fg-muted leading-[1.4] truncate"
              >
                {{ tool.description }}
              </p>
            </div>
          </button>
        </li>
      </ul>

      <div v-else class="flex-1 px-6 py-10 text-center">
        <div class="text-[12.5px] text-fg-muted">
          Keine Treffer für <span class="font-mono text-fg">"{{ query }}"</span>
        </div>
        <button
          type="button"
          class="focus-ring mt-2 text-[11.5px] text-accent hover:underline"
          @click="clearQuery"
        >
          Suche zurücksetzen
        </button>
      </div>
    </div>

    <!-- Detail column — keyed by tool name so state resets on tool switch -->
    <ToolDetail
      v-if="selectedTool"
      :key="selectedTool.name"
      :tool="selectedTool"
      :history="history"
      :is-connected="isConnected"
      :run-tool="runTool"
      class="overflow-y-auto"
    />
  </div>
</template>
