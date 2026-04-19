<script setup lang="ts">
import { computed, ref } from 'vue'
import { AlertCircle, ChevronDown, RefreshCw, ArrowLeftRight, KeyRound, LogIn } from 'lucide-vue-next'
import type { ErrorDetails } from '~/composables/useMcpPlayground'

const props = defineProps<{
  details: ErrorDetails
}>()

const emit = defineEmits<{
  retry: []
  tryOther: []
}>()

const showDetails = ref(false)

const isOAuthRequired = computed(() => props.details.code === 'OAUTH_REQUIRED')
</script>

<template>
  <!-- OAuth-required state — expected, softer than a hard error -->
  <div
    v-if="isOAuthRequired"
    class="bg-surface border border-accent/30 rounded-xl overflow-hidden shadow-[0_8px_40px_-20px_rgba(37,99,235,0.25)]"
    role="status"
    aria-live="polite"
  >
    <div class="flex items-start gap-3 p-4 bg-accent-soft/60 border-b border-accent/20">
      <div class="shrink-0 mt-0.5 p-1.5 bg-accent/10 text-accent rounded-md">
        <KeyRound :size="16" :stroke-width="2" />
      </div>
      <div class="flex-1 min-w-0">
        <h3 class="text-[14px] font-semibold text-fg">{{ details.title }}</h3>
        <p class="text-[13px] text-fg-2 mt-1 break-words">{{ details.summary }}</p>
      </div>
    </div>

    <div class="p-4 border-b border-border">
      <p class="text-[13px] text-fg-2 leading-[1.5]">{{ details.hint }}</p>
    </div>

    <div class="p-3 bg-surface-2/40 border-b border-border flex flex-wrap gap-2">
      <button
        type="button"
        class="focus-ring flex items-center gap-1.5 h-9 px-4 bg-accent text-white rounded-md text-[13px] font-medium hover:brightness-110 transition-all"
        @click="emit('retry')"
      >
        <LogIn :size="13" />
        Jetzt anmelden
      </button>
      <span class="text-[11.5px] text-fg-muted self-center ml-1">
        Du wirst zum Provider weitergeleitet und kommst nach der Bestätigung hierher zurück.
      </span>
    </div>

    <button
      type="button"
      class="focus-ring w-full flex items-center justify-between px-4 py-2.5 text-[12px] text-fg-muted hover:text-fg-2 transition-colors"
      :aria-expanded="showDetails"
      @click="showDetails = !showDetails"
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
        <dd class="text-fg-2 break-all">
          {{ details.target }}
        </dd>
        <dt class="text-fg-muted">Transport</dt>
        <dd class="text-fg-2 uppercase">
          {{ details.transport }}
        </dd>
        <dt class="text-fg-muted">Raw</dt>
        <dd class="text-fg-2 break-all whitespace-pre-wrap">
          {{ details.raw }}
        </dd>
      </dl>
    </div>
  </div>

  <!-- Generic error state -->
  <div
    v-else
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
        class="focus-ring flex items-center gap-1.5 h-8 px-3 bg-fg text-bg rounded-md text-[12.5px] font-medium hover:bg-fg-2 transition-colors"
        @click="emit('retry')"
      >
        <RefreshCw :size="13" />
        Erneut versuchen
      </button>
      <button
        v-if="details.suggestOtherTransport"
        type="button"
        class="focus-ring flex items-center gap-1.5 h-8 px-3 bg-surface border border-border-strong rounded-md text-[12.5px] font-medium text-fg-2 hover:text-fg hover:border-fg/30 transition-colors"
        @click="emit('tryOther')"
      >
        <ArrowLeftRight :size="13" />
        {{ details.transport === 'http' ? 'Mit SSE versuchen' : 'Mit HTTP versuchen' }}
      </button>
    </div>

    <!-- Expandable technical details -->
    <button
      type="button"
      class="focus-ring w-full flex items-center justify-between px-4 py-2.5 text-[12px] text-fg-muted hover:text-fg-2 transition-colors"
      :aria-expanded="showDetails"
      @click="showDetails = !showDetails"
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
        <dd class="text-fg-2 break-all">
          {{ details.target }}
        </dd>
        <dt class="text-fg-muted">Transport</dt>
        <dd class="text-fg-2 uppercase">
          {{ details.transport }}
        </dd>
        <dt class="text-fg-muted">Code</dt>
        <dd class="text-fg-2">
          {{ details.code }}
        </dd>
        <dt class="text-fg-muted">Raw</dt>
        <dd class="text-fg-2 break-all whitespace-pre-wrap">
          {{ details.raw }}
        </dd>
      </dl>
    </div>
  </div>
</template>
