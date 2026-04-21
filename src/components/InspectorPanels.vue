<script setup lang="ts">
import { computed, watch } from 'vue'
import { TabsRoot, TabsList, TabsTrigger, TabsContent } from 'reka-ui'
import {
  Wrench,
  FileText,
  MessageSquareText,
  ScrollText,
  Radio,
  Beaker,
  Puzzle,
} from 'lucide-vue-next'
import ToolExplorer from './ToolExplorer.vue'
import ResourceExplorer from './ResourceExplorer.vue'
import PromptExplorer from './PromptExplorer.vue'
import RpcTracePanel from './RpcTracePanel.vue'
import CapabilityFeaturesPanel from './CapabilityFeaturesPanel.vue'
import { useSessionState } from '~/composables/useSessionState'
import type {
  CallHistoryEntry,
  CallOptions,
  LogEntry,
  McpPrompt,
  McpResource,
  McpResourceTemplate,
  McpTool,
  TraceEntry,
} from '~/composables/useMcpPlayground'

const props = defineProps<{
  tools: McpTool[]
  resources: McpResource[]
  resourceTemplates: McpResourceTemplate[]
  prompts: McpPrompt[]
  log: LogEntry[]
  callHistory: CallHistoryEntry[]
  traceEntries: TraceEntry[]
  isConnected: boolean
  /** Raw server capabilities map — treibt Extensions/Experimental-Tabs an. */
  capabilities?: Record<string, unknown>
  runTool: (
    name: string,
    args: Record<string, unknown>,
    options?: CallOptions,
  ) => Promise<CallHistoryEntry>
  runPrompt: (
    name: string,
    args: Record<string, string>,
    options?: CallOptions,
  ) => Promise<CallHistoryEntry>
  readResource: (uri: string, options?: CallOptions) => Promise<CallHistoryEntry>
  sendCustomRequest: (
    method: string,
    params: unknown,
  ) => Promise<{ result?: unknown; error?: { code?: number; message?: string; data?: unknown } }>
}>()

const session = useSessionState()
const tab = session.tab

// Tabs für frei definierte Vendor-Capabilities. Sichtbar nur wenn der Server
// den Key im Handshake deklariert hat (auch mit leerem Object — Tab zeigt dann
// den Empty-State). `listsFeatureKeys`-Capabilities aus capabilityCopy: experimental,
// extensions. Hardcoded hier, damit das Tab-Layout statisch und ARIA-stabil bleibt.
const extensionsEntry = computed(() => props.capabilities?.extensions)
const experimentalEntry = computed(() => props.capabilities?.experimental)
const hasExtensions = computed(
  () => typeof extensionsEntry.value === 'object' && extensionsEntry.value !== null,
)
const hasExperimental = computed(
  () => typeof experimentalEntry.value === 'object' && experimentalEntry.value !== null,
)

function featureCount(entry: unknown): number {
  if (!entry || typeof entry !== 'object') return 0
  return Object.keys(entry as Record<string, unknown>).length
}

// Wenn der aktuell aktive Tab durch Disconnect/Reconnect verschwindet, fall back
// auf Tools — sonst würde Reka mit unbekanntem Value rendern.
const availableTabs = computed(() => {
  const base = ['tools', 'resources', 'prompts', 'rpc', 'log']
  if (hasExtensions.value) base.push('extensions')
  if (hasExperimental.value) base.push('experimental')
  return base
})

watch(availableTabs, (list) => {
  if (!list.includes(tab.value)) tab.value = 'tools'
})

function formatTime(at: number) {
  const d = new Date(at)
  return (
    d.toLocaleTimeString('de-DE', { hour12: false }) +
    '.' +
    String(d.getMilliseconds()).padStart(3, '0')
  )
}
</script>

