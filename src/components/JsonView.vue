<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  value: unknown
  maxLines?: number
}>()

const pretty = computed(() => {
  try {
    return JSON.stringify(props.value, null, 2)
  } catch {
    return String(props.value)
  }
})

const clipped = computed(() => {
  const lines = pretty.value.split('\n')
  const max = props.maxLines ?? 999
  if (lines.length <= max) return pretty.value
  return lines.slice(0, max).join('\n') + `\n  … (${lines.length - max} mehr)`
})
</script>

<template>
  <pre
    class="font-mono text-[11.5px] leading-[1.6] whitespace-pre-wrap break-words text-ink-2 bg-paper-2/70 border border-hairline/80 rounded-sm px-3 py-2.5"
  >{{ clipped }}</pre>
</template>
