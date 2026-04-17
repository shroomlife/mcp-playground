<script setup lang="ts">
import { ref } from 'vue'
import { TabsRoot, TabsList, TabsTrigger, TabsContent, AccordionRoot } from 'reka-ui'
import { Wrench, FileText, MessageSquareText, ScrollText } from 'lucide-vue-next'
import ToolItem from './ToolItem.vue'
import ResourceItem from './ResourceItem.vue'
import PromptItem from './PromptItem.vue'
import type {
  McpTool,
  McpResource,
  McpResourceTemplate,
  McpPrompt,
  LogEntry,
} from '~/composables/useMcpInspector'

defineProps<{
  tools: McpTool[]
  resources: McpResource[]
  resourceTemplates: McpResourceTemplate[]
  prompts: McpPrompt[]
  log: LogEntry[]
}>()

const tab = ref<'tools' | 'resources' | 'prompts' | 'log'>('tools')

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
    <header class="mb-3">
      <h2 class="text-[15px] font-semibold text-fg">Angebot des Servers</h2>
      <p class="text-[13px] text-fg-muted mt-0.5 max-w-2xl">
        Die drei Bausteine von MCP: <strong class="font-medium text-fg-2">Tools</strong>
        (ausführen), <strong class="font-medium text-fg-2">Resources</strong> (lesen),
        <strong class="font-medium text-fg-2">Prompts</strong> (Templates). Der Log zeigt
        jede Antwort vom Server.
      </p>
    </header>

    <TabsRoot
      v-model="tab"
      class="bg-surface border border-border rounded-lg overflow-hidden"
    >
      <TabsList class="flex border-b border-border bg-surface-2/60" aria-label="Inspector-Bereiche">
        <TabsTrigger
          value="tools"
          class="focus-ring flex items-center gap-2 px-4 py-2.5 text-[12.5px] font-medium text-fg-muted data-[state=active]:text-fg data-[state=active]:bg-surface relative transition-colors"
        >
          <Wrench :size="13" :stroke-width="1.75" />
          Tools
          <span class="font-mono text-[11px] tabular-nums text-fg-muted">
            {{ tools.length }}
          </span>
          <span
            v-if="tab === 'tools'"
            class="absolute inset-x-3 -bottom-px h-[2px] bg-accent rounded-full"
          />
        </TabsTrigger>
        <TabsTrigger
          value="resources"
          class="focus-ring flex items-center gap-2 px-4 py-2.5 text-[12.5px] font-medium text-fg-muted data-[state=active]:text-fg data-[state=active]:bg-surface relative transition-colors"
        >
          <FileText :size="13" :stroke-width="1.75" />
          Resources
          <span class="font-mono text-[11px] tabular-nums text-fg-muted">
            {{ resources.length + resourceTemplates.length }}
          </span>
          <span
            v-if="tab === 'resources'"
            class="absolute inset-x-3 -bottom-px h-[2px] bg-accent rounded-full"
          />
        </TabsTrigger>
        <TabsTrigger
          value="prompts"
          class="focus-ring flex items-center gap-2 px-4 py-2.5 text-[12.5px] font-medium text-fg-muted data-[state=active]:text-fg data-[state=active]:bg-surface relative transition-colors"
        >
          <MessageSquareText :size="13" :stroke-width="1.75" />
          Prompts
          <span class="font-mono text-[11px] tabular-nums text-fg-muted">
            {{ prompts.length }}
          </span>
          <span
            v-if="tab === 'prompts'"
            class="absolute inset-x-3 -bottom-px h-[2px] bg-accent rounded-full"
          />
        </TabsTrigger>
        <TabsTrigger
          value="log"
          class="focus-ring flex items-center gap-2 px-4 py-2.5 text-[12.5px] font-medium text-fg-muted data-[state=active]:text-fg data-[state=active]:bg-surface relative transition-colors ml-auto"
        >
          <ScrollText :size="13" :stroke-width="1.75" />
          Log
          <span
            v-if="tab === 'log'"
            class="absolute inset-x-3 -bottom-px h-[2px] bg-accent rounded-full"
          />
        </TabsTrigger>
      </TabsList>

      <!-- Tools -->
      <TabsContent value="tools" class="focus:outline-none">
        <div v-if="tools.length === 0" class="px-4 py-10 text-center">
          <div class="text-[13px] text-fg-muted">
            Dieser Server deklariert keine Tools.
          </div>
        </div>
        <AccordionRoot v-else type="multiple">
          <ToolItem
            v-for="(tool, i) in tools"
            :key="tool.name"
            :tool="tool"
            :index="i"
          />
        </AccordionRoot>
      </TabsContent>

      <!-- Resources -->
      <TabsContent value="resources" class="focus:outline-none">
        <div
          v-if="resources.length === 0 && resourceTemplates.length === 0"
          class="px-4 py-10 text-center"
        >
          <div class="text-[13px] text-fg-muted">
            Keine Resources oder Templates gemeldet.
          </div>
        </div>
        <ul v-else>
          <ResourceItem
            v-for="(r, i) in resources"
            :key="r.uri"
            :resource="r"
            :index="i"
          />
          <ResourceItem
            v-for="(r, i) in resourceTemplates"
            :key="r.uriTemplate"
            :resource="r"
            :is-template="true"
            :index="resources.length + i"
          />
        </ul>
      </TabsContent>

      <!-- Prompts -->
      <TabsContent value="prompts" class="focus:outline-none">
        <div v-if="prompts.length === 0" class="px-4 py-10 text-center">
          <div class="text-[13px] text-fg-muted">
            Keine Prompts vorhanden.
          </div>
        </div>
        <ul v-else>
          <PromptItem
            v-for="(p, i) in prompts"
            :key="p.name"
            :prompt="p"
            :index="i"
          />
        </ul>
      </TabsContent>

      <!-- Log -->
      <TabsContent value="log" class="focus:outline-none">
        <ul
          v-if="log.length"
          role="log"
          aria-live="polite"
          aria-label="Verbindungs-Log"
          class="divide-y divide-border"
        >
          <li
            v-for="entry in log"
            :key="entry.id"
            class="flex items-start gap-3 px-4 py-2 font-mono text-[12px]"
          >
            <span class="text-fg-muted tabular-nums whitespace-nowrap">
              {{ formatTime(entry.at) }}
            </span>
            <span
              class="w-14 shrink-0 text-[10.5px] uppercase tracking-wide font-medium"
              :class="{
                'text-success': entry.level === 'success',
                'text-danger': entry.level === 'error',
                'text-warning': entry.level === 'warn',
                'text-fg-muted': entry.level === 'info',
              }"
            >
              {{ entry.level }}
            </span>
            <span class="text-fg-2 flex-1 break-words">{{ entry.message }}</span>
          </li>
        </ul>
        <div v-else class="px-4 py-10 text-center">
          <div class="text-[13px] text-fg-muted">Log ist leer.</div>
        </div>
      </TabsContent>
    </TabsRoot>
  </section>
</template>
