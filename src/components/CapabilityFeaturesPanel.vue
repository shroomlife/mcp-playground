<script setup lang="ts">
import { computed } from 'vue'
import { Check, Copy, Info } from 'lucide-vue-next'
import { capabilityInfo, describeCapability } from '~/lib/capabilityCopy'

const props = defineProps<{
  /** Capability key (`experimental`, `extensions`, …). */
  capabilityKey: string
  /** Raw capability entry as the server sent it in the handshake. */
  entry: unknown
}>()

const info = computed(() => capabilityInfo(props.capabilityKey))
const features = computed(() => describeCapability(props.capabilityKey, props.entry, info.value))

function prettyJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

const rawJson = computed(() => prettyJson(props.entry))
</script>

<template>
  <div class="p-6 md:p-8 space-y-5">
    <div class="flex items-start gap-3">
      <Info :size="16" class="text-accent shrink-0 mt-0.5" />
      <div class="flex-1 min-w-0">
        <h2 class="text-[15px] font-semibold text-fg">{{ info.title }}</h2>
        <p class="text-[13px] text-fg-2 leading-[1.55] mt-1 max-w-[640px]">
          {{ info.description }}
        </p>
      </div>
    </div>

    <!-- Feature-Liste: jedes deklarierte Feature als Card -->
    <div v-if="features.length > 0" class="space-y-2">
      <div class="text-[11px] uppercase tracking-wide text-fg-muted font-medium">
        Vom Server deklariert · {{ features.length }}
      </div>
      <ul class="space-y-2">
        <li
          v-for="feature in features"
          :key="feature.key"
          class="flex items-start gap-3 p-3 bg-surface-2/40 border border-border rounded-lg"
        >
          <Check :size="14" class="text-success shrink-0 mt-0.5" />
          <div class="flex-1 min-w-0 space-y-1">
            <div class="font-mono text-[13px] text-fg break-all">
              {{ feature.label }}
            </div>
            <div
              v-if="feature.hint"
              class="font-mono text-[11.5px] text-fg-muted break-all"
            >
              {{ feature.hint }}
            </div>
          </div>
        </li>
      </ul>
    </div>

    <!-- Empty-State: Capability deklariert, aber keine Keys -->
    <div
      v-else
      class="flex items-start gap-3 p-4 bg-surface-2/40 border border-border rounded-lg"
    >
      <Info :size="14" class="text-fg-muted shrink-0 mt-0.5" />
      <div class="text-[12.5px] text-fg-2 leading-[1.55]">
        <div class="font-medium text-fg">Keine Features eingetragen</div>
        <p class="text-fg-muted mt-0.5">
          Der Server hat die <code class="font-mono">{{ capabilityKey }}</code>-Capability
          deklariert, aber keine Feature-Keys registriert.
        </p>
      </div>
    </div>

    <!-- Raw Capability-Entry als JSON für Debug -->
    <details class="group">
      <summary
        class="focus-ring cursor-pointer inline-flex items-center gap-1.5 text-[11.5px] text-fg-muted hover:text-fg-2 select-none"
      >
        <Copy :size="11" />
        Raw Capability-Entry anzeigen
      </summary>
      <pre
        class="mt-2 font-mono text-[11.5px] leading-[1.55] whitespace-pre-wrap break-all text-fg-2 bg-surface border border-border rounded-md px-3 py-2.5 max-h-[320px] overflow-y-auto"
      >{{ rawJson }}</pre>
    </details>
  </div>
</template>
