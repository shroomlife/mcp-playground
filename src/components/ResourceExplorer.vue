<script setup lang="ts">
import { computed, watch } from 'vue'
import { Search, X, FileText, Link2 } from 'lucide-vue-next'
import ResourceDetail from './ResourceDetail.vue'
import { useSessionState } from '~/composables/useSessionState'
import type {
  CallHistoryEntry,
  CallOptions,
  McpResource,
  McpResourceTemplate,
} from '~/composables/useMcpPlayground'

type ResourceRow =
  | { kind: 'static'; resource: McpResource; key: string }
  | { kind: 'template'; resource: McpResourceTemplate; key: string }

const props = defineProps<{
  resources: McpResource[]
  templates: McpResourceTemplate[]
  history: CallHistoryEntry[]
  isConnected: boolean
  readResource: (uri: string, options?: CallOptions) => Promise<CallHistoryEntry>
}>()

const session = useSessionState()
const query = session.searchResources
const selectedKey = session.resourceKey

const allRows = computed<ResourceRow[]>(() => {
  const staticRows: ResourceRow[] = props.resources.map((r) => ({
    kind: 'static',
    resource: r,
    key: `static:${r.uri}`,
  }))
  const templateRows: ResourceRow[] = props.templates.map((r) => ({
    kind: 'template',
    resource: r,
    key: `template:${r.uriTemplate}`,
  }))
  return [...staticRows, ...templateRows]
})

const normalizedQuery = computed(() => query.value.trim().toLowerCase())

const filtered = computed<ResourceRow[]>(() => {
  const q = normalizedQuery.value
  if (!q) return allRows.value
  return allRows.value.filter((row) => {
    const uri = row.kind === 'static' ? row.resource.uri : row.resource.uriTemplate
    const r = row.resource
    return [uri, r.name ?? '', r.title ?? '', r.description ?? '']
      .join(' ')
      .toLowerCase()
      .includes(q)
  })
})

const selectedRow = computed<ResourceRow | null>(() => {
  if (!allRows.value.length) return null
  const match = allRows.value.find((r) => r.key === selectedKey.value)
  if (match) return match
  return filtered.value[0] ?? allRows.value[0] ?? null
})

function selectRow(row: ResourceRow) {
  session.markUserSelection()
  selectedKey.value = row.key
}

function clearQuery() {
  query.value = ''
}

function uriOf(row: ResourceRow): string {
  return row.kind === 'static' ? row.resource.uri : row.resource.uriTemplate
}

watch(
  () => allRows.value.map((r) => r.key).join('|'),
  () => {
    if (!allRows.value.some((r) => r.key === selectedKey.value)) {
      selectedKey.value = allRows.value[0]?.key ?? null
    }
  },
  { immediate: true },
)
</script>

<template>
  <div v-if="allRows.length === 0" class="px-6 py-14 text-center">
    <div class="text-[13px] text-fg-muted">Keine Resources oder Templates gemeldet.</div>
  </div>

  <div
    v-else
    class="grid grid-cols-1 md:grid-cols-[minmax(320px,420px)_1fr] divide-y md:divide-y-0 md:divide-x divide-border min-h-[520px]"
  >
    <!-- List -->
    <div class="flex flex-col min-h-0">
      <div class="px-3.5 py-3 border-b border-border">
        <div class="relative">
          <Search
            :size="13"
            class="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-muted pointer-events-none"
          />
          <input
            v-model="query"
            type="search"
            :placeholder="`${allRows.length} Resources durchsuchen …`"
            spellcheck="false"
            autocomplete="off"
            class="focus-ring w-full h-9 pl-8 pr-8 bg-surface-2 border border-border rounded-md text-[12.5px] text-fg placeholder:text-fg-muted focus:bg-surface focus:border-accent focus:outline-none transition-colors"
            aria-label="Resources durchsuchen"
          />
          <button
            v-if="query"
            type="button"
            class="focus-ring absolute right-1.5 top-1/2 -translate-y-1/2 p-1 text-fg-muted hover:text-fg rounded"
            aria-label="Suche leeren"
            @click="clearQuery"
          >
            <X :size="12" />
          </button>
        </div>
      </div>

      <ul
        v-if="filtered.length > 0"
        class="flex-1 min-h-0 overflow-y-auto"
        role="listbox"
        aria-label="Resource-Liste"
      >
        <li v-for="row in filtered" :key="row.key">
          <button
            type="button"
            role="option"
            :aria-selected="selectedRow?.key === row.key"
            class="focus-ring w-full text-left px-4 py-2.5 border-b border-border flex items-start gap-2.5 hover:bg-surface-2 transition-colors data-[selected=true]:bg-cat-resource-soft/60 data-[selected=true]:border-cat-resource/25"
            :data-selected="selectedRow?.key === row.key ? 'true' : 'false'"
            @click="selectRow(row)"
          >
            <component
              :is="row.kind === 'template' ? Link2 : FileText"
              :size="13"
              :stroke-width="1.75"
              class="shrink-0 mt-0.5"
              :class="[
                row.kind === 'template'
                  ? 'text-warning'
                  : (selectedRow?.key === row.key ? 'text-cat-resource' : 'text-fg-muted'),
              ]"
            />
            <div class="flex-1 min-w-0">
              <div class="font-mono text-[12px] text-fg truncate">
                {{ uriOf(row) }}
              </div>
              <div
                v-if="row.resource.title || row.resource.name"
                class="mt-0.5 text-[11.5px] text-fg-muted truncate"
              >
                {{ row.resource.title ?? row.resource.name }}
              </div>
            </div>
            <span
              v-if="row.kind === 'template'"
              class="shrink-0 font-mono text-[9.5px] text-warning bg-warning-soft border border-warning/30 rounded px-1 py-0.5 mt-1"
              title="URI-Template mit Platzhaltern"
            >
              tpl
            </span>
          </button>
        </li>
      </ul>

      <div v-else class="flex-1 px-6 py-10 text-center">
        <div class="text-[12.5px] text-fg-muted">
          Keine Treffer für <span class="font-mono text-fg">"{{ query }}"</span>
        </div>
      </div>
    </div>

    <!-- Detail — keyed by row.key so state resets per resource -->
    <ResourceDetail
      v-if="selectedRow"
      :key="selectedRow.key"
      :target="selectedRow"
      :history="history"
      :is-connected="isConnected"
      :read-resource="readResource"
      class="overflow-y-auto"
    />
  </div>
</template>
