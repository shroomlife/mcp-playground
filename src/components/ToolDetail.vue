<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'
import { Play, Loader2, RotateCcw, Clock, ArrowDownUp, Square } from 'lucide-vue-next'
import SchemaForm from './SchemaForm.vue'
import ToolResultView from './ToolResultView.vue'
import JsonView from './JsonView.vue'
import { useAbortableRun } from '~/composables/useAbortableRun'
import {
  analyzeSchema,
  getDefaultArgs,
  validateArgs,
  stripEmpty,
} from '~/lib/schemaFormHelpers'
import type { ValidationError } from '~/lib/schemaFormHelpers'
import type {
  CallHistoryEntry,
  CallOptions,
  McpTool,
  ToolCallResult,
} from '~/composables/useMcpPlayground'

const props = defineProps<{
  tool: McpTool
  history: CallHistoryEntry[]
  isConnected: boolean
  runTool: (
    name: string,
    args: Record<string, unknown>,
    options?: CallOptions,
  ) => Promise<CallHistoryEntry>
}>()

// State is per-tool because parent uses `:key="tool.name"` — no cross-tool leaks.
const analysis = computed(() => analyzeSchema(props.tool.inputSchema))
const paramCount = computed(() => analysis.value.fields.length)
const requiredCount = computed(() => analysis.value.fields.filter((f) => f.required).length)

const args = ref<Record<string, unknown>>(getDefaultArgs(props.tool.inputSchema))
const validationErrors = ref<ValidationError[]>([])
const jsonAllValid = ref(true)
const lastEntry = ref<CallHistoryEntry | null>(null)

const { running, progress, progressPercent, run, cancel } = useAbortableRun<CallHistoryEntry>()

const formRef = useTemplateRef<HTMLFormElement>('formRef')

function resetArgs() {
  args.value = getDefaultArgs(props.tool.inputSchema)
  validationErrors.value = []
}

async function submit() {
  if (running.value || !props.isConnected) return
  const errors = validateArgs(analysis.value, args.value)
  validationErrors.value = errors
  if (errors.length > 0 || !jsonAllValid.value) return

  const entry = await run((options) =>
    props.runTool(props.tool.name, stripEmpty(args.value), options),
  )
  if (entry) lastEntry.value = entry
}

