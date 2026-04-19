<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Plus, X, Info } from 'lucide-vue-next'
import type { FieldMeta, ValidationError } from '~/lib/schemaFormHelpers'

const props = defineProps<{
  fields: FieldMeta[]
  modelValue: Record<string, unknown>
  errors?: ValidationError[]
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: Record<string, unknown>]
  'json-valid-change': [valid: boolean]
}>()

const jsonText = ref<Record<string, string>>({})
const jsonInvalid = ref<Record<string, boolean>>({})

const errorsByField = computed(() => {
  const map: Record<string, string> = {}
  for (const err of props.errors ?? []) {
    map[err.field] = err.message
  }
  return map
})

const allJsonValid = computed(() => Object.values(jsonInvalid.value).every((v) => !v))
watch(allJsonValid, (next) => emit('json-valid-change', next), { immediate: true })

function setField(name: string, value: unknown) {
  emit('update:modelValue', { ...props.modelValue, [name]: value })
}

function onStringInput(name: string, ev: Event) {
  setField(name, (ev.target as HTMLInputElement).value)
}

function onNumberInput(name: string, ev: Event) {
  const raw = (ev.target as HTMLInputElement).value
  if (raw === '') {
    const { [name]: _removed, ...next } = props.modelValue
    emit('update:modelValue', next)
    return
  }
  const num = Number(raw)
  setField(name, Number.isNaN(num) ? raw : num)
}

function onBooleanToggle(name: string, current: unknown) {
  setField(name, !current)
}

function onEnumChange(name: string, ev: Event) {
  setField(name, (ev.target as HTMLSelectElement).value)
}

// --- String arrays ---
function getArray(name: string): string[] {
  const v = props.modelValue[name]
  return Array.isArray(v) ? (v as string[]) : []
}

function updateArrayItem(name: string, index: number, value: string) {
  const next = [...getArray(name)]
  next[index] = value
  setField(name, next)
}

function addArrayItem(name: string) {
  setField(name, [...getArray(name), ''])
}

function removeArrayItem(name: string, index: number) {
  setField(
    name,
    getArray(name).filter((_, i) => i !== index),
  )
}

// --- JSON fallback ---
function initJsonText(name: string) {
  if (jsonText.value[name] !== undefined) return
  const value = props.modelValue[name]
  jsonText.value[name] = value === undefined ? '' : JSON.stringify(value, null, 2)
  jsonInvalid.value[name] = false
}

function onJsonInput(name: string, ev: Event) {
  const raw = (ev.target as HTMLTextAreaElement).value
  jsonText.value = { ...jsonText.value, [name]: raw }
  if (raw.trim() === '') {
    const { [name]: _removed, ...next } = props.modelValue
    emit('update:modelValue', next)
    jsonInvalid.value = { ...jsonInvalid.value, [name]: false }
    return
  }
  try {
    const parsed = JSON.parse(raw) as unknown
    setField(name, parsed)
    jsonInvalid.value = { ...jsonInvalid.value, [name]: false }
  } catch {
    jsonInvalid.value = { ...jsonInvalid.value, [name]: true }
  }
}

watch(
  () => props.fields,
  () => {
    jsonText.value = {}
    jsonInvalid.value = {}
  },
)
</script>

