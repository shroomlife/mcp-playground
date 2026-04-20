<script setup lang="ts">
import { computed, nextTick, onMounted, ref, toRef, useTemplateRef } from 'vue'
import { Play, Loader2, RotateCcw, Clock, ArrowDownUp, Square, Link2, Check, Bookmark, X, Eye } from 'lucide-vue-next'
import SchemaForm from './SchemaForm.vue'
import ToolResultView from './ToolResultView.vue'
import JsonView from './JsonView.vue'
import { useAbortableRun } from '~/composables/useAbortableRun'
import { consumeRecipe } from '~/composables/useRecipeInbox'
import { buildRecipeUrl } from '~/composables/useRouter'
import { useSessionState } from '~/composables/useSessionState'
import { useFixtures } from '~/composables/useFixtures'
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

// Recipe-URL support: if the user arrived via a share-link and the stashed recipe
// targets this tool, consume its args instead of filling with schema defaults.
const recipeArgs = consumeRecipe(props.tool.name)
const args = ref<Record<string, unknown>>(
  recipeArgs ?? getDefaultArgs(props.tool.inputSchema),
)
const validationErrors = ref<ValidationError[]>([])
const jsonAllValid = ref(true)
const lastEntry = ref<CallHistoryEntry | null>(null)

const session = useSessionState()
const recipeCopied = ref(false)
let recipeCopyTimer: ReturnType<typeof setTimeout> | null = null

const fixturesApi = useFixtures(toRef(session.url))
const toolFixtures = fixturesApi.forTool(props.tool.name)

function saveCurrentAsFixture() {
  fixturesApi.add(props.tool.name, stripEmpty(args.value))
}

function loadFixture(fixture: { id: string; args: Record<string, unknown> }) {
  args.value = { ...fixture.args }
  formRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function fixturePreview(args: Record<string, unknown>): string {
  try {
    const s = JSON.stringify(args)
    return s.length > 60 ? `${s.slice(0, 60)}…` : s
  } catch {
    return ''
  }
}

async function shareRecipe() {
  const serverUrl = session.url.value
  if (!serverUrl) return
  const url = buildRecipeUrl(serverUrl, session.transport.value, props.tool.name, stripEmpty(args.value))
  if (!url) return
  try {
    await navigator.clipboard.writeText(url)
    recipeCopied.value = true
    if (recipeCopyTimer) clearTimeout(recipeCopyTimer)
    recipeCopyTimer = setTimeout(() => (recipeCopied.value = false), 1500)
  } catch {
    // clipboard unavailable — ignore
  }
}

const { running, progress, progressPercent, run, cancel } = useAbortableRun<CallHistoryEntry>()

const rootRef = useTemplateRef<HTMLDivElement>('rootRef')
const formRef = useTemplateRef<HTMLFormElement>('formRef')

// Parent keys us on tool.name, so switching tools remounts this component.
// After mount we nudge the nearest scroll container to this header — otherwise,
// picking a tool while scrolled to the bottom of a long list leaves the user
// staring at the list footer instead of the freshly-loaded detail pane.
onMounted(() => {
  void nextTick(() => {
    rootRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
})

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

// Show a past entry's stored response without overwriting the current form args.
function showResponse(entry: CallHistoryEntry) {
  lastEntry.value = entry
  resultRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const resultRef = useTemplateRef<HTMLElement>('resultRef')

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
  <div ref="rootRef" class="flex flex-col min-h-0">
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
            type="button"
            class="focus-ring inline-flex items-center gap-1 text-fg-muted hover:text-fg disabled:opacity-40"
            title="Shareable URL mit diesen Args kopieren"
            @click="shareRecipe"
          >
            <Check v-if="recipeCopied" :size="11" class="text-success" />
            <Link2 v-else :size="11" />
            {{ recipeCopied ? 'kopiert' : 'teilen' }}
          </button>
          <button
            type="button"
            class="focus-ring inline-flex items-center gap-1 text-fg-muted hover:text-fg disabled:opacity-40"
            :disabled="running"
            title="Aktuelle Args als Fixture speichern (localStorage, pro Server)"
            @click="saveCurrentAsFixture"
          >
            <Bookmark :size="11" />
            speichern
          </button>
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
      ref="resultRef"
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

    <!-- Saved Fixtures for this tool -->
    <section
      v-if="toolFixtures.length > 0"
      class="px-5 md:px-6 py-5 border-b border-border"
    >
      <div class="flex items-baseline justify-between mb-3">
        <h4 class="text-[11px] uppercase tracking-wide text-fg-muted font-medium flex items-center gap-1.5">
          <Bookmark :size="11" />
          Gespeicherte Fixtures
        </h4>
        <span class="text-[11px] text-fg-subtle font-mono">
          {{ toolFixtures.length }}
        </span>
      </div>
      <ul class="space-y-1">
        <li
          v-for="fixture in toolFixtures"
          :key="fixture.id"
          class="group flex items-center gap-3 px-3 py-1.5 bg-surface border border-border rounded-md font-mono text-[11.5px] hover:bg-surface-2 transition-colors"
        >
          <span class="text-fg-muted tabular-nums w-12 shrink-0">
            {{ formatTime(fixture.savedAt) }}
          </span>
          <span class="flex-1 min-w-0 truncate text-fg-2">
            {{ fixturePreview(fixture.args) }}
          </span>
          <button
            type="button"
            class="focus-ring shrink-0 text-accent hover:underline text-[11px]"
            title="Args ins Formular laden"
            @click="loadFixture(fixture)"
          >
            laden
          </button>
          <button
            type="button"
            class="focus-ring shrink-0 p-0.5 text-fg-muted hover:text-danger opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
            aria-label="Fixture löschen"
            @click="fixturesApi.remove(fixture.id)"
          >
            <X :size="11" />
          </button>
        </li>
      </ul>
    </section>

    <!-- History -->
    <section
      v-if="recentHistory.length > 0"
      class="px-5 md:px-6 py-5"
    >
      <div class="flex items-baseline justify-between mb-3">
        <h4 class="text-[11px] uppercase tracking-wide text-fg-muted font-medium">
          Letzte Aufrufe
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
          :class="lastEntry?.id === entry.id ? 'border-cat-tool/40 bg-cat-tool-soft/40' : ''"
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
          <button
            type="button"
            class="focus-ring flex-1 min-w-0 truncate text-left text-fg-2 hover:text-fg"
            title="Response dieses Aufrufs anzeigen"
            @click="showResponse(entry)"
          >
            {{ entry.args ? JSON.stringify(entry.args) : '—' }}
          </button>
          <button
            type="button"
            class="focus-ring shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10.5px] text-fg-muted hover:text-cat-tool hover:bg-cat-tool-soft/60 transition-colors"
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
