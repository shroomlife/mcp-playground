<script setup lang="ts">
import { MessageSquareQuote } from 'lucide-vue-next'
import type { McpPrompt } from '~/composables/useMcpInspector'

defineProps<{ prompt: McpPrompt; index: number }>()
</script>

<template>
  <li class="flex items-start gap-4 px-5 py-4 border-b border-hairline last:border-b-0 hover:bg-paper-2/50 transition-colors">
    <span class="font-mono text-[10px] text-muted tabular-nums w-6 tracking-tight mt-1">
      {{ String(index + 1).padStart(2, '0') }}
    </span>
    <MessageSquareQuote
      :size="14"
      :stroke-width="1.5"
      class="text-ochre shrink-0 mt-1"
    />
    <div class="flex-1 min-w-0">
      <div class="flex items-baseline gap-2 flex-wrap">
        <span class="font-mono text-[13px] text-ink">{{ prompt.name }}</span>
        <span
          v-if="prompt.title && prompt.title !== prompt.name"
          class="font-display italic text-[14px] text-muted"
        >
          — {{ prompt.title }}
        </span>
      </div>
      <p v-if="prompt.description" class="text-[12px] text-muted mt-1 max-w-3xl">
        {{ prompt.description }}
      </p>
      <div
        v-if="prompt.arguments && prompt.arguments.length"
        class="mt-2.5 flex flex-wrap gap-1.5"
      >
        <span
          v-for="arg in prompt.arguments"
          :key="arg.name"
          class="inline-flex items-center gap-1 px-2 py-0.5 bg-paper-2 border border-hairline rounded-full font-mono text-[10.5px]"
        >
          <span class="text-ink">{{ arg.name }}</span>
          <span
            v-if="arg.required"
            class="text-rust text-[9px] uppercase tracking-wider"
          >
            req
          </span>
        </span>
      </div>
    </div>
  </li>
</template>
