<script setup lang="ts">
import { ref } from 'vue'
import { AlertCircle, ChevronDown, RefreshCw, ArrowLeftRight } from 'lucide-vue-next'
import type { ErrorDetails } from '~/composables/useMcpInspector'

defineProps<{
  details: ErrorDetails
}>()

const emit = defineEmits<{
  (e: 'retry'): void
  (e: 'tryOther'): void
}>()

const showDetails = ref(false)
</script>

<template>
  <div
    class="bg-surface border border-danger/30 rounded-xl overflow-hidden shadow-[0_8px_40px_-20px_rgba(185,28,28,0.25)]"
    role="alert"
    aria-live="assertive"
  >
    <!-- Header -->
    <div class="flex items-start gap-3 p-4 bg-danger-soft/60 border-b border-danger/20">
      <div class="shrink-0 mt-0.5 p-1.5 bg-danger/10 text-danger rounded-md">
        <AlertCircle :size="16" :stroke-width="2" />
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-baseline gap-2 flex-wrap">
          <h3 class="text-[14px] font-semibold text-fg">{{ details.title }}</h3>
          <code class="text-[11px] font-mono text-danger bg-surface border border-danger/20 rounded px-1.5 py-0.5">
            {{ details.code }}
          </code>
        </div>
        <p class="text-[13px] text-fg-2 mt-1 break-words">
          {{ details.summary }}
        </p>
      </div>
    </div>

    <!-- Hint -->
    <div class="p-4 border-b border-border">
      <div class="text-[11px] uppercase tracking-wide text-fg-muted font-medium mb-1">
        Was tun
      </div>
      <p class="text-[13px] text-fg-2 leading-[1.5]">{{ details.hint }}</p>
    </div>

    <!-- Actions -->
    <div class="p-3 bg-surface-2/40 border-b border-border flex flex-wrap gap-2">
      <button
        type="button"
        @click="emit('retry')"
        class="focus-ring flex items-center gap-1.5 h-8 px-3 bg-fg text-bg rounded-md text-[12.5px] font-medium hover:bg-fg-2 transition-colors"
      >
        <RefreshCw :size="13" />
        Erneut versuchen
      </button>
      <button
        v-if="details.suggestOtherTransport"
        type="button"
        @click="emit('tryOther')"
        class="focus-ring flex items-center gap-1.5 h-8 px-3 bg-surface border border-border-strong rounded-md text-[12.5px] font-medium text-fg-2 hover:text-fg hover:border-fg/30 transition-colors"
      >
        <ArrowLeftRight :size="13" />
        {{ details.transport === 'http' ? 'Mit SSE versuchen' : 'Mit HTTP versuchen' }}
      </button>
    </div>

    <!-- Expandable technical details -->
    <button
      type="button"
      @click="showDetails = !showDetails"
      class="focus-ring w-full flex items-center justify-between px-4 py-2.5 text-[12px] text-fg-muted hover:text-fg-2 transition-colors"
      :aria-expanded="showDetails"
    >
      <span>Technische Details</span>
      <ChevronDown
        :size="13"
        class="transition-transform"
        :class="{ 'rotate-180': showDetails }"
      />
    </button>
    <div v-if="showDetails" class="px-4 pb-4">
      <dl class="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1.5 text-[12px] font-mono">
        <dt class="text-fg-muted">Target</dt>
        <dd class="text-fg-2 break-all">{{ details.target }}</dd>
        <dt class="text-fg-muted">Transport</dt>
        <dd class="text-fg-2 uppercase">{{ details.transport }}</dd>
        <dt class="text-fg-muted">Code</dt>
        <dd class="text-fg-2">{{ details.code }}</dd>
        <dt class="text-fg-muted">Raw</dt>
        <dd class="text-fg-2 break-all whitespace-pre-wrap">{{ details.raw }}</dd>
      </dl>
    </div>
  </div>
</template>
