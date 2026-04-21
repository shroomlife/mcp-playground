<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, useTemplateRef } from 'vue'
import {
  Activity,
  LogOut,
  KeyRound,
  Wrench,
  FileText,
  MessageSquareText,
  Check,
} from 'lucide-vue-next'
import {
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
  TooltipPortal,
  TooltipContent,
  TooltipArrow,
} from 'reka-ui'
import InstallToClaudeCode from './InstallToClaudeCode.vue'
import ThemeToggle from './ThemeToggle.vue'
import { suggestServerName } from '~/lib/claudeCodeInstall'
import { capabilityInfo, activeSubFlags } from '~/lib/capabilityCopy'
import type { AuthHeader, ServerSummary, TransportKind } from '~/composables/useMcpPlayground'

const props = defineProps<{
  server: ServerSummary | null
  capabilities: string[]
  /** Raw capability map from the handshake — used for sub-flag lookups in tooltips. */
  capabilityDetails?: Record<string, unknown>
  latencyMs: number | null
  counts: { tools: number; resources: number; prompts: number }
  url: string
  transport: TransportKind
  authHeaderCount?: number
  reconnecting?: boolean
  /** Wird an den Install-Dialog weitergereicht, damit der Auth übernehmen kann. */
  installBearerToken?: string | null
  installCustomHeaders?: AuthHeader[]
  installOauthAccessToken?: string | null
}>()

const emit = defineEmits<{
  disconnect: []
}>()

// Pre-compute lookup + sub-flags once per caps change — das Template rendert
// Title, Description und Flags aus einem Eintrag, kein Triple-Call im v-for.
const capabilityEntries = computed(() =>
  props.capabilities.map((cap) => {
    const info = capabilityInfo(cap)
    const entry = props.capabilityDetails?.[cap]
    return { key: cap, info, flags: activeSubFlags(entry, info) }
  }),
)

const suggestedName = computed(() => suggestServerName(props.server?.name, props.url))

const prettyUrl = computed(() => {
  try {
    const u = new URL(props.url)
    return { host: u.host, path: u.pathname + u.search, scheme: u.protocol.replace(':', '') }
  } catch {
    return { host: props.url, path: '', scheme: '' }
  }
})

// Expose the current header height as a CSS variable so scroll-margin-top in the
// detail panes can offset under the sticky strip — picking a tool at the bottom
// of the list used to snap the page to a header that sat behind this one.
// ResizeObserver covers wrap-on-mobile and the conditional capability pills row.
const headerRef = useTemplateRef<HTMLElement>('headerRef')
let headerResizeObserver: ResizeObserver | null = null

onMounted(() => {
  const el = headerRef.value
  if (!el) return
  const update = () => {
    document.documentElement.style.setProperty(
      '--connected-header-h',
      `${el.offsetHeight}px`,
    )
  }
  update()
  headerResizeObserver = new ResizeObserver(update)
  headerResizeObserver.observe(el)
})

onBeforeUnmount(() => {
  headerResizeObserver?.disconnect()
  headerResizeObserver = null
  document.documentElement.style.removeProperty('--connected-header-h')
})
</script>

