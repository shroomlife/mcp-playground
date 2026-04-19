<script setup lang="ts">
import { computed } from 'vue'
import { Activity, LogOut, KeyRound, Wrench, FileText, MessageSquareText } from 'lucide-vue-next'
import InstallToClaudeCode from './InstallToClaudeCode.vue'
import ThemeToggle from './ThemeToggle.vue'
import { suggestServerName } from '~/lib/claudeCodeInstall'
import type { ServerSummary, TransportKind } from '~/composables/useMcpPlayground'

const props = defineProps<{
  server: ServerSummary | null
  capabilities: string[]
  latencyMs: number | null
  counts: { tools: number; resources: number; prompts: number }
  url: string
  transport: TransportKind
  authHeaderCount?: number
}>()

const emit = defineEmits<{
  disconnect: []
}>()

const suggestedName = computed(() => suggestServerName(props.server?.name, props.url))

const prettyUrl = computed(() => {
  try {
    const u = new URL(props.url)
    return { host: u.host, path: u.pathname + u.search, scheme: u.protocol.replace(':', '') }
  } catch {
    return { host: props.url, path: '', scheme: '' }
  }
})
</script>

<template>
  <header
    v-if="server"
    class="sticky top-0 z-30 border-b border-border bg-bg/85 backdrop-blur-md"
  >
    <div class="mx-auto max-w-[1200px] px-6 md:px-10 py-3 flex items-center gap-4 flex-wrap">
      <!-- Identity -->
      <div class="flex items-center gap-2.5 min-w-0">
        <span class="size-2 rounded-full bg-success pulse-dot" aria-hidden="true" />
        <div class="min-w-0">
          <div class="flex items-baseline gap-2">
            <h1 class="font-mono text-[13.5px] font-semibold text-fg truncate max-w-[24ch]">
              {{ server.name }}
            </h1>
            <span class="font-mono text-[11px] text-fg-muted tabular-nums">
              v{{ server.version }}
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
        <!-- Capability counts -->
        <div class="flex items-center gap-3 font-mono">
          <span class="flex items-center gap-1" :title="`${counts.tools} Tools`">
            <Wrench :size="11" :stroke-width="1.75" class="text-accent" />
            <span class="tabular-nums">{{ counts.tools }}</span>
          </span>
          <span class="flex items-center gap-1" :title="`${counts.resources} Resources`">
            <FileText :size="11" :stroke-width="1.75" class="text-accent" />
            <span class="tabular-nums">{{ counts.resources }}</span>
          </span>
          <span class="flex items-center gap-1" :title="`${counts.prompts} Prompts`">
            <MessageSquareText :size="11" :stroke-width="1.75" class="text-accent" />
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

    <!-- Capability pills strip -->
    <div
      v-if="capabilities.length > 0"
      class="mx-auto max-w-[1200px] px-6 md:px-10 pb-2.5 flex items-center gap-1.5 flex-wrap text-[11px]"
    >
      <span class="uppercase tracking-wide text-fg-subtle font-medium">Capabilities</span>
      <span
        v-for="cap in capabilities"
        :key="cap"
        class="font-mono text-fg-muted bg-surface border border-border rounded-sm px-1.5 py-0.5"
      >
        {{ cap }}
      </span>
    </div>
  </header>
</template>
