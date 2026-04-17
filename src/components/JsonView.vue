<script setup lang="ts">
import { computed, ref } from 'vue'
import { ChevronRight, ChevronDown, Copy, Check } from 'lucide-vue-next'

const props = withDefaults(
  defineProps<{
    value: unknown
    maxLines?: number
    collapsible?: boolean
  }>(),
  { maxLines: 40, collapsible: true },
)

const pretty = computed(() => {
  try {
    return JSON.stringify(props.value, null, 2)
  } catch {
    return String(props.value)
  }
})

const lines = computed(() => pretty.value.split('\n'))
const isLong = computed(() => lines.value.length > props.maxLines)
const expanded = ref(false)

const display = computed(() => {
  if (!isLong.value || expanded.value) return pretty.value
  return lines.value.slice(0, props.maxLines).join('\n')
})

const copied = ref(false)
let copyTimer: ReturnType<typeof setTimeout> | null = null

async function copy() {
  try {
    await navigator.clipboard.writeText(pretty.value)
    copied.value = true
    if (copyTimer) clearTimeout(copyTimer)
    copyTimer = setTimeout(() => { copied.value = false }, 1200)
  } catch {
    // ignore — clipboard might be unavailable
  }
}
</script>

<template>
  <div class="relative group">
    <pre
      class="font-mono text-[12px] leading-[1.6] whitespace-pre-wrap break-words text-fg-2 bg-surface-2 border border-border rounded-md px-3 py-2.5 overflow-auto"
    >{{ display }}<span v-if="isLong && !expanded" class="text-fg-muted">
… {{ lines.length - maxLines }} weitere Zeilen</span></pre>

    <div class="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
      <button
        v-if="collapsible && isLong"
        type="button"
        @click="expanded = !expanded"
        class="focus-ring flex items-center gap-1 px-2 py-1 text-[11px] bg-surface border border-border rounded text-fg-2 hover:text-fg hover:border-border-strong"
        :aria-label="expanded ? 'Einklappen' : 'Ausklappen'"
      >
        <ChevronDown v-if="expanded" :size="12" />
        <ChevronRight v-else :size="12" />
        {{ expanded ? 'weniger' : 'alles' }}
      </button>
      <button
        type="button"
        @click="copy"
        class="focus-ring flex items-center gap-1 px-2 py-1 text-[11px] bg-surface border border-border rounded text-fg-2 hover:text-fg hover:border-border-strong"
        aria-label="JSON kopieren"
      >
        <Check v-if="copied" :size="12" class="text-success" />
        <Copy v-else :size="12" />
        {{ copied ? 'kopiert' : 'kopieren' }}
      </button>
    </div>
  </div>
</template>
