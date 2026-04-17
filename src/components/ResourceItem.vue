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
  <li class="flex items-start gap-3 px-4 py-3 border-b border-border last:border-b-0 hover:bg-surface-2 transition-colors">
    <span class="font-mono text-[11px] text-fg-muted tabular-nums w-6 pt-0.5">
      {{ String(index + 1).padStart(2, '0') }}
    </span>
    <component
      :is="isTemplate ? Link2 : FileText"
      :size="14"
      :stroke-width="1.75"
      class="shrink-0 mt-0.5"
      :class="isTemplate ? 'text-warning' : 'text-accent'"
    />
    <div class="flex-1 min-w-0">
      <div class="flex items-baseline gap-2 flex-wrap">
        <span class="font-mono text-[12.5px] text-fg break-all">{{ getUri(resource) }}</span>
        <span
          v-if="isTemplate"
          class="font-mono text-[10px] text-warning bg-warning-soft border border-warning/30 rounded px-1.5 py-0.5"
          title="URI-Template mit Platzhaltern"
        >
          template
        </span>
      </div>
      <div
        v-if="resource.name || resource.title || resource.description"
        class="mt-1 flex items-baseline gap-2 flex-wrap text-[12.5px]"
      >
        <span v-if="resource.title || resource.name" class="font-medium text-fg-2">
          {{ resource.title ?? resource.name }}
        </span>
        <span v-if="resource.description" class="text-fg-muted">
          {{ resource.description }}
        </span>
      </div>
    </div>
    <span
      v-if="resource.mimeType"
      class="font-mono text-[11px] text-fg-muted whitespace-nowrap mt-0.5"
    >
      {{ resource.mimeType }}
    </span>
  </li>
</template>
