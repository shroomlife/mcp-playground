<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import {
  AlertCircle,
  ChevronDown,
  RefreshCw,
  ArrowLeftRight,
  KeyRound,
  LogIn,
  Check,
  Copy,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-vue-next'
import type { ErrorDetails } from '~/composables/useMcpPlayground'

const props = defineProps<{
  details: ErrorDetails
}>()

const emit = defineEmits<{
  retry: []
  tryOther: []
}>()

const showDetails = ref(false)
const showDiagnostic = ref(true)

const isOAuthRequired = computed(() => props.details.code === 'OAUTH_REQUIRED')
const diagnostic = computed(() => props.details.diagnostic)

const diagnosticHealthy = computed(() => {
  const d = diagnostic.value
  if (!d) return false
  return (
    d.reachable
    && d.allowOrigin !== null
    && d.missingHeaders.length === 0
    && d.allowsMethod
  )
})

function buildReport(): string {
  const d = props.details
  const lines: string[] = [
    '## MCP Playground Diagnostic Report',
    '',
    `- **Target:** ${d.target}`,
    `- **Transport:** ${d.transport.toUpperCase()}`,
    `- **Code:** \`${d.code}\` — ${d.title}`,
    `- **Summary:** ${d.summary}`,
    `- **Raw:** \`${d.raw}\``,
  ]
  if (d.diagnostic) {
    const diag = d.diagnostic
    lines.push(
      '',
      '### CORS Preflight',
      `- **Reachable:** ${diag.reachable ? 'yes' : 'no'}`,
    )
    if (diag.httpStatus !== undefined) lines.push(`- **HTTP status:** ${diag.httpStatus}`)
    if (diag.error) lines.push(`- **Fetch error:** \`${diag.error}\``)
    if (diag.allowOrigin !== null) {
      lines.push(`- **Access-Control-Allow-Origin:** \`${diag.allowOrigin}\``)
    } else if (diag.reachable) {
      lines.push('- **Access-Control-Allow-Origin:** _(missing)_')
    }
    if (diag.allowMethods.length > 0) {
      lines.push(`- **Access-Control-Allow-Methods:** \`${diag.allowMethods.join(', ')}\``)
    }
    if (diag.allowHeaders.length > 0) {
      lines.push(`- **Access-Control-Allow-Headers:** \`${diag.allowHeaders.join(', ')}\``)
    }
    if (diag.exposeHeaders.length > 0) {
      lines.push(`- **Access-Control-Expose-Headers:** \`${diag.exposeHeaders.join(', ')}\``)
    }
    lines.push(`- **Expected headers:** \`${diag.expectedHeaders.join(', ')}\``)
    if (diag.missingHeaders.length > 0) {
      lines.push(`- **Missing headers:** \`${diag.missingHeaders.join(', ')}\``)
    }
  }
  return lines.join('\n')
}

const copied = ref(false)
const copyError = ref<string | null>(null)
let copyTimer: ReturnType<typeof setTimeout> | null = null

async function copyReport() {
  copyError.value = null
  const report = buildReport()
  try {
    await navigator.clipboard.writeText(report)
    copied.value = true
    if (copyTimer) clearTimeout(copyTimer)
    copyTimer = setTimeout(() => {
      copied.value = false
      copyTimer = null
    }, 2000)
    return
  } catch {
    // Clipboard API is often blocked in non-HTTPS contexts or by permissions.
  }
  // Fallback: nativer Prompt. In headless-Browsern returnt der sofort null — dann
  // geben wir den Text in die Console und zeigen eine klare Fehlermeldung, damit
  // der User nicht im Leeren steht.
  try {
    const promptResult = window.prompt('Bericht kopieren (Strg/Cmd+C):', report)
    if (promptResult === null) {
      console.warn('[mcp-playground] Clipboard copy declined. Report:\n', report)
      copyError.value = 'Kopieren nicht möglich. Bericht steht in der Browser-Console.'
    }
  } catch {
    console.warn('[mcp-playground] Clipboard copy failed. Report:\n', report)
    copyError.value = 'Kopieren nicht möglich. Bericht steht in der Browser-Console.'
  }
}

onBeforeUnmount(() => {
  if (copyTimer) {
    clearTimeout(copyTimer)
    copyTimer = null
  }
})
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
      <button
        type="button"
        class="focus-ring ml-auto flex items-center gap-1.5 h-8 px-3 bg-surface border border-border-strong rounded-md text-[12.5px] font-medium text-fg-2 hover:text-fg hover:border-fg/30 transition-colors"
        @click="copyReport"
      >
        <Check v-if="copied" :size="13" class="text-success" />
        <Copy v-else :size="13" />
        {{ copied ? 'Kopiert' : 'Bericht kopieren' }}
      </button>
    </div>
    <p
      v-if="copyError"
      role="status"
      class="px-4 py-2 text-[11.5px] text-danger bg-danger-soft/40 border-b border-border"
    >
      {{ copyError }}
    </p>

    <!-- CORS diagnostic (auto-run after connect failure for relevant codes) -->
    <template v-if="diagnostic">
      <button
        type="button"
        class="focus-ring w-full flex items-center gap-2 px-4 py-2.5 text-[12px] border-b border-border transition-colors"
        :class="diagnosticHealthy ? 'text-success hover:bg-success-soft/30' : 'text-warning hover:bg-warning-soft/30'"
        :aria-expanded="showDiagnostic"
        @click="showDiagnostic = !showDiagnostic"
      >
        <ShieldCheck v-if="diagnosticHealthy" :size="13" />
        <ShieldAlert v-else :size="13" />
        <span class="font-medium">CORS-Diagnose</span>
        <span class="text-fg-muted font-normal">
          {{
            !diagnostic.reachable
              ? '— Preflight hat keine Response bekommen (CORS oder Netzwerk)'
              : diagnostic.missingHeaders.length > 0
                ? `— ${diagnostic.missingHeaders.length} Header fehlen in Allow-Headers`
                : !diagnosticHealthy
                  ? '— Siehe Details'
                  : '— sieht gut aus'
          }}
        </span>
        <ChevronDown
          :size="13"
          class="ml-auto transition-transform"
          :class="{ 'rotate-180': showDiagnostic }"
        />
      </button>
      <div v-if="showDiagnostic" class="px-4 py-3 border-b border-border bg-surface-2/30">
        <dl class="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-[11.5px] font-mono">
          <dt class="text-fg-muted">Preflight</dt>
          <dd class="text-fg-2">
            {{ diagnostic.reachable ? `OK · HTTP ${diagnostic.httpStatus}` : 'keine Response' }}
            <span v-if="diagnostic.error" class="text-fg-muted break-all"> · {{ diagnostic.error }}</span>
          </dd>
          <dt class="text-fg-muted">Allow-Origin</dt>
          <dd :class="diagnostic.allowOrigin ? 'text-fg-2' : 'text-warning'">
            {{ diagnostic.allowOrigin ?? 'fehlt' }}
          </dd>
          <dt class="text-fg-muted">Allow-Methods</dt>
          <dd :class="diagnostic.allowsMethod ? 'text-fg-2' : 'text-warning'">
            {{ diagnostic.allowMethods.length > 0 ? diagnostic.allowMethods.join(', ') : '— (leer)' }}
          </dd>
          <dt class="text-fg-muted">Allow-Headers</dt>
          <dd class="text-fg-2 break-all">
            {{ diagnostic.allowHeaders.length > 0 ? diagnostic.allowHeaders.join(', ') : '— (leer)' }}
          </dd>
          <template v-if="diagnostic.missingHeaders.length > 0">
            <dt class="text-fg-muted">Fehlend</dt>
            <dd class="text-warning font-medium break-all">
              {{ diagnostic.missingHeaders.join(', ') }}
            </dd>
          </template>
          <template v-if="diagnostic.exposeHeaders.length > 0">
            <dt class="text-fg-muted">Expose-Headers</dt>
            <dd class="text-fg-2 break-all">
              {{ diagnostic.exposeHeaders.join(', ') }}
            </dd>
          </template>
        </dl>
        <p v-if="diagnostic.missingHeaders.length > 0" class="mt-3 text-[11.5px] text-fg-2 leading-[1.4]">
          Diese Headers erwartet das MCP-SDK bei jedem Request. Fehlen sie in
          <code class="font-mono">Access-Control-Allow-Headers</code>, verwirft der Browser den
          Preflight — im UI sichtbar als "Failed to fetch". Server-Config (Nuxt / Express /
          Nginx) entsprechend erweitern.
        </p>
        <p v-else-if="!diagnostic.reachable" class="mt-3 text-[11.5px] text-fg-2 leading-[1.4]">
          Der Browser hat den OPTIONS-Preflight gar nicht erst abgeschlossen. Typisch für fehlenden
          <code class="font-mono">Access-Control-Allow-Origin</code>-Header oder einen Server,
          der OPTIONS komplett ablehnt.
        </p>
      </div>
    </template>

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
