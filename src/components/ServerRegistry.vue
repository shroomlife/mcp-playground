<script setup lang="ts">
import { computed, ref } from 'vue'
import { Globe, Search, Lock, Unlock, KeyRound, ArrowRight, ExternalLink } from 'lucide-vue-next'
import {
  PUBLIC_SERVERS,
  CATEGORY_LABELS,
  type PublicServer,
  type AuthKind,
} from '~/data/public-servers'
import type { TransportKind } from '~/composables/useMcpPlayground'

defineEmits<{
  select: [url: string, transport: TransportKind]
}>()

const query = ref('')
const authFilter = ref<'all' | AuthKind>('all')

const normalized = computed(() => query.value.trim().toLowerCase())

const filtered = computed<PublicServer[]>(() => {
  const q = normalized.value
  return PUBLIC_SERVERS.filter((s) => {
    if (authFilter.value !== 'all' && s.auth !== authFilter.value) return false
    if (!q) return true
    return (
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.url.toLowerCase().includes(q) ||
      s.category.toLowerCase().includes(q)
    )
  })
})

const noneCount = computed(() => PUBLIC_SERVERS.filter((s) => s.auth === 'none').length)
const oauthCount = computed(() => PUBLIC_SERVERS.filter((s) => s.auth === 'oauth').length)

function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

function initial(name: string): string {
  return name.charAt(0).toUpperCase()
}
</script>

