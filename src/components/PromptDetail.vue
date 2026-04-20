<script setup lang="ts">
import { computed, nextTick, onMounted, ref, useTemplateRef } from 'vue'
import { Loader2, MessageSquareText, Play, RotateCcw, Clock, User, Bot, Square, Eye } from 'lucide-vue-next'
import JsonView from './JsonView.vue'
import { useAbortableRun } from '~/composables/useAbortableRun'
import type {
  CallHistoryEntry,
  CallOptions,
  McpPrompt,
  PromptGetResult,
} from '~/composables/useMcpPlayground'

const props = defineProps<{
  prompt: McpPrompt
  history: CallHistoryEntry[]
  isConnected: boolean
  runPrompt: (
    name: string,
    args: Record<string, string>,
    options?: CallOptions,
  ) => Promise<CallHistoryEntry>
}>()

function initialArgs(): Record<string, string> {
  const record: Record<string, string> = {}
  for (const arg of props.prompt.arguments ?? []) {
    record[arg.name] = ''
  }
  return record
}

// Per-prompt state because parent uses `:key="prompt.name"`.
const promptArgs = ref<Record<string, string>>(initialArgs())
const lastEntry = ref<CallHistoryEntry | null>(null)
const rootRef = useTemplateRef<HTMLDivElement>('rootRef')
const formRef = useTemplateRef<HTMLFormElement>('formRef')

