<script setup lang="ts">
import { computed } from 'vue'
import { AlertOctagon } from 'lucide-vue-next'
import { useMcpInspector } from '~/composables/useMcpInspector'
import ConnectionForm from '~/components/ConnectionForm.vue'
import ServerCard from '~/components/ServerCard.vue'
import InspectorPanels from '~/components/InspectorPanels.vue'
import type { TransportKind } from '~/composables/useMcpInspector'

const {
  state,
  error,
  url,
  latencyMs,
  connectedAt,
  server,
  tools,
  resources,
  resourceTemplates,
  prompts,
  log,
  capabilityList,
  counts,
  connect,
  disconnect,
} = useMcpInspector()

const today = new Date().toLocaleDateString('de-DE', {
  weekday: 'long',
  day: '2-digit',
  month: 'long',
  year: 'numeric',
})

const issueNumber = computed(() => {
  const d = new Date()
  const start = new Date(d.getFullYear(), 0, 0)
  const diff = (d.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
  return `No. ${String(Math.floor(diff)).padStart(3, '0')}`
})

function handleConnect(nextUrl: string, transport: TransportKind) {
  void connect(nextUrl, transport)
}
</script>

<template>
  <div class="relative min-h-screen">
    <div class="relative z-10 max-w-[1180px] mx-auto px-6 md:px-10 lg:px-14 py-8 md:py-12">
      <!-- Masthead strip -->
      <header class="flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-muted border-b border-rule pb-3 mb-8">
        <div class="flex items-center gap-4">
          <span class="font-mono">MCP · Inspector</span>
          <span class="hidden md:inline ascii-rule w-8" />
          <span class="hidden md:inline">{{ today }}</span>
        </div>
        <div class="flex items-center gap-4">
          <span class="hidden md:inline">{{ issueNumber }}</span>
          <span class="hidden md:inline ascii-rule w-8" />
          <span class="flex items-center gap-1.5">
            <span
              class="size-1.5 rounded-full"
              :class="{
                'bg-muted/60': state === 'idle',
                'bg-ochre pulse-dot': state === 'connecting',
                'bg-moss pulse-dot': state === 'connected',
                'bg-rust pulse-dot': state === 'error',
              }"
            />
            {{ state }}
          </span>
        </div>
      </header>

      <!-- Huge masthead title -->
      <section class="mb-12 md:mb-16">
        <div class="flex items-end justify-between gap-6 flex-wrap">
          <h1
            class="font-display text-[clamp(64px,11vw,156px)] leading-[0.88] tracking-[-0.02em] text-ink"
          >
            the <span class="italic">inspector</span>
          </h1>
          <div
            class="font-mono text-[10px] uppercase tracking-[0.2em] text-muted border-l border-hairline pl-4 max-w-[220px]"
          >
            A field instrument for <span class="text-ink">Model · Context · Protocol</span>
            servers — conjuring tools, resources &amp; prompts from any endpoint within reach.
          </div>
        </div>
        <div class="marquee-border h-[3px] mt-8" />
      </section>

      <!-- Connection form -->
      <div class="mb-10">
        <ConnectionForm
          :state="state"
          :initial-url="url"
          @connect="handleConnect"
          @disconnect="() => { void disconnect() }"
        />
      </div>

      <!-- Error panel -->
      <Transition name="fade">
        <div
          v-if="state === 'error' && error"
          class="mb-10 anim-in border border-rust bg-rust/5 rounded-sm p-5 flex items-start gap-4"
        >
          <AlertOctagon :size="18" :stroke-width="1.5" class="text-rust shrink-0 mt-0.5" />
          <div class="min-w-0">
            <div class="font-mono text-[10px] uppercase tracking-[0.18em] text-rust mb-1">
              handshake failed
            </div>
            <p class="font-display italic text-[18px] text-ink-2 leading-[1.35] break-words">
              {{ error }}
            </p>
            <div class="mt-3 font-mono text-[11px] text-muted">
              <span class="text-ink">hint · </span>
              prüfe URL, Transport (HTTP/SSE), und ob der Server erreichbar ist. Der
              Dev-Proxy leitet Requests serverseitig weiter, umgeht also CORS.
            </div>
          </div>
        </div>
      </Transition>

      <!-- Connecting placeholder -->
      <div
        v-if="state === 'connecting'"
        class="mb-10 anim-in border border-hairline rounded-sm p-10 text-center bg-white/40"
      >
        <div class="font-display italic text-[28px] text-ink-2">
          lauschen<span class="caret">…</span>
        </div>
        <div class="font-mono text-[10px] uppercase tracking-[0.2em] text-muted mt-2">
          initialize · capabilities · list
        </div>
      </div>

      <!-- Connected: server + panels -->
      <template v-if="state === 'connected' && server">
        <div class="mb-10">
          <ServerCard
            :server="server"
            :capabilities="capabilityList"
            :latency-ms="latencyMs"
            :connected-at="connectedAt"
            :counts="counts"
          />
        </div>

        <div class="mb-16">
          <InspectorPanels
            :tools="tools"
            :resources="resources"
            :resource-templates="resourceTemplates"
            :prompts="prompts"
            :log="log"
          />
        </div>
      </template>

      <!-- Idle hero explainer -->
      <section
        v-if="state === 'idle' && !server"
        class="mt-16 grid md:grid-cols-3 gap-10 md:gap-14 anim-in"
      >
        <div class="md:col-span-2">
          <div class="font-mono text-[10px] uppercase tracking-[0.2em] text-muted mb-3">
            Feature · 01
          </div>
          <p class="font-display text-[22px] leading-[1.35] text-ink-2 max-w-2xl">
            Tragen Sie oben eine MCP-Endpoint-URL ein. Der Inspector öffnet eine
            Streamable-HTTP- oder SSE-Session, dokumentiert <em>Tools</em>,
            <em>Resources</em> und <em>Prompts</em>, und zeichnet jedes Signal
            im Bordbuch auf.
          </p>
        </div>
        <aside class="border-l border-hairline pl-6">
          <div class="font-mono text-[10px] uppercase tracking-[0.2em] text-muted mb-3">
            Appendix
          </div>
          <ul class="space-y-2.5 font-mono text-[11.5px] text-ink-2">
            <li class="flex gap-2"><span class="text-rust">→</span> Tailwind v4</li>
            <li class="flex gap-2"><span class="text-rust">→</span> Reka UI primitives</li>
            <li class="flex gap-2"><span class="text-rust">→</span> MCP SDK 1.x</li>
            <li class="flex gap-2"><span class="text-rust">→</span> Bun + Vite 6</li>
            <li class="flex gap-2"><span class="text-rust">→</span> CORS-sicher via Proxy</li>
          </ul>
        </aside>
      </section>

      <!-- Footer -->
      <footer class="mt-24 pt-6 border-t border-rule flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-muted font-mono">
        <span>© shroomlife · mycological field studies</span>
        <span class="flex items-center gap-2">
          <span>printed locally</span>
          <span class="size-1 rounded-full bg-rust" />
        </span>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 180ms ease, transform 180ms ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(4px);
}
</style>
