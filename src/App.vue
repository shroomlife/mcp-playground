<script setup lang="ts">
import { computed } from 'vue'
import { AlertCircle, Loader2 } from 'lucide-vue-next'
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

const isLanding = computed(() => state.value !== 'connected')

function handleConnect(nextUrl: string, transport: TransportKind) {
  void connect(nextUrl, transport)
}
</script>

<template>
  <div class="relative min-h-screen">
    <!-- Gradient background — full-screen on landing, thin band when connected -->
    <div
      aria-hidden="true"
      class="pointer-events-none fixed inset-0 transition-opacity duration-500"
      :class="isLanding ? 'opacity-100' : 'opacity-40'"
    >
      <div class="absolute inset-0 bg-bg" />
      <div
        class="absolute inset-0"
        style="
          background-image:
            radial-gradient(60% 55% at 18% 22%, rgba(186, 210, 255, 0.55) 0%, transparent 60%),
            radial-gradient(55% 50% at 82% 28%, rgba(255, 214, 196, 0.5) 0%, transparent 62%),
            radial-gradient(65% 55% at 50% 88%, rgba(203, 237, 214, 0.55) 0%, transparent 60%),
            radial-gradient(40% 35% at 90% 85%, rgba(232, 210, 255, 0.45) 0%, transparent 60%);
        "
      />
      <!-- Subtle grain overlay via SVG noise for texture -->
      <div
        class="absolute inset-0 opacity-[0.035] mix-blend-multiply"
        style="
          background-image: url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22160%22 height=%22160%22><filter id=%22n%22><feTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22 numOctaves=%222%22 stitchTiles=%22stitch%22/></filter><rect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22 opacity=%220.6%22/></svg>');
        "
      />
    </div>

    <!-- Top bar — always visible, minimal -->
    <header
      class="relative z-10 flex items-center justify-between px-6 md:px-10 py-5"
    >
      <div class="flex items-center gap-2.5">
        <div class="size-2 rounded-full bg-accent" />
        <span class="text-[13px] font-medium text-fg">MCP Inspector</span>
      </div>
      <div class="flex items-center gap-2 text-[12px] text-fg-muted">
        <span
          class="size-1.5 rounded-full"
          :class="{
            'bg-fg-subtle': state === 'idle',
            'bg-warning pulse-dot': state === 'connecting',
            'bg-success pulse-dot': state === 'connected',
            'bg-danger pulse-dot': state === 'error',
          }"
        />
        <span class="font-mono">
          {{
            state === 'idle' ? 'bereit'
            : state === 'connecting' ? 'verbindet'
            : state === 'connected' ? 'verbunden'
            : 'fehler'
          }}
        </span>
      </div>
    </header>

    <!-- Landing: centered form -->
    <main
      v-if="isLanding"
      class="relative z-10 min-h-[calc(100vh-5rem)] flex items-center justify-center px-6 pb-12"
    >
      <div class="w-full max-w-[640px]">
        <div class="text-center mb-8">
          <h1 class="text-[34px] md:text-[40px] font-semibold tracking-tight text-fg leading-[1.1]">
            Einen MCP-Server inspizieren
          </h1>
          <p class="text-[14px] text-fg-2 mt-3 max-w-[460px] mx-auto">
            Ein kleines Werkzeug für das Model Context Protocol. URL eintragen, verbinden,
            Tools &amp; Resources anschauen.
          </p>
        </div>

        <div class="bg-surface/90 backdrop-blur-sm border border-border rounded-xl p-5 shadow-[0_8px_40px_-20px_rgba(0,0,0,0.12)]">
          <ConnectionForm
            :state="state"
            :initial-url="url"
            @connect="handleConnect"
            @disconnect="() => { void disconnect() }"
          />
        </div>

        <!-- Connecting indicator -->
        <div
          v-if="state === 'connecting'"
          class="mt-5 flex items-center justify-center gap-2 text-[13px] text-fg-muted"
        >
          <Loader2 :size="14" class="animate-spin" />
          <span>Handshake läuft — Capabilities werden abgefragt …</span>
        </div>

        <!-- Error panel -->
        <Transition name="fade">
          <div
            v-if="state === 'error' && error"
            class="mt-5 bg-danger-soft border border-danger/30 rounded-lg p-4 flex items-start gap-3"
          >
            <AlertCircle
              :size="16"
              :stroke-width="2"
              class="text-danger shrink-0 mt-0.5"
            />
            <div class="min-w-0 flex-1">
              <div class="text-[12.5px] font-medium text-danger">
                Verbindung fehlgeschlagen
              </div>
              <p class="text-[13px] text-fg-2 mt-1 break-words">{{ error }}</p>
              <p class="text-[12px] text-fg-muted mt-2">
                Prüfe URL und Transport (HTTP/SSE). Der Dev-Proxy leitet Requests
                serverseitig weiter und umgeht CORS.
              </p>
            </div>
          </div>
        </Transition>

        <div class="mt-8 text-center text-[11.5px] text-fg-muted">
          Tailwind v4 · Vue 3.5 · Reka UI · MCP SDK
        </div>
      </div>
    </main>

    <!-- Connected app view -->
    <main
      v-else
      class="relative z-10 max-w-[1120px] mx-auto px-6 md:px-10 pb-20"
    >
      <div class="space-y-8">
        <ServerCard
          :server="server"
          :capabilities="capabilityList"
          :latency-ms="latencyMs"
          :connected-at="connectedAt"
          :counts="counts"
        />

        <InspectorPanels
          :tools="tools"
          :resources="resources"
          :resource-templates="resourceTemplates"
          :prompts="prompts"
          :log="log"
        />

        <div class="pt-4 text-center">
          <button
            type="button"
            @click="() => { void disconnect() }"
            class="focus-ring text-[12.5px] text-fg-muted hover:text-fg underline underline-offset-4"
          >
            Zurück zum Start
          </button>
        </div>
      </div>
    </main>
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
