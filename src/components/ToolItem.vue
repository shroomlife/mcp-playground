<script setup lang="ts">
import { computed } from 'vue'
import { ChevronDown, Wrench } from 'lucide-vue-next'
import { AccordionItem, AccordionHeader, AccordionTrigger, AccordionContent } from 'reka-ui'
import JsonView from './JsonView.vue'
import type { McpTool } from '~/composables/useMcpInspector'

const props = defineProps<{ tool: McpTool; index: number }>()

const paramCount = computed(() => {
  const schema = props.tool.inputSchema as { properties?: Record<string, unknown>; required?: string[] } | undefined
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
        class="w-full flex items-center gap-4 px-5 py-3.5 text-left hover:bg-paper-2/60 transition-colors border-b border-hairline group-data-[state=open]:bg-paper-2/80 group-last:border-b-0"
      >
        <span
          class="font-mono text-[10px] text-muted tabular-nums w-6 tracking-tight"
        >
          {{ String(index + 1).padStart(2, '0') }}
        </span>
        <Wrench :size="14" :stroke-width="1.5" class="text-rust shrink-0" />
        <div class="flex-1 min-w-0">
          <div class="flex items-baseline gap-3 flex-wrap">
            <span class="font-mono text-[13.5px] text-ink">{{ tool.name }}</span>
            <span
              v-if="tool.title && tool.title !== tool.name"
              class="font-display italic text-[14px] text-muted"
            >
              — {{ tool.title }}
            </span>
          </div>
          <p
            v-if="tool.description"
            class="text-[12px] text-muted mt-0.5 line-clamp-1 group-data-[state=open]:line-clamp-none"
          >
            {{ tool.description }}
          </p>
        </div>
        <div class="hidden md:flex items-center gap-3 text-[10px] font-mono uppercase tracking-[0.14em] text-muted">
          <span>{{ paramCount }} param</span>
          <span class="text-hairline">·</span>
          <span>{{ requiredCount }} req</span>
        </div>
        <ChevronDown
          :size="14"
          class="text-muted transition-transform group-data-[state=open]:rotate-180"
        />
      </AccordionTrigger>
    </AccordionHeader>

    <AccordionContent>
      <div class="px-5 py-4 border-b border-hairline bg-paper/70 space-y-3">
        <div v-if="tool.description" class="max-w-3xl">
          <div class="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-1">
            Description
          </div>
          <p class="font-display text-[15px] leading-[1.5] text-ink-2">
            {{ tool.description }}
          </p>
        </div>

        <div v-if="tool.inputSchema">
          <div class="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-1.5">
            Input schema
          </div>
          <JsonView :value="tool.inputSchema" />
        </div>

        <div v-if="tool.outputSchema">
          <div class="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-1.5">
            Output schema
          </div>
          <JsonView :value="tool.outputSchema" />
        </div>
      </div>
    </AccordionContent>
  </AccordionItem>
</template>
