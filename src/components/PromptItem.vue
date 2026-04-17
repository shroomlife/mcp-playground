<script setup lang="ts">
import { MessageSquareText } from 'lucide-vue-next'
import type { McpPrompt } from '~/composables/useMcpInspector'

defineProps<{ prompt: McpPrompt; index: number }>()
</script>

<template>
  <li class="flex items-start gap-3 px-4 py-3 border-b border-border last:border-b-0 hover:bg-surface-2 transition-colors">
    <span class="font-mono text-[11px] text-fg-muted tabular-nums w-6 pt-0.5">
      {{ String(index + 1).padStart(2, '0') }}
    </span>
    <MessageSquareText
      :size="14"
      :stroke-width="1.75"
      class="text-accent shrink-0 mt-0.5"
    />
    <div class="flex-1 min-w-0">
      <div class="flex items-baseline gap-2 flex-wrap">
        <span class="font-mono text-[13px] font-medium text-fg">{{ prompt.name }}</span>
        <span
          v-if="prompt.title && prompt.title !== prompt.name"
          class="text-[12px] text-fg-muted"
        >
          {{ prompt.title }}
        </span>
      </div>
      <p v-if="prompt.description" class="text-[12.5px] text-fg-2 mt-0.5 max-w-3xl">
        {{ prompt.description }}
      </p>
      <div
        v-if="prompt.arguments && prompt.arguments.length"
        class="mt-2 flex flex-wrap gap-1.5"
      >
        <span
          v-for="arg in prompt.arguments"
          :key="arg.name"
          class="inline-flex items-center gap-1.5 px-2 py-0.5 bg-surface-2 border border-border rounded font-mono text-[11px]"
          :title="arg.description"
        >
          <span class="text-fg">{{ arg.name }}</span>
          <span
            v-if="arg.required"
            class="text-danger text-[9.5px] uppercase tracking-wide font-medium"
          >
            req
          </span>
        </span>
      </div>
    </div>
  </li>
</template>
