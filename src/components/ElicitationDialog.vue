<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  DialogRoot,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from 'reka-ui'
import { HelpCircle, ExternalLink, X, Check, Ban } from 'lucide-vue-next'
import SchemaForm from './SchemaForm.vue'
import { analyzeSchema, validateArgs } from '~/lib/schemaFormHelpers'
import type { ValidationError } from '~/lib/schemaFormHelpers'
import { useElicitation, resolveElicitation } from '~/composables/useElicitation'

const { pending } = useElicitation()

const formArgs = ref<Record<string, unknown>>({})
const validationErrors = ref<ValidationError[]>([])
const jsonAllValid = ref(true)

const isOpen = computed(() => pending.value !== null)

const mode = computed<'form' | 'url'>(() => {
  const p = pending.value?.params
  if (p?.mode === 'url' || (p?.url && !p.requestedSchema)) return 'url'
  return 'form'
})

const analysis = computed(() => {
  const schema = pending.value?.params.requestedSchema
  return schema ? analyzeSchema(schema) : null
})

watch(pending, (p) => {
  // Reset form state when a new elicitation arrives.
  if (!p) return
  formArgs.value = {}
  validationErrors.value = []
  jsonAllValid.value = true
})

function onOpenChange(open: boolean) {
  if (!open && pending.value) {
    resolveElicitation({ action: 'cancel' })
  }
}

function accept() {
  const a = analysis.value
  if (a) {
    const errors = validateArgs(a, formArgs.value)
    validationErrors.value = errors
    if (errors.length > 0 || !jsonAllValid.value) return
  }
  resolveElicitation({
    action: 'accept',
    content: Object.keys(formArgs.value).length > 0 ? formArgs.value : undefined,
  })
}

function decline() {
  resolveElicitation({ action: 'decline' })
}

function openUrl() {
  const url = pending.value?.params.url
  if (!url) return
  window.open(url, '_blank', 'noopener,noreferrer')
  // User has opened the provider — server will be notified out-of-band. We treat the
  // click as "accepted" so the SDK's request promise resolves. If the server actually
  // needs the client to wait (rare per spec), users can simply leave the dialog open.
  resolveElicitation({ action: 'accept' })
}
</script>

<template>
  <DialogRoot :open="isOpen" @update:open="onOpenChange">
    <DialogPortal>
      <DialogOverlay
        class="fixed inset-0 z-40 bg-fg/25 backdrop-blur-sm"
      />
      <DialogContent
        class="fixed left-1/2 top-1/2 z-50 w-[min(560px,calc(100vw-2rem))] max-h-[calc(100vh-4rem)] -translate-x-1/2 -translate-y-1/2 bg-surface border border-border rounded-xl shadow-2xl overflow-hidden focus:outline-none flex flex-col"
      >
        <div class="flex items-start justify-between gap-3 p-5 border-b border-border">
          <div class="flex items-start gap-2.5 min-w-0 flex-1">
            <div class="shrink-0 mt-0.5 p-1.5 bg-accent/10 text-accent rounded-md">
              <HelpCircle :size="14" :stroke-width="2" />
            </div>
            <div class="min-w-0">
              <DialogTitle class="text-[14px] font-semibold text-fg">
                Der Server braucht Input von dir
              </DialogTitle>
              <DialogDescription class="text-[12px] text-fg-muted mt-0.5">
                Elicitation-Request vom MCP-Server — Antwort wird zurückgeschickt.
              </DialogDescription>
            </div>
          </div>
          <button
            type="button"
            class="focus-ring shrink-0 p-1 text-fg-muted hover:text-fg rounded-md"
            aria-label="Abbrechen"
            @click="onOpenChange(false)"
          >
            <X :size="16" />
          </button>
        </div>

        <div v-if="pending" class="p-5 space-y-4 overflow-y-auto">
          <p class="text-[13px] text-fg-2 leading-[1.55] whitespace-pre-line">
            {{ pending.params.message }}
          </p>

          <!-- URL mode: open-at-provider button -->
          <div
            v-if="mode === 'url' && pending.params.url"
            class="p-3 bg-surface-2 border border-border rounded-md"
          >
            <div class="flex items-center gap-2 text-[11.5px] text-fg-muted mb-2">
              <ExternalLink :size="12" />
              <span>Der Server bittet dich, diese URL zu öffnen:</span>
            </div>
            <div class="font-mono text-[12px] text-fg-2 break-all mb-3 p-2 bg-surface border border-border rounded">
              {{ pending.params.url }}
            </div>
            <button
              type="button"
              class="focus-ring inline-flex items-center gap-1.5 h-9 px-3 bg-accent text-white rounded-md text-[12.5px] font-medium hover:brightness-110 transition-all"
              @click="openUrl"
            >
              <ExternalLink :size="13" />
              Im neuen Tab öffnen
            </button>
          </div>

          <!-- Form mode: render the requested schema -->
          <div v-else-if="analysis">
            <SchemaForm
              v-model="formArgs"
              :fields="analysis.fields"
              :errors="validationErrors"
              @json-valid-change="(v) => (jsonAllValid = v)"
            />
          </div>
        </div>

        <!-- Footer actions for form mode -->
        <div
          v-if="pending && mode === 'form'"
          class="flex items-center justify-between gap-2 p-4 bg-surface-2/40 border-t border-border"
        >
          <button
            type="button"
            class="focus-ring inline-flex items-center gap-1.5 h-9 px-3 bg-surface border border-border-strong rounded-md text-[12.5px] text-fg-2 hover:text-fg hover:border-fg/30 transition-colors"
            @click="decline"
          >
            <Ban :size="13" />
            Ablehnen
          </button>
          <button
            type="button"
            :disabled="!jsonAllValid"
            class="focus-ring inline-flex items-center gap-1.5 h-9 px-4 bg-accent text-white rounded-md text-[12.5px] font-medium hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            @click="accept"
          >
            <Check :size="13" />
            Senden
          </button>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
