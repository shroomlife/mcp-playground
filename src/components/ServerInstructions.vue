<script setup lang="ts">
import { ref, computed } from 'vue'
import { Lightbulb, ChevronDown, X } from 'lucide-vue-next'

const props = defineProps<{
  instructions: string
}>()

const LINE_THRESHOLD = 4
const dismissed = ref(false)
const expanded = ref(false)

const lineCount = computed(() => props.instructions.split('\n').length)
const isLong = computed(() => lineCount.value > LINE_THRESHOLD || props.instructions.length > 320)
</script>

<template>
  <aside
    v-if="!dismissed"
    class="fade-in rounded-xl border border-accent/20 bg-accent-soft/60 overflow-hidden"
    aria-labelledby="server-instructions-title"
  >
    <div class="flex items-start gap-3 p-4 md:p-5">
      <div class="mt-0.5 p-1.5 rounded-md bg-accent/10 text-accent shrink-0" aria-hidden="true">
        <Lightbulb :size="15" :stroke-width="2" />
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-baseline justify-between gap-3">
          <h2
            id="server-instructions-title"
            class="text-[12.5px] font-semibold uppercase tracking-wide text-accent"
          >
            Hinweise vom Server
          </h2>
          <button
            type="button"
            class="focus-ring shrink-0 -mr-1 -mt-1 p-1 text-fg-muted hover:text-fg rounded"
            aria-label="Hinweise ausblenden"
            @click="dismissed = true"
          >
            <X :size="13" />
          </button>
        </div>
        <p
          class="mt-1.5 text-[13.5px] leading-[1.55] text-fg-2 whitespace-pre-line max-w-3xl"
          :class="!expanded && isLong ? 'line-clamp-4' : ''"
        >
          {{ instructions }}
        </p>
        <button
          v-if="isLong"
          type="button"
          class="focus-ring mt-2 inline-flex items-center gap-1 text-[12px] text-accent hover:underline"
          @click="expanded = !expanded"
        >
          {{ expanded ? 'weniger' : 'alles lesen' }}
          <ChevronDown
            :size="12"
            class="transition-transform"
            :class="expanded ? 'rotate-180' : ''"
          />
        </button>
      </div>
    </div>
  </aside>
</template>
