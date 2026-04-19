<script setup lang="ts">
import { computed, ref } from 'vue'
import { Search, X, Copy, Check } from 'lucide-vue-next'
import JsonNode from './JsonNode.vue'

// Existing call sites pass `maxLines` / `collapsible`; we kept the tree view as a
// drop-in replacement and ignore the old text-mode props (they made sense for the
// prior <pre> renderer but don't map to a tree).
const props = withDefaults(
  defineProps<{
    value: unknown
    initiallyExpanded?: boolean
    searchable?: boolean
    maxLines?: number
    collapsible?: boolean
  }>(),
  { initiallyExpanded: true, searchable: true, maxLines: undefined, collapsible: true },
)

const search = ref('')

// Escape the user input so arbitrary characters don't build a malicious regex.
const matchRegex = computed<RegExp | null>(() => {
  const q = search.value.trim()
  if (!q) return null
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  try {
    return new RegExp(escaped, 'i')
  } catch {
    return null
  }
})

const copied = ref(false)
let copyTimer: ReturnType<typeof setTimeout> | null = null

async function copyAll() {
  try {
    const text = JSON.stringify(props.value, null, 2)
    await navigator.clipboard.writeText(text)
    copied.value = true
    if (copyTimer) clearTimeout(copyTimer)
    copyTimer = setTimeout(() => {
      copied.value = false
    }, 1200)
  } catch {
    // clipboard unavailable — ignore
  }
}

function clearSearch() {
  search.value = ''
}
</script>

<template>
  <div class="bg-surface-2 border border-border rounded-md overflow-hidden">
    <div v-if="searchable" class="flex items-center gap-2 px-2.5 py-1.5 border-b border-border bg-surface">
      <Search :size="12" class="text-fg-muted shrink-0" />
      <input
        v-model="search"
        type="search"
        placeholder="Filter: Schlüssel oder Wert"
        spellcheck="false"
        autocomplete="off"
        aria-label="JSON durchsuchen"
        class="flex-1 bg-transparent text-[12px] text-fg placeholder:text-fg-muted focus:outline-none font-mono"
      />
      <button
        v-if="search"
        type="button"
        class="focus-ring shrink-0 p-1 text-fg-muted hover:text-fg rounded"
        aria-label="Filter leeren"
        @click="clearSearch"
      >
        <X :size="11" />
      </button>
      <button
        type="button"
        class="focus-ring shrink-0 inline-flex items-center gap-1 h-6 px-2 rounded text-[10.5px] font-medium text-fg-muted hover:text-fg hover:bg-surface-2 transition-colors"
        title="Gesamtes JSON kopieren"
        @click="copyAll"
      >
        <Check v-if="copied" :size="11" class="text-success" />
        <Copy v-else :size="11" />
        {{ copied ? 'kopiert' : 'JSON' }}
      </button>
    </div>
    <div class="px-2 py-1.5 overflow-auto max-h-[480px]">
      <JsonNode
        :value="value"
        :match-regex="matchRegex"
        :initially-expanded="initiallyExpanded"
        :depth="0"
      />
    </div>
  </div>
</template>