<template>
  <section
    class="mt-8 bg-surface/80 backdrop-blur-sm border border-border rounded-xl p-5"
  >
    <div class="flex items-start justify-between gap-4 mb-4">
      <div>
        <h3 class="text-[13px] uppercase tracking-wide font-semibold text-fg-muted flex items-center gap-1.5">
          <Globe :size="13" />
          Öffentliche MCP-Server
        </h3>
        <p class="mt-1 text-[12px] text-fg-2">
          Kuratierte Liste — Ein-Klick-Verbindung. Kein Setup, kein Account (sofern ohne Auth).
        </p>
      </div>
    </div>

    <div class="flex flex-col sm:flex-row gap-2 mb-3">
      <div class="relative flex-1">
        <Search :size="12" class="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-muted" />
        <input
          v-model="query"
          type="search"
          placeholder="Filter: Name, URL, Beschreibung …"
          spellcheck="false"
          autocomplete="off"
          aria-label="Server-Katalog durchsuchen"
          class="focus-ring w-full h-8 pl-7 pr-2.5 bg-surface border border-border rounded-md text-[12px] text-fg placeholder:text-fg-muted focus:border-accent focus:outline-none"
        />
      </div>
      <div
        role="tablist"
        aria-label="Auth-Filter"
        class="flex items-center p-0.5 bg-surface-2 border border-border rounded-md gap-0.5"
      >
        <button
          type="button"
          role="tab"
          :aria-selected="authFilter === 'all'"
          class="focus-ring px-2.5 h-7 text-[11.5px] rounded transition-colors"
          :class="authFilter === 'all' ? 'bg-surface text-fg font-medium shadow-sm' : 'text-fg-muted hover:text-fg'"
          @click="authFilter = 'all'"
        >
          Alle
          <span class="ml-1 font-mono text-[10px] text-fg-subtle">{{ PUBLIC_SERVERS.length }}</span>
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="authFilter === 'none'"
          class="focus-ring inline-flex items-center gap-1 px-2.5 h-7 text-[11.5px] rounded transition-colors"
          :class="authFilter === 'none' ? 'bg-surface text-fg font-medium shadow-sm' : 'text-fg-muted hover:text-fg'"
          @click="authFilter = 'none'"
        >
          <Unlock :size="10" />
          Offen
          <span class="ml-0.5 font-mono text-[10px] text-fg-subtle">{{ noneCount }}</span>
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="authFilter === 'oauth'"
          class="focus-ring inline-flex items-center gap-1 px-2.5 h-7 text-[11.5px] rounded transition-colors"
          :class="authFilter === 'oauth' ? 'bg-surface text-fg font-medium shadow-sm' : 'text-fg-muted hover:text-fg'"
          @click="authFilter = 'oauth'"
        >
          <Lock :size="10" />
          OAuth
          <span class="ml-0.5 font-mono text-[10px] text-fg-subtle">{{ oauthCount }}</span>
        </button>
      </div>
    </div>

    <ul
      v-if="filtered.length > 0"
      class="grid grid-cols-1 sm:grid-cols-2 gap-2"
    >
      <li
        v-for="s in filtered"
        :key="s.id"
        class="group relative flex flex-col bg-surface border border-border rounded-lg overflow-hidden hover:border-accent/40 transition-colors"
      >
        <button
          type="button"
          class="focus-ring flex-1 text-left p-3 flex flex-col gap-1.5"
          :aria-label="`${s.name} verbinden`"
          @click="$emit('select', s.url, s.transport)"
        >
          <div class="flex items-start gap-2.5">
            <span
              aria-hidden="true"
              class="shrink-0 size-7 rounded-md bg-accent-soft text-accent font-semibold text-[12px] flex items-center justify-center"
            >
              {{ initial(s.name) }}
            </span>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-1.5">
                <span class="text-[13px] font-medium text-fg truncate">{{ s.name }}</span>
                <span
                  v-if="s.auth === 'oauth'"
                  class="inline-flex items-center gap-0.5 shrink-0 px-1.5 py-0.5 rounded font-mono text-[9.5px] uppercase tracking-wide bg-warning/15 text-warning"
                  title="OAuth-Login erforderlich"
                >
                  <Lock :size="8" />
                  OAuth
                </span>
                <span
                  v-else-if="s.auth === 'api-key'"
                  class="inline-flex items-center gap-0.5 shrink-0 px-1.5 py-0.5 rounded font-mono text-[9.5px] uppercase tracking-wide bg-fg-subtle/20 text-fg-muted"
                >
                  <KeyRound :size="8" />
                  API-Key
                </span>
                <span
                  v-else
                  class="inline-flex items-center gap-0.5 shrink-0 px-1.5 py-0.5 rounded font-mono text-[9.5px] uppercase tracking-wide bg-success/15 text-success"
                >
                  <Unlock :size="8" />
                  Offen
                </span>
              </div>
              <div class="font-mono text-[10.5px] text-fg-muted truncate mt-0.5">
                {{ hostOf(s.url) }}
              </div>
            </div>
            <span
              class="shrink-0 inline-flex items-center gap-0.5 font-mono text-[9.5px] uppercase tracking-wide text-fg-subtle"
              :title="`Transport: ${s.transport}`"
            >
              {{ s.transport }}
            </span>
          </div>
          <p class="text-[11.5px] text-fg-2 leading-snug line-clamp-2">
            {{ s.description }}
          </p>
          <div class="mt-auto pt-1 flex items-center gap-2">
            <span class="font-mono text-[10px] uppercase tracking-wide text-fg-subtle">
              {{ CATEGORY_LABELS[s.category] }}
            </span>
            <span class="ml-auto inline-flex items-center gap-1 text-[11px] text-accent opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
              Verbinden
              <ArrowRight :size="10" />
            </span>
          </div>
        </button>
        <a
          v-if="s.docsUrl"
          :href="s.docsUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="focus-ring absolute top-2 right-2 p-1 rounded text-fg-muted hover:text-accent hover:bg-accent-soft opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
          :aria-label="`${s.name} Dokumentation öffnen`"
          :title="`${s.name} Docs`"
          @click.stop
        >
          <ExternalLink :size="11" />
        </a>
      </li>
    </ul>

    <div
      v-else
      class="px-4 py-6 text-center text-[12px] text-fg-muted"
    >
      Kein Server matcht deinen Filter.
    </div>

    <p class="mt-3 text-[11px] text-fg-muted">
      Mehr:
      <a
        href="https://github.com/jaw9c/awesome-remote-mcp-servers"
        target="_blank"
        rel="noopener noreferrer"
        class="focus-ring text-accent hover:underline"
      >awesome-remote-mcp-servers ↗</a>
      ·
      <a
        href="https://github.com/modelcontextprotocol/servers"
        target="_blank"
        rel="noopener noreferrer"
        class="focus-ring text-accent hover:underline"
      >modelcontextprotocol/servers ↗</a>
    </p>
  </section>
</template>
