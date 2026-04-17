<script setup lang="ts">
import { ref } from 'vue'
import { TabsRoot, TabsList, TabsTrigger, TabsContent, AccordionRoot } from 'reka-ui'
import { Wrench, FileText, MessageSquareQuote, ScrollText } from 'lucide-vue-next'
import ToolItem from './ToolItem.vue'
import ResourceItem from './ResourceItem.vue'
import PromptItem from './PromptItem.vue'
import type { McpTool, McpResource, McpResourceTemplate, McpPrompt, LogEntry } from '~/composables/useMcpInspector'

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
  return d.toLocaleTimeString('de-DE', { hour12: false }) + '.' + String(d.getMilliseconds()).padStart(3, '0')
}
</script>

<template>
  <section class="anim-in">
    <div class="flex items-baseline justify-between mb-3">
      <div class="flex items-baseline gap-3">
        <span class="text-[10px] uppercase tracking-[0.18em] text-muted">§ 03 —</span>
        <h2 class="font-display italic text-[22px] leading-none text-ink">Findings</h2>
      </div>
    </div>

    <TabsRoot v-model="tab" class="bg-white/80 border border-rule rounded-sm shadow-paper overflow-hidden">
      <TabsList
        class="flex border-b border-rule bg-paper-2/60 divide-x divide-hairline"
      >
        <TabsTrigger
          value="tools"
          class="flex items-center gap-2 px-5 py-3 text-[11px] uppercase tracking-[0.18em] text-muted data-[state=active]:bg-white data-[state=active]:text-ink relative transition-colors focus:outline-none"
        >
          <Wrench :size="12" :stroke-width="1.5" />
          Tools
          <span class="font-mono text-[10px] tabular-nums text-muted ml-0.5">
            {{ String(tools.length).padStart(2, '0') }}
          </span>
          <span
            v-if="tab === 'tools'"
            class="absolute inset-x-0 -bottom-px h-[2px] bg-rust"
          />
        </TabsTrigger>
        <TabsTrigger
          value="resources"
          class="flex items-center gap-2 px-5 py-3 text-[11px] uppercase tracking-[0.18em] text-muted data-[state=active]:bg-white data-[state=active]:text-ink relative transition-colors focus:outline-none"
        >
          <FileText :size="12" :stroke-width="1.5" />
          Resources
          <span class="font-mono text-[10px] tabular-nums text-muted ml-0.5">
            {{ String(resources.length + resourceTemplates.length).padStart(2, '0') }}
          </span>
          <span
            v-if="tab === 'resources'"
            class="absolute inset-x-0 -bottom-px h-[2px] bg-rust"
          />
        </TabsTrigger>
        <TabsTrigger
          value="prompts"
          class="flex items-center gap-2 px-5 py-3 text-[11px] uppercase tracking-[0.18em] text-muted data-[state=active]:bg-white data-[state=active]:text-ink relative transition-colors focus:outline-none"
        >
          <MessageSquareQuote :size="12" :stroke-width="1.5" />
          Prompts
          <span class="font-mono text-[10px] tabular-nums text-muted ml-0.5">
            {{ String(prompts.length).padStart(2, '0') }}
          </span>
          <span
            v-if="tab === 'prompts'"
            class="absolute inset-x-0 -bottom-px h-[2px] bg-rust"
          />
        </TabsTrigger>
        <TabsTrigger
          value="log"
          class="flex items-center gap-2 px-5 py-3 text-[11px] uppercase tracking-[0.18em] text-muted data-[state=active]:bg-white data-[state=active]:text-ink relative transition-colors focus:outline-none ml-auto"
        >
          <ScrollText :size="12" :stroke-width="1.5" />
          Log
          <span
            v-if="tab === 'log'"
            class="absolute inset-x-0 -bottom-px h-[2px] bg-rust"
          />
        </TabsTrigger>
      </TabsList>

      <TabsContent value="tools" class="focus:outline-none">
        <div v-if="tools.length === 0" class="px-5 py-10 text-center">
          <div class="font-display italic text-[20px] text-muted">nichts ausgestellt.</div>
          <div class="font-mono text-[11px] uppercase tracking-[0.18em] text-muted mt-1">
            Dieser Server deklariert keine Tools.
          </div>
        </div>
        <AccordionRoot v-else type="multiple" class="divide-y divide-transparent">
          <ToolItem v-for="(tool, i) in tools" :key="tool.name" :tool="tool" :index="i" />
        </AccordionRoot>
      </TabsContent>

      <TabsContent value="resources" class="focus:outline-none">
        <div v-if="resources.length === 0 && resourceTemplates.length === 0" class="px-5 py-10 text-center">
          <div class="font-display italic text-[20px] text-muted">leere Bibliothek.</div>
          <div class="font-mono text-[11px] uppercase tracking-[0.18em] text-muted mt-1">
            keine Resources gemeldet.
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

      <TabsContent value="prompts" class="focus:outline-none">
        <div v-if="prompts.length === 0" class="px-5 py-10 text-center">
          <div class="font-display italic text-[20px] text-muted">keine Prompts vorhanden.</div>
          <div class="font-mono text-[11px] uppercase tracking-[0.18em] text-muted mt-1">
            der Server bietet keine vordefinierten Prompts.
          </div>
        </div>
        <ul v-else>
          <PromptItem v-for="(p, i) in prompts" :key="p.name" :prompt="p" :index="i" />
        </ul>
      </TabsContent>

      <TabsContent value="log" class="focus:outline-none">
        <ul v-if="log.length" class="divide-y divide-hairline">
          <li
            v-for="entry in log"
            :key="entry.at + entry.message"
            class="flex items-start gap-4 px-5 py-2.5 font-mono text-[12px]"
          >
            <span class="text-muted tabular-nums whitespace-nowrap">
              {{ formatTime(entry.at) }}
            </span>
            <span
              class="w-12 shrink-0 text-[10px] uppercase tracking-[0.16em]"
              :class="{
                'text-moss': entry.level === 'success',
                'text-rust': entry.level === 'error',
                'text-ochre': entry.level === 'warn',
                'text-muted': entry.level === 'info',
              }"
            >
              {{ entry.level }}
            </span>
            <span class="text-ink flex-1 break-words">{{ entry.message }}</span>
          </li>
        </ul>
        <div v-else class="px-5 py-10 text-center">
          <div class="font-display italic text-[20px] text-muted">Log ist still.</div>
        </div>
      </TabsContent>
    </TabsRoot>
  </section>
</template>