function replay(entry: CallHistoryEntry) {
  if (entry.args) args.value = { ...entry.args }
  lastEntry.value = entry
  formRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const lastResult = computed<ToolCallResult | null>(() => {
  const r = lastEntry.value?.result
  return r ? (r as ToolCallResult) : null
})

const disabled = computed(() => running.value || !props.isConnected)

const recentHistory = computed(() =>
  props.history
    .filter((entry) => entry.kind === 'tool' && entry.name === props.tool.name)
    .slice(0, 10),
)

function formatTime(at: number): string {
  return new Date(at).toLocaleTimeString('de-DE', { hour12: false })
}
</script>

<template>
  <div class="flex flex-col min-h-0">
    <!-- Tool head -->
    <header class="px-5 md:px-6 pt-5 pb-4 border-b border-border bg-surface-2/30">
      <div class="flex items-baseline gap-2 flex-wrap">
        <h3 class="font-mono text-[16px] font-semibold text-fg break-all">
          {{ tool.name }}
        </h3>
        <span
          v-if="tool.title && tool.title !== tool.name"
          class="text-[13px] text-fg-muted"
        >
          — {{ tool.title }}
        </span>
      </div>
      <p
        v-if="tool.description"
        class="mt-2 text-[13.5px] leading-[1.6] text-fg-2 whitespace-pre-line max-w-[62ch]"
      >
        {{ tool.description }}
      </p>
    </header>

    <!-- Form section -->
    <form
      ref="formRef"
      class="px-5 md:px-6 py-5 border-b border-border"
      @submit.prevent="submit"
    >
      <div class="flex items-baseline justify-between mb-3">
        <h4 class="text-[11px] uppercase tracking-wide text-fg-muted font-medium">
          Argumente
        </h4>
        <div class="flex items-center gap-3 text-[11px] text-fg-subtle font-mono">
          <span v-if="paramCount > 0">
            {{ paramCount }} · {{ requiredCount }} required
          </span>
          <button
            v-if="paramCount > 0"
            type="button"
            class="focus-ring inline-flex items-center gap-1 text-fg-muted hover:text-fg disabled:opacity-40"
            :disabled="running"
            @click="resetArgs"
          >
            <RotateCcw :size="11" />
            zurücksetzen
          </button>
        </div>
      </div>

      <SchemaForm
        v-model="args"
        :fields="analysis.fields"
        :errors="validationErrors"
        :disabled="disabled"
        @json-valid-change="(v) => (jsonAllValid = v)"
      />

      <!-- Submit -->
      <div class="mt-4 flex items-center gap-3 flex-wrap">
        <button
          v-if="!running"
          type="submit"
          :disabled="!isConnected || !jsonAllValid"
          class="focus-ring inline-flex items-center gap-2 h-10 px-4 bg-accent text-white rounded-md text-[13px] font-medium hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Play :size="14" />
          Ausführen
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
          v-else-if="!running && validationErrors.length > 0"
          class="text-[11.5px] text-danger"
        >
          {{ validationErrors.length }} Pflichtfeld{{ validationErrors.length === 1 ? '' : 'er' }} fehlt/fehlen
        </p>
        <p
          v-else-if="!running && !jsonAllValid"
          class="text-[11.5px] text-danger"
        >
          JSON-Felder enthalten Syntaxfehler
        </p>
      </div>

      <!-- Progress strip -->
      <div v-if="running" class="mt-4 space-y-1.5" role="status" aria-live="polite">
        <div class="h-1.5 bg-surface-2 border border-border rounded-full overflow-hidden">
          <div
            v-if="progressPercent !== null"
            class="h-full bg-accent transition-[width] duration-300 ease-out"
            :style="{ width: `${progressPercent}%` }"
          />
          <div
            v-else
            class="h-full w-1/3 bg-accent rounded-full indeterminate-bar"
          />
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

    <!-- Result section -->
    <section
      v-if="lastEntry"
      class="px-5 md:px-6 py-5 border-b border-border"
    >
      <div class="flex items-baseline justify-between mb-3">
        <h4 class="text-[11px] uppercase tracking-wide text-fg-muted font-medium">
          Ergebnis
        </h4>
        <span class="text-[11px] text-fg-muted font-mono tabular-nums">
          {{ formatTime(lastEntry.at) }} · {{ lastEntry.durationMs }} ms
        </span>
      </div>
      <ToolResultView
        :result="lastResult"
        :error="lastEntry.error"
        :duration-ms="lastEntry.durationMs"
      />
    </section>

    <!-- Output schema (collapsible, for reference) -->
    <details
      v-if="tool.outputSchema"
      class="px-5 md:px-6 py-4 border-b border-border group"
    >
      <summary class="focus-ring list-none flex items-center gap-2 text-[11px] uppercase tracking-wide text-fg-muted font-medium cursor-pointer hover:text-fg-2">
        <ArrowDownUp :size="11" />
        Output-Schema
        <span class="text-fg-subtle normal-case tracking-normal font-normal">
          — erwartete Form des Rückgabewerts
        </span>
      </summary>
      <div class="mt-3">
        <JsonView :value="tool.outputSchema" :max-lines="20" />
      </div>
    </details>

    <!-- History -->
    <section
      v-if="recentHistory.length > 0"
      class="px-5 md:px-6 py-5"
    >
      <h4 class="text-[11px] uppercase tracking-wide text-fg-muted font-medium mb-3">
        Letzte Aufrufe
      </h4>
      <ul class="space-y-1">
        <li
          v-for="entry in recentHistory"
          :key="entry.id"
          class="flex items-center gap-3 px-3 py-1.5 bg-surface border border-border rounded-md font-mono text-[11.5px] hover:bg-surface-2 transition-colors"
          :class="lastEntry?.id === entry.id ? 'border-accent/40 bg-accent-soft/30' : ''"
        >
          <span
            class="size-1.5 rounded-full shrink-0"
            :class="entry.success ? 'bg-success' : 'bg-danger'"
            :aria-label="entry.success ? 'Erfolgreich' : 'Fehlgeschlagen'"
          />
          <span class="text-fg-muted tabular-nums w-12 shrink-0">
            {{ formatTime(entry.at) }}
          </span>
          <span class="flex items-center gap-1 text-fg-muted shrink-0 w-14">
            <Clock :size="10" />
            <span class="tabular-nums">{{ entry.durationMs }}ms</span>
          </span>
          <span class="flex-1 min-w-0 truncate text-fg-2">
            {{ entry.args ? JSON.stringify(entry.args) : '—' }}
          </span>
          <button
            type="button"
            class="focus-ring shrink-0 text-accent hover:underline text-[11px]"
            title="Args in Formular laden"
            @click="replay(entry)"
          >
            laden
          </button>
        </li>
      </ul>
    </section>
  </div>
</template>
