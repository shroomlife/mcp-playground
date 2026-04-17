<script setup lang="ts">
import { computed } from 'vue'
import { ChevronDown, Wrench } from 'lucide-vue-next'
import { AccordionItem, AccordionHeader, AccordionTrigger, AccordionContent } from 'reka-ui'
import JsonView from './JsonView.vue'
import type { McpTool } from '~/composables/useMcpInspector'

const props = defineProps<{ tool: McpTool; index: number }>()

const paramCount = computed(() => {
  const schema = props.tool.inputSchema as
    | { properties?: Record<string, unknown>; required?: string[] }
    | undefined
  if (!schema?.properties) return 0
  return Object.keys(schema.properties).length
})

const requiredCount = computed(() => {
  const schema = props.tool.inputSchema as { required?: string[] } | undefined
  return schema?.required?.length ?? 0
})
</script>

<template>
  <AccordionItem :value="tool.name" class="group">
    <AccordionHeader as-child>
      <AccordionTrigger
        class="focus-ring w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-surface-2 transition-colors border-b border-border group-data-[state=open]:bg-surface-2"
      >
        <span class="font-mono text-[11px] text-fg-muted tabular-nums w-6 pt-0.5">
          {{ String(index + 1).padStart(2, '0') }}
        </span>
        <Wrench :size="14" :stroke-width="1.75" class="text-accent shrink-0 mt-0.5" />
        <div class="flex-1 min-w-0">
          <div class="flex items-baseline gap-2 flex-wrap">
            <span class="font-mono text-[13px] font-medium text-fg">{{ tool.name }}</span>
            <span
              v-if="tool.title && tool.title !== tool.name"
              class="text-[12px] text-fg-muted"
            >
              {{ tool.title }}
            </span>
          </div>
          <p
            v-if="tool.description"
            class="text-[12.5px] text-fg-2 mt-0.5 line-clamp-2"
          >
            {{ tool.description }}
          </p>
        </div>
        <div class="hidden md:flex items-center gap-3 text-[11px] font-mono text-fg-muted pt-0.5">
          <span>{{ paramCount }} Param</span>
          <span>·</span>
          <span>{{ requiredCount }} req</span>
        </div>
        <ChevronDown
          :size="14"
          class="text-fg-muted transition-transform group-data-[state=open]:rotate-180 mt-1"
        />
      </AccordionTrigger>
    </AccordionHeader>

    <AccordionContent>
      <div class="px-4 py-4 border-b border-border bg-surface-2/40 space-y-4">
        <div v-if="tool.description" class="max-w-3xl">
          <div class="text-[11px] uppercase tracking-wide text-fg-muted font-medium mb-1">
            Beschreibung
          </div>
          <p class="text-[13px] leading-[1.55] text-fg-2 whitespace-pre-line">
            {{ tool.description }}
          </p>
        </div>

        <div v-if="tool.inputSchema">
          <div class="text-[11px] uppercase tracking-wide text-fg-muted font-medium mb-1.5">
            Input-Schema
            <span class="text-fg-subtle font-normal normal-case tracking-normal">
              — Form der Argumente für den Tool-Call
            </span>
          </div>
          <JsonView :value="tool.inputSchema" />
        </div>

        <div v-if="tool.outputSchema">
          <div class="text-[11px] uppercase tracking-wide text-fg-muted font-medium mb-1.5">
            Output-Schema
            <span class="text-fg-subtle font-normal normal-case tracking-normal">
              — Form des Rückgabewerts
            </span>
          </div>
          <JsonView :value="tool.outputSchema" />
        </div>
      </div>
    </AccordionContent>
  </AccordionItem>
</template>