// See ToolDetail for rationale — scroll the header into view after the remount.
onMounted(() => {
  void nextTick(() => {
    rootRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
})

const { running, progress, progressPercent, run, cancel } = useAbortableRun<CallHistoryEntry>()

const missingRequired = computed<string[]>(() => {
  return (props.prompt.arguments ?? [])
    .filter((arg) => arg.required && !(promptArgs.value[arg.name] ?? '').trim())
    .map((arg) => arg.name)
})

function resetArgs() {
  promptArgs.value = initialArgs()
}

async function submit() {
  if (running.value || !props.isConnected || missingRequired.value.length > 0) return
  const filtered: Record<string, string> = {}
  for (const [k, v] of Object.entries(promptArgs.value)) {
    if (v.trim() !== '') filtered[k] = v
  }
  const entry = await run((options) => props.runPrompt(props.prompt.name, filtered, options))
  if (entry) lastEntry.value = entry
}

function replay(entry: CallHistoryEntry) {
  if (entry.args) {
    const next = initialArgs()
    for (const [k, v] of Object.entries(entry.args)) {
      if (typeof v === 'string') next[k] = v
    }
    promptArgs.value = next
  }
  lastEntry.value = entry
  formRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function showResponse(entry: CallHistoryEntry) {
  lastEntry.value = entry
  resultRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const resultRef = useTemplateRef<HTMLElement>('resultRef')

const lastResult = computed<PromptGetResult | null>(() => {
  const r = lastEntry.value?.result
  return r ? (r as PromptGetResult) : null
})

const recentHistory = computed(() =>
  props.history
    .filter((entry) => entry.kind === 'prompt' && entry.name === props.prompt.name)
    .slice(0, 10),
)

const disabled = computed(() => running.value || !props.isConnected)

function textContent(content: Record<string, unknown>): string | null {
  if (content.type === 'text' && typeof content.text === 'string') return content.text
  return null
}

function formatTime(at: number): string {
  return new Date(at).toLocaleTimeString('de-DE', { hour12: false })
}
</script>

<template>
  <div
    ref="rootRef"
    class="flex flex-col min-h-0"
    style="scroll-margin-top: calc(var(--connected-header-h, 5rem) + 0.75rem)"
  >
    <!-- Head -->
    <header class="px-5 md:px-6 pt-5 pb-4 border-b border-border bg-surface-2/30">
      <div class="flex items-baseline gap-2 flex-wrap">
        <h3 class="font-mono text-[16px] font-semibold text-fg break-all">
          {{ prompt.name }}
        </h3>
        <span
          v-if="prompt.title && prompt.title !== prompt.name"
          class="text-[13px] text-fg-muted"
        >
          — {{ prompt.title }}
        </span>
      </div>
      <p
        v-if="prompt.description"
        class="mt-2 text-[13.5px] leading-[1.6] text-fg-2 whitespace-pre-line max-w-[62ch]"
      >
        {{ prompt.description }}
      </p>
    </header>

    <!-- Args form -->
    <form
      ref="formRef"
      class="px-5 md:px-6 py-5 border-b border-border"
      style="scroll-margin-top: calc(var(--connected-header-h, 5rem) + 0.75rem)"
      @submit.prevent="submit"
    >
      <div class="flex items-baseline justify-between mb-3">
        <h4 class="text-[11px] uppercase tracking-wide text-fg-muted font-medium">
          Argumente
        </h4>
        <button
          v-if="prompt.arguments && prompt.arguments.length > 0"
          type="button"
          class="focus-ring inline-flex items-center gap-1 text-[11px] text-fg-muted hover:text-fg font-mono disabled:opacity-40"
          :disabled="running"
          @click="resetArgs"
        >
          <RotateCcw :size="11" />
          zurücksetzen
        </button>
      </div>

      <div v-if="!prompt.arguments || prompt.arguments.length === 0" class="text-[12.5px] text-fg-muted italic">
        Dieser Prompt erwartet keine Argumente.
      </div>

      <div v-else class="space-y-3">
        <div
          v-for="arg in prompt.arguments"
          :key="arg.name"
          class="space-y-1"
        >
          <label
            :for="`prompt-arg-${arg.name}`"
            class="block text-[12px] font-medium text-fg-2"
          >
            <span class="font-mono">{{ arg.name }}</span>
            <span
              v-if="arg.required"
              class="text-danger ml-0.5"
              aria-label="Pflichtfeld"
            >*</span>
          </label>
          <input
            :id="`prompt-arg-${arg.name}`"
            v-model="promptArgs[arg.name]"
            type="text"
            spellcheck="false"
            autocomplete="off"
            :disabled="disabled"
            class="focus-ring w-full h-9 px-2.5 bg-surface border border-border-strong rounded-md font-mono text-[12.5px] text-fg placeholder:text-fg-subtle focus:border-accent focus:outline-none disabled:bg-surface-2"
          />
          <p
            v-if="arg.description"
            class="text-[11.5px] text-fg-muted leading-[1.4]"
          >
            {{ arg.description }}
          </p>
        </div>
      </div>

      <div class="mt-4 flex items-center gap-3 flex-wrap">
        <button
          v-if="!running"
          type="submit"
          :disabled="!isConnected || missingRequired.length > 0"
          class="focus-ring inline-flex items-center gap-2 h-10 px-4 bg-accent text-white rounded-md text-[13px] font-medium hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Play :size="14" />
          Prompt abrufen
        </button>
        <button
          v-else
          type="button"
          class="focus-ring inline-flex items-center gap-2 h-10 px-4 bg-surface border border-danger/30 text-danger rounded-md text-[13px] font-medium hover:bg-danger-soft transition-colors"
          @click="cancel"
        >
          <Square :size="12" :stroke-width="2.5" class="fill-current" />
          Abbrechen
        </button>
        <p
          v-if="!isConnected"
          class="text-[11.5px] text-danger"
        >
          Nicht verbunden.
        </p>
        <p
          v-else-if="!running && missingRequired.length > 0"
          class="text-[11.5px] text-danger"
        >
          Pflichtfeld fehlt: {{ missingRequired.join(', ') }}
        </p>
      </div>

      <div v-if="running" class="mt-4 space-y-1.5" role="status" aria-live="polite">
        <div class="h-1.5 bg-surface-2 border border-border rounded-full overflow-hidden">
          <div
            v-if="progressPercent !== null"
            class="h-full bg-accent transition-[width] duration-300 ease-out"
            :style="{ width: `${progressPercent}%` }"
          />
          <div v-else class="h-full w-1/3 bg-accent rounded-full indeterminate-bar" />
        </div>
        <div class="flex items-baseline justify-between gap-3 text-[11.5px] text-fg-muted">
          <span class="truncate">
            <Loader2 :size="11" class="inline-block mr-1 animate-spin align-[-1px]" />
            <span v-if="progress?.message">{{ progress.message }}</span>
            <span v-else>Läuft — warte auf Server-Antwort …</span>
          </span>
          <span v-if="progressPercent !== null" class="font-mono tabular-nums shrink-0">
            {{ progressPercent }}%
          </span>
        </div>
      </div>
    </form>

    <!-- Result -->
    <section
      v-if="lastEntry"
      ref="resultRef"
      class="px-5 md:px-6 py-5 border-b border-border"
      style="scroll-margin-top: calc(var(--connected-header-h, 5rem) + 0.75rem)"
    >
      <div class="flex items-baseline justify-between mb-3">
        <h4 class="text-[11px] uppercase tracking-wide text-fg-muted font-medium">
          Messages
        </h4>
        <span class="text-[11px] text-fg-muted font-mono tabular-nums">
          {{ formatTime(lastEntry.at) }} · {{ lastEntry.durationMs }} ms
        </span>
      </div>

      <div
        v-if="lastEntry.error === 'Abgebrochen'"
        class="p-3 bg-warning-soft border border-warning/30 rounded-lg text-[12.5px] text-fg-muted"
        role="status"
      >
        Abgebrochen — du hast den Aufruf gestoppt, bevor eine Antwort ankam.
      </div>
      <div
        v-else-if="lastEntry.error"
        class="p-3 bg-danger-soft border border-danger/30 rounded-lg text-[12.5px] text-danger"
        role="alert"
      >
        {{ lastEntry.error }}
      </div>

      <template v-else-if="lastResult">
        <p
          v-if="lastResult.description"
          class="text-[13px] text-fg-2 mb-3 leading-[1.5]"
        >
          {{ lastResult.description }}
        </p>
        <div
          v-if="!Array.isArray(lastResult.messages) || lastResult.messages.length === 0"
          class="text-[12.5px] text-fg-muted italic"
        >
          Keine Messages zurückgegeben.
        </div>
        <ul v-else class="space-y-2">
          <li
            v-for="(msg, i) in lastResult.messages"
            :key="i"
            class="border border-border rounded-lg overflow-hidden"
          >
            <div
              class="flex items-center gap-1.5 px-3 py-1.5 text-[11px] uppercase tracking-wide font-medium border-b border-border"
              :class="msg.role === 'user'
                ? 'bg-accent-soft/40 text-accent'
                : 'bg-surface-2 text-fg-muted'"
            >
              <User v-if="msg.role === 'user'" :size="11" />
              <Bot v-else :size="11" />
              {{ msg.role }}
            </div>
            <div class="px-3 py-2.5 bg-surface">
              <pre
                v-if="textContent(msg.content)"
                class="font-mono text-[12px] leading-[1.55] whitespace-pre-wrap break-words text-fg-2"
              >{{ textContent(msg.content) }}</pre>
              <JsonView v-else :value="msg.content" :max-lines="12" />
            </div>
          </li>
        </ul>
      </template>
    </section>

    <!-- History -->
    <section
      v-if="recentHistory.length > 0"
      class="px-5 md:px-6 py-5"
    >
      <div class="flex items-baseline justify-between mb-3">
        <h4 class="text-[11px] uppercase tracking-wide text-fg-muted font-medium flex items-center gap-1.5">
          <MessageSquareText :size="11" />
          Letzte Abrufe
        </h4>
        <span class="text-[11px] text-fg-subtle font-mono">
          Request &amp; Response — klick zum Anzeigen
        </span>
      </div>
      <ul class="space-y-1">
        <li
          v-for="entry in recentHistory"
          :key="entry.id"
          class="group flex items-center gap-3 px-3 py-1.5 bg-surface border border-border rounded-md font-mono text-[11.5px] hover:bg-surface-2 transition-colors"
          :class="lastEntry?.id === entry.id ? 'border-cat-prompt/40 bg-cat-prompt-soft/40' : ''"
        >
          <span
            class="size-1.5 rounded-full shrink-0"
            :class="entry.success ? 'bg-success' : 'bg-danger'"
          />
          <span class="text-fg-muted tabular-nums w-12 shrink-0">
            {{ formatTime(entry.at) }}
          </span>
          <span class="flex items-center gap-1 text-fg-muted shrink-0 w-14">
            <Clock :size="10" />
            <span class="tabular-nums">{{ entry.durationMs }}ms</span>
          </span>
          <button
            type="button"
            class="focus-ring flex-1 min-w-0 truncate text-left text-fg-2 hover:text-fg"
            title="Response dieses Abrufs anzeigen"
            @click="showResponse(entry)"
          >
            {{ entry.args ? JSON.stringify(entry.args) : '—' }}
          </button>
          <button
            type="button"
            class="focus-ring shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10.5px] text-fg-muted hover:text-cat-prompt hover:bg-cat-prompt-soft/60 transition-colors"
            title="Response anzeigen"
            @click="showResponse(entry)"
          >
            <Eye :size="11" />
            Response
          </button>
          <button
            type="button"
            class="focus-ring shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10.5px] text-fg-muted hover:text-fg hover:bg-surface-2 transition-colors"
            title="Args in Formular laden"
            @click="replay(entry)"
          >
            <RotateCcw :size="11" />
            Args
          </button>
        </li>
      </ul>
    </section>
  </div>
</template>