<template>
  <div class="space-y-3.5">
    <div v-if="fields.length === 0" class="text-[12.5px] text-fg-muted italic">
      Dieses Tool erwartet keine Argumente.
    </div>

    <div v-for="field in fields" :key="field.name" class="space-y-1">
      <label
        :for="`field-${field.name}`"
        class="block text-[12px] font-medium text-fg-2"
      >
        <span class="font-mono">{{ field.name }}</span>
        <span v-if="field.required" class="text-danger ml-0.5" aria-label="Pflichtfeld">*</span>
        <span v-if="field.title && field.title !== field.name" class="font-normal text-fg-muted ml-1.5">
          — {{ field.title }}
        </span>
      </label>

      <!-- string / string with format -->
      <input
        v-if="field.kind === 'string'"
        :id="`field-${field.name}`"
        type="text"
        spellcheck="false"
        autocomplete="off"
        :value="modelValue[field.name] ?? ''"
        :disabled="disabled"
        :aria-invalid="!!errorsByField[field.name]"
        :aria-describedby="field.description ? `desc-${field.name}` : undefined"
        class="focus-ring w-full h-9 px-2.5 bg-surface border rounded-md font-mono text-[12.5px] text-fg placeholder:text-fg-subtle focus:outline-none disabled:bg-surface-2"
        :class="errorsByField[field.name]
          ? 'border-danger focus:border-danger'
          : 'border-border-strong focus:border-accent'"
        :placeholder="field.format ? `(${field.format})` : undefined"
        @input="onStringInput(field.name, $event)"
      />

      <!-- enum via select -->
      <select
        v-else-if="field.kind === 'string-enum'"
        :id="`field-${field.name}`"
        :value="(modelValue[field.name] as string | undefined) ?? ''"
        :disabled="disabled"
        :aria-invalid="!!errorsByField[field.name]"
        class="focus-ring w-full h-9 px-2.5 bg-surface border rounded-md font-mono text-[12.5px] text-fg focus:outline-none disabled:bg-surface-2"
        :class="errorsByField[field.name]
          ? 'border-danger focus:border-danger'
          : 'border-border-strong focus:border-accent'"
        @change="onEnumChange(field.name, $event)"
      >
        <option value="" disabled>— bitte wählen —</option>
        <option v-for="opt in field.enum" :key="opt" :value="opt">{{ opt }}</option>
      </select>

      <!-- number / integer -->
      <input
        v-else-if="field.kind === 'number' || field.kind === 'integer'"
        :id="`field-${field.name}`"
        type="number"
        inputmode="numeric"
        :step="field.kind === 'integer' ? 1 : 'any'"
        :min="field.minimum"
        :max="field.maximum"
        :value="modelValue[field.name] ?? ''"
        :disabled="disabled"
        :aria-invalid="!!errorsByField[field.name]"
        class="focus-ring w-full h-9 px-2.5 bg-surface border rounded-md font-mono text-[12.5px] text-fg focus:outline-none disabled:bg-surface-2"
        :class="errorsByField[field.name]
          ? 'border-danger focus:border-danger'
          : 'border-border-strong focus:border-accent'"
        @input="onNumberInput(field.name, $event)"
      />

      <!-- boolean switch -->
      <button
        v-else-if="field.kind === 'boolean'"
        :id="`field-${field.name}`"
        type="button"
        role="switch"
        :aria-checked="!!modelValue[field.name]"
        :disabled="disabled"
        class="focus-ring inline-flex items-center gap-2 h-9 px-3 bg-surface border border-border-strong rounded-md text-[12.5px]"
        @click="onBooleanToggle(field.name, modelValue[field.name])"
      >
        <span
          class="relative inline-block w-7 h-4 rounded-full transition-colors"
          :class="modelValue[field.name] ? 'bg-success' : 'bg-border-strong'"
        >
          <span
            class="absolute top-0.5 size-3 bg-surface rounded-full transition-all shadow-sm"
            :class="modelValue[field.name] ? 'left-[14px]' : 'left-0.5'"
          />
        </span>
        <span class="text-fg-2 font-mono">
          {{ modelValue[field.name] ? 'true' : 'false' }}
        </span>
      </button>

      <!-- string array -->
      <div v-else-if="field.kind === 'string-array'" class="space-y-1.5">
        <div
          v-for="(item, i) in getArray(field.name)"
          :key="i"
          class="flex items-stretch gap-1.5"
        >
          <input
            type="text"
            spellcheck="false"
            :value="item"
            :disabled="disabled"
            class="focus-ring flex-1 h-8 px-2.5 bg-surface border border-border-strong rounded-md font-mono text-[12px] text-fg focus:border-accent focus:outline-none disabled:bg-surface-2"
            :aria-label="`${field.name} Eintrag ${i + 1}`"
            @input="updateArrayItem(field.name, i, ($event.target as HTMLInputElement).value)"
          />
          <button
            type="button"
            :disabled="disabled"
            class="focus-ring shrink-0 w-8 h-8 flex items-center justify-center bg-surface border border-border-strong rounded-md text-fg-muted hover:text-danger hover:border-danger/50 disabled:opacity-40 disabled:cursor-not-allowed"
            :aria-label="`Eintrag ${i + 1} entfernen`"
            @click="removeArrayItem(field.name, i)"
          >
            <X :size="12" />
          </button>
        </div>
        <button
          type="button"
          :disabled="disabled"
          class="focus-ring inline-flex items-center gap-1.5 h-7 px-2 border border-dashed border-border-strong rounded-md text-[11.5px] text-fg-muted hover:text-fg hover:border-fg/30 disabled:opacity-40 disabled:cursor-not-allowed"
          @click="addArrayItem(field.name)"
        >
          <Plus :size="11" />
          Eintrag
        </button>
      </div>

      <!-- json fallback -->
      <div v-else-if="field.kind === 'json'">
        <textarea
          :id="`field-${field.name}`"
          rows="4"
          spellcheck="false"
          :value="jsonText[field.name] ?? ''"
          :disabled="disabled"
          :aria-invalid="!!jsonInvalid[field.name] || !!errorsByField[field.name]"
          class="focus-ring w-full px-2.5 py-2 bg-surface border rounded-md font-mono text-[11.5px] leading-[1.5] text-fg placeholder:text-fg-subtle focus:outline-none resize-y min-h-[90px] disabled:bg-surface-2"
          :class="jsonInvalid[field.name] || errorsByField[field.name]
            ? 'border-danger focus:border-danger'
            : 'border-border-strong focus:border-accent'"
          placeholder="{ ... }"
          @focus="initJsonText(field.name)"
          @input="onJsonInput(field.name, $event)"
        />
        <div
          v-if="jsonInvalid[field.name]"
          class="text-[11px] text-danger mt-0.5 font-mono"
        >
          JSON-Syntaxfehler
        </div>
      </div>

      <!-- Description / error -->
      <div
        v-if="field.description"
        :id="`desc-${field.name}`"
        class="flex items-start gap-1.5 text-[11.5px] text-fg-muted"
      >
        <Info :size="11" class="shrink-0 mt-0.5" />
        <span>{{ field.description }}</span>
      </div>
      <div
        v-if="errorsByField[field.name]"
        class="text-[11.5px] text-danger"
        role="alert"
      >
        {{ errorsByField[field.name] }}
      </div>
    </div>
  </div>
</template>
