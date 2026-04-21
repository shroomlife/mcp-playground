<script setup lang="ts">
import { Eye, EyeOff, Plus, X } from 'lucide-vue-next'
import type { AuthHeader } from '~/composables/useMcpPlayground'

defineProps<{
  bearerToken: string
  /** Custom-Header ohne Authorization, mit Original-Index im Parent-Array. */
  headers: Array<{ header: AuthHeader; index: number }>
  /** Zahl aller gesetzten Header (inkl. Authorization). */
  activeCount: number
  disabled?: boolean
  showBearer: boolean
  visibleValueIndexes: Set<number>
}>()

const emit = defineEmits<{
  'update:bearer': [token: string]
  'update:show-bearer': [show: boolean]
  'toggle-value-visibility': [index: number]
  'update-key': [index: number, key: string]
  'update-value': [index: number, value: string]
  'remove-header': [index: number]
  'add-header': []
  clear: []
}>()
</script>

<template>
  <!-- Bearer shortcut -->
  <div>
    <label
      for="auth-bearer"
      class="block text-[12px] font-medium text-fg-2 mb-1.5"
    >
      Bearer-Token
      <span class="text-fg-muted font-normal">
        — wird als
        <code class="font-mono text-fg-2">Authorization: Bearer …</code> gesendet
      </span>
    </label>
    <div class="flex items-stretch gap-2">
      <div class="flex-1 relative">
        <input
          id="auth-bearer"
          :value="bearerToken"
          :type="showBearer ? 'text' : 'password'"
          autocomplete="off"
          spellcheck="false"
          :disabled="disabled"
          placeholder="eyJhbGciOiJI…"
          class="focus-ring w-full h-10 pl-3 pr-10 bg-surface border border-border-strong rounded-md font-mono text-[12.5px] text-fg placeholder:text-fg-subtle focus:border-accent focus:outline-none disabled:bg-surface-2 disabled:text-fg-muted"
          @input="emit('update:bearer', ($event.target as HTMLInputElement).value)"
        />
        <button
          type="button"
          :aria-label="showBearer ? 'Token verbergen' : 'Token anzeigen'"
          class="focus-ring absolute right-2 top-1/2 -translate-y-1/2 p-1 text-fg-muted hover:text-fg rounded"
          @click="emit('update:show-bearer', !showBearer)"
        >
          <EyeOff v-if="showBearer" :size="14" />
          <Eye v-else :size="14" />
        </button>
      </div>
    </div>
  </div>

  <!-- Custom headers -->
  <div>
    <div class="flex items-center justify-between mb-1.5">
      <label class="text-[12px] font-medium text-fg-2">
        Weitere Headers
      </label>
      <button
        v-if="activeCount > 0"
        type="button"
        :disabled="disabled"
        class="focus-ring text-[11.5px] text-fg-muted hover:text-danger underline underline-offset-2 disabled:opacity-40 disabled:cursor-not-allowed"
        @click="emit('clear')"
      >
        alles löschen
      </button>
    </div>
    <div class="space-y-2">
      <div
        v-for="{ header, index } in headers"
        :key="index"
        class="flex items-stretch gap-2"
      >
        <input
          :value="header.key"
          type="text"
          spellcheck="false"
          autocomplete="off"
          placeholder="X-Api-Key"
          :disabled="disabled"
          class="focus-ring w-36 shrink-0 h-10 px-2.5 bg-surface border border-border-strong rounded-md font-mono text-[12px] text-fg placeholder:text-fg-subtle focus:border-accent focus:outline-none disabled:bg-surface-2"
          :aria-label="`Header ${index + 1} Name`"
          @input="emit('update-key', index, ($event.target as HTMLInputElement).value)"
        />
        <div class="flex-1 relative">
          <input
            :value="header.value"
            :type="visibleValueIndexes.has(index) ? 'text' : 'password'"
            spellcheck="false"
            autocomplete="off"
            placeholder="Wert"
            :disabled="disabled"
            class="focus-ring w-full h-10 pl-2.5 pr-10 bg-surface border border-border-strong rounded-md font-mono text-[12px] text-fg placeholder:text-fg-subtle focus:border-accent focus:outline-none disabled:bg-surface-2"
            :aria-label="`Header ${index + 1} Wert`"
            @input="emit('update-value', index, ($event.target as HTMLInputElement).value)"
          />
          <button
            type="button"
            :aria-label="visibleValueIndexes.has(index) ? 'Wert verbergen' : 'Wert anzeigen'"
            class="focus-ring absolute right-2 top-1/2 -translate-y-1/2 p-1 text-fg-muted hover:text-fg rounded"
            @click="emit('toggle-value-visibility', index)"
          >
            <EyeOff v-if="visibleValueIndexes.has(index)" :size="14" />
            <Eye v-else :size="14" />
          </button>
        </div>
        <button
          type="button"
          :disabled="disabled"
          class="focus-ring shrink-0 w-10 h-10 flex items-center justify-center bg-surface border border-border-strong rounded-md text-fg-muted hover:text-danger hover:border-danger/50 disabled:opacity-40 disabled:cursor-not-allowed"
          :aria-label="`Header ${index + 1} entfernen`"
          @click="emit('remove-header', index)"
        >
          <X :size="14" />
        </button>
      </div>

      <button
        type="button"
        :disabled="disabled"
        class="focus-ring inline-flex items-center gap-1.5 h-9 px-3 border border-dashed border-border-strong rounded-md text-[12px] text-fg-muted hover:text-fg hover:border-fg/30 disabled:opacity-40 disabled:cursor-not-allowed"
        @click="emit('add-header')"
      >
        <Plus :size="13" />
        Header hinzufügen
      </button>
    </div>
  </div>
</template>
