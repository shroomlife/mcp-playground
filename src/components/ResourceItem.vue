<script setup lang="ts">
import { FileText, Link2 } from 'lucide-vue-next'
import type { McpResource, McpResourceTemplate } from '~/composables/useMcpInspector'

defineProps<{
  resource: McpResource | McpResourceTemplate
  isTemplate?: boolean
  index: number
}>()

function getUri(r: McpResource | McpResourceTemplate): string {
  return 'uri' in r ? r.uri : r.uriTemplate
}
</script>

<template>
  <li class="flex items-start gap-4 px-5 py-3.5 border-b border-hairline last:border-b-0 hover:bg-paper-2/50 transition-colors">
    <span class="font-mono text-[10px] text-muted tabular-nums w-6 tracking-tight mt-1">
      {{ String(index + 1).padStart(2, '0') }}
    </span>
    <component
      :is="isTemplate ? Link2 : FileText"
      :size="14"
      :stroke-width="1.5"
      class="shrink-0 mt-1"
      :class="isTemplate ? 'text-plum' : 'text-moss'"
    />
    <div class="flex-1 min-w-0">
      <div class="flex items-baseline gap-2 flex-wrap">
        <span class="font-mono text-[12.5px] text-ink break-all">{{ getUri(resource) }}</span>
        <span
          v-if="isTemplate"
          class="font-mono text-[9.5px] uppercase tracking-[0.18em] text-plum border border-plum/50 rounded-full px-1.5 py-0.5"
        >
          template
        </span>
      </div>
      <div
        v-if="resource.name || resource.title || resource.description"
        class="mt-1 flex items-baseline gap-2 flex-wrap"
      >
        <span v-if="resource.title || resource.name" class="font-display italic text-[14px] text-ink-2">
          {{ resource.title ?? resource.name }}
        </span>
        <span v-if="resource.description" class="text-[12px] text-muted">
          — {{ resource.description }}
        </span>
      </div>
    </div>
    <span
      v-if="resource.mimeType"
      class="font-mono text-[10px] uppercase tracking-[0.14em] text-muted whitespace-nowrap mt-1"
    >
      {{ resource.mimeType }}
    </span>
  </li>
</template>