<template>
  <section class="fade-in">
    <TabsRoot
      v-model="tab"
      class="bg-surface border border-border rounded-xl overflow-hidden shadow-[0_1px_0_rgba(0,0,0,0.02)]"
    >
      <TabsList
        class="flex border-b border-border bg-surface-2/50"
        aria-label="Server-Bereiche"
      >
        <TabsTrigger
          value="tools"
          class="focus-ring relative flex items-center gap-2 px-5 py-3 text-[13px] font-medium text-fg-muted data-[state=active]:text-fg data-[state=active]:bg-surface transition-colors"
        >
          <Wrench :size="14" :stroke-width="1.75" class="text-cat-tool" />
          <span>Tools</span>
          <span
            class="font-mono text-[11px] tabular-nums px-1.5 rounded"
            :class="tab === 'tools'
              ? 'bg-cat-tool-soft text-cat-tool'
              : 'text-fg-muted'"
          >
            {{ tools.length }}
          </span>
          <span
            v-if="tab === 'tools'"
            class="absolute inset-x-4 -bottom-px h-[2px] bg-cat-tool rounded-full"
          />
        </TabsTrigger>
        <TabsTrigger
          value="resources"
          class="focus-ring relative flex items-center gap-2 px-5 py-3 text-[13px] font-medium text-fg-muted data-[state=active]:text-fg data-[state=active]:bg-surface transition-colors"
        >
          <FileText :size="14" :stroke-width="1.75" class="text-cat-resource" />
          <span>Resources</span>
          <span
            class="font-mono text-[11px] tabular-nums px-1.5 rounded"
            :class="tab === 'resources'
              ? 'bg-cat-resource-soft text-cat-resource'
              : 'text-fg-muted'"
          >
            {{ resources.length + resourceTemplates.length }}
          </span>
          <span
            v-if="tab === 'resources'"
            class="absolute inset-x-4 -bottom-px h-[2px] bg-cat-resource rounded-full"
          />
        </TabsTrigger>
        <TabsTrigger
          value="prompts"
          class="focus-ring relative flex items-center gap-2 px-5 py-3 text-[13px] font-medium text-fg-muted data-[state=active]:text-fg data-[state=active]:bg-surface transition-colors"
        >
          <MessageSquareText :size="14" :stroke-width="1.75" class="text-cat-prompt" />
          <span>Prompts</span>
          <span
            class="font-mono text-[11px] tabular-nums px-1.5 rounded"
            :class="tab === 'prompts'
              ? 'bg-cat-prompt-soft text-cat-prompt'
              : 'text-fg-muted'"
          >
            {{ prompts.length }}
          </span>
          <span
            v-if="tab === 'prompts'"
            class="absolute inset-x-4 -bottom-px h-[2px] bg-cat-prompt rounded-full"
          />
        </TabsTrigger>
        <TabsTrigger
          v-if="hasExtensions"
          value="extensions"
          class="focus-ring relative flex items-center gap-2 px-5 py-3 text-[13px] font-medium text-fg-muted data-[state=active]:text-fg data-[state=active]:bg-surface transition-colors"
        >
          <Puzzle :size="14" :stroke-width="1.75" />
          <span>Extensions</span>
          <span
            class="font-mono text-[11px] tabular-nums px-1.5 rounded"
            :class="tab === 'extensions' ? 'bg-accent-soft text-accent' : 'text-fg-muted'"
          >
            {{ featureCount(extensionsEntry) }}
          </span>
          <span
            v-if="tab === 'extensions'"
            class="absolute inset-x-4 -bottom-px h-[2px] bg-accent rounded-full"
          />
        </TabsTrigger>
        <TabsTrigger
          v-if="hasExperimental"
          value="experimental"
          class="focus-ring relative flex items-center gap-2 px-5 py-3 text-[13px] font-medium text-fg-muted data-[state=active]:text-fg data-[state=active]:bg-surface transition-colors"
        >
          <Beaker :size="14" :stroke-width="1.75" />
          <span>Experimental</span>
          <span
            class="font-mono text-[11px] tabular-nums px-1.5 rounded"
            :class="tab === 'experimental' ? 'bg-warning-soft text-warning' : 'text-fg-muted'"
          >
            {{ featureCount(experimentalEntry) }}
          </span>
          <span
            v-if="tab === 'experimental'"
            class="absolute inset-x-4 -bottom-px h-[2px] bg-warning rounded-full"
          />
        </TabsTrigger>
        <TabsTrigger
          value="rpc"
          class="focus-ring relative flex items-center gap-2 px-5 py-3 text-[13px] font-medium text-fg-muted data-[state=active]:text-fg data-[state=active]:bg-surface transition-colors ml-auto"
        >
          <Radio :size="14" :stroke-width="1.75" />
          <span>RPC</span>
          <span class="font-mono text-[11px] tabular-nums text-fg-muted">
            {{ traceEntries.length }}
          </span>
          <span
            v-if="tab === 'rpc'"
            class="absolute inset-x-4 -bottom-px h-[2px] bg-accent rounded-full"
          />
        </TabsTrigger>
        <TabsTrigger
          value="log"
          class="focus-ring relative flex items-center gap-2 px-5 py-3 text-[13px] font-medium text-fg-muted data-[state=active]:text-fg data-[state=active]:bg-surface transition-colors"
        >
          <ScrollText :size="14" :stroke-width="1.75" />
          <span>Log</span>
          <span class="font-mono text-[11px] tabular-nums text-fg-muted">
            {{ log.length }}
          </span>
          <span
            v-if="tab === 'log'"
            class="absolute inset-x-4 -bottom-px h-[2px] bg-accent rounded-full"
          />
        </TabsTrigger>
      </TabsList>

      <TabsContent value="tools" class="focus:outline-none">
        <ToolExplorer
          :tools="tools"
          :history="callHistory"
          :is-connected="isConnected"
          :run-tool="runTool"
        />
      </TabsContent>

      <TabsContent value="resources" class="focus:outline-none">
        <ResourceExplorer
          :resources="resources"
          :templates="resourceTemplates"
          :history="callHistory"
          :is-connected="isConnected"
          :read-resource="readResource"
        />
      </TabsContent>

      <TabsContent value="prompts" class="focus:outline-none">
        <PromptExplorer
          :prompts="prompts"
          :history="callHistory"
          :is-connected="isConnected"
          :run-prompt="runPrompt"
        />
      </TabsContent>

      <TabsContent v-if="hasExtensions" value="extensions" class="focus:outline-none">
        <CapabilityFeaturesPanel
          capability-key="extensions"
          :entry="extensionsEntry"
        />
      </TabsContent>

      <TabsContent v-if="hasExperimental" value="experimental" class="focus:outline-none">
        <CapabilityFeaturesPanel
          capability-key="experimental"
          :entry="experimentalEntry"
        />
      </TabsContent>

      <TabsContent value="rpc" class="focus:outline-none">
        <RpcTracePanel
          :entries="traceEntries"
          :is-connected="isConnected"
          :send-custom-request="sendCustomRequest"
        />
      </TabsContent>

      <TabsContent value="log" class="focus:outline-none">
        <ul
          v-if="log.length"
          role="log"
          aria-live="polite"
          aria-label="Verbindungs-Log"
          class="divide-y divide-border max-h-[480px] overflow-y-auto"
        >
          <li
            v-for="entry in log"
            :key="entry.id"
            class="flex items-start gap-3 px-5 py-2 font-mono text-[12px]"
          >
            <span class="text-fg-muted tabular-nums whitespace-nowrap">
              {{ formatTime(entry.at) }}
            </span>
            <span
              class="w-16 shrink-0 text-[9.5px] uppercase tracking-wide font-medium"
              :class="entry.source === 'server' ? 'text-accent' : 'text-fg-subtle'"
              :title="entry.source === 'server' ? `Server-Log${entry.logger ? ' · ' + entry.logger : ''}` : 'Client-intern'"
            >
              {{ entry.source === 'server' ? (entry.logger ? 'SRV' : 'SERVER') : 'CLIENT' }}
            </span>
            <span
              class="w-14 shrink-0 text-[10.5px] uppercase tracking-wide font-medium"
              :class="{
                'text-success': entry.level === 'success',
                'text-danger': entry.level === 'error' || entry.level === 'critical',
                'text-warning': entry.level === 'warn' || entry.level === 'notice',
                'text-fg-muted': entry.level === 'info' || entry.level === 'debug',
              }"
            >
              {{ entry.level }}
            </span>
            <span class="text-fg-2 flex-1 break-words">{{ entry.message }}</span>
          </li>
        </ul>
        <div v-else class="px-6 py-14 text-center">
          <div class="text-[13px] text-fg-muted">Log ist leer.</div>
        </div>
      </TabsContent>
    </TabsRoot>
  </section>
</template>