<template>
  <header
    v-if="server"
    ref="headerRef"
    class="sticky top-0 z-30 border-b border-border bg-bg/85 backdrop-blur-md"
  >
    <div class="mx-auto max-w-[1200px] px-6 md:px-10 py-3 flex items-center gap-4 flex-wrap">
      <!-- Identity -->
      <div class="flex items-center gap-2.5 min-w-0">
        <span
          class="size-2 rounded-full pulse-dot"
          :class="reconnecting ? 'bg-warning' : 'bg-success'"
          :aria-label="reconnecting ? 'Reconnect läuft' : 'Verbunden'"
        />
        <div class="min-w-0">
          <div class="flex items-baseline gap-2">
            <h1 class="font-mono text-[13.5px] font-semibold text-fg truncate max-w-[24ch]">
              {{ server.name }}
            </h1>
            <span class="font-mono text-[11px] text-fg-muted tabular-nums">
              v{{ server.version }}
            </span>
            <span
              v-if="reconnecting"
              class="inline-flex items-center gap-1 h-[18px] px-1.5 bg-warning-soft text-warning rounded text-[10.5px] font-medium"
              title="Handshake mit aktualisierter Auth läuft"
            >
              <span class="size-1 rounded-full bg-warning pulse-dot" aria-hidden="true" />
              reconnecting
            </span>
          </div>
          <div class="flex items-center gap-1.5 mt-0.5 text-[11.5px] text-fg-muted min-w-0">
            <span class="font-mono uppercase text-[10px] text-fg-subtle tracking-wide shrink-0">
              {{ transport }}
            </span>
            <span class="text-fg-subtle">·</span>
            <span class="font-mono truncate">
              <span class="text-fg-subtle">{{ prettyUrl.scheme }}://</span>{{ prettyUrl.host }}<span
                class="text-fg-subtle"
              >{{ prettyUrl.path }}</span>
            </span>
          </div>
        </div>
      </div>

      <!-- Stats -->
      <div class="flex items-center gap-4 text-[11.5px] text-fg-muted ml-auto">
        <div
          v-if="latencyMs !== null"
          class="hidden sm:flex items-center gap-1.5"
          :title="`Handshake-Latenz: ${latencyMs} ms`"
        >
          <Activity :size="12" :stroke-width="2" />
          <span class="font-mono tabular-nums">{{ latencyMs }} ms</span>
        </div>
        <div
          v-if="authHeaderCount && authHeaderCount > 0"
          class="hidden sm:flex items-center gap-1.5 text-success"
          :title="`${authHeaderCount} Auth-Header aktiv`"
        >
          <KeyRound :size="12" :stroke-width="2" />
          <span>Auth</span>
        </div>
        <!-- Capability counts — colour-coded to match InspectorPanels tabs -->
        <div class="flex items-center gap-3 font-mono">
          <span class="flex items-center gap-1" :title="`${counts.tools} Tools`">
            <Wrench :size="11" :stroke-width="1.75" class="text-cat-tool" />
            <span class="tabular-nums">{{ counts.tools }}</span>
          </span>
          <span class="flex items-center gap-1" :title="`${counts.resources} Resources`">
            <FileText :size="11" :stroke-width="1.75" class="text-cat-resource" />
            <span class="tabular-nums">{{ counts.resources }}</span>
          </span>
          <span class="flex items-center gap-1" :title="`${counts.prompts} Prompts`">
            <MessageSquareText :size="11" :stroke-width="1.75" class="text-cat-prompt" />
            <span class="tabular-nums">{{ counts.prompts }}</span>
          </span>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex items-center gap-2">
        <ThemeToggle />
        <InstallToClaudeCode
          :url="url"
          :transport="transport"
          :suggested-name="suggestedName"
          :bearer-token="installBearerToken"
          :custom-headers="installCustomHeaders"
          :oauth-access-token="installOauthAccessToken"
        />
        <button
          type="button"
          aria-label="Verbindung trennen"
          class="focus-ring inline-flex items-center gap-1.5 h-9 px-3 bg-surface border border-border-strong rounded-md text-[12.5px] text-fg-2 hover:text-fg hover:border-fg/30 transition-colors"
          title="Verbindung trennen"
          @click="emit('disconnect')"
        >
          <LogOut :size="13" aria-hidden="true" />
          <span class="hidden md:inline">Trennen</span>
        </button>
      </div>
    </div>

    <!-- Capability pills strip — hover öffnet Tooltip mit deutscher Erklärung + aktiven Sub-Flags -->
    <TooltipProvider :delay-duration="120" :skip-delay-duration="60">
      <div
        v-if="capabilityEntries.length > 0"
        class="mx-auto max-w-[1200px] px-6 md:px-10 pb-2.5 flex items-center gap-1.5 flex-wrap text-[11px]"
      >
        <span class="uppercase tracking-wide text-fg-subtle font-medium">Capabilities</span>
        <TooltipRoot v-for="entry in capabilityEntries" :key="entry.key">
          <TooltipTrigger as-child>
            <button
              type="button"
              class="focus-ring font-mono text-fg-muted bg-surface border border-border rounded-sm px-1.5 py-0.5 hover:text-fg-2 hover:border-border-strong cursor-help decoration-dotted underline-offset-2 transition-colors"
              :aria-label="`Erklärung zu ${entry.key}`"
            >
              {{ entry.key }}
            </button>
          </TooltipTrigger>
          <TooltipPortal>
            <TooltipContent
              :side-offset="6"
              class="z-50 max-w-[320px] p-2.5 bg-fg text-bg rounded-md shadow-lg text-[11.5px] leading-[1.45] data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
            >
              <div class="font-semibold font-sans mb-1">
                {{ entry.info.title }}
              </div>
              <div class="font-sans opacity-90">
                {{ entry.info.description }}
              </div>
              <ul
                v-if="entry.flags.length > 0"
                class="mt-2 space-y-0.5 font-sans text-[11px] opacity-80"
              >
                <li
                  v-for="flag in entry.flags"
                  :key="flag.key"
                  class="flex items-start gap-1.5"
                >
                  <Check :size="11" class="shrink-0 mt-0.5 opacity-80" />
                  <span>{{ flag.label }}</span>
                </li>
              </ul>
              <TooltipArrow class="fill-fg" />
            </TooltipContent>
          </TooltipPortal>
        </TooltipRoot>
      </div>
    </TooltipProvider>
  </header>
</template>
