<script setup lang="ts">
import { computed, ref } from 'vue'
import { ChevronDown, ChevronRight } from 'lucide-vue-next'

const props = withDefaults(
  defineProps<{
    value: unknown
    nodeKey?: string | number
    matchRegex?: RegExp | null
    initiallyExpanded?: boolean
    depth?: number
  }>(),
  { nodeKey: undefined, matchRegex: null, initiallyExpanded: true, depth: 0 },
)

defineOptions({ name: 'JsonNode' })

type Kind = 'primitive' | 'object' | 'array'

// MCP tools commonly ship their payload as a `text` content item whose body is a
// JSON-encoded object/array. At the Pretty-level we already detect and parse that;
// this node-level detection makes sure the Explorer tree also treats embedded JSON
// strings as navigable sub-trees rather than opaque one-liners. Raw mode still shows
// the literal string if someone actually wants it.
const parsedEmbeddedJson = computed<unknown | null>(() => {
  if (typeof props.value !== 'string') return null
  const trimmed = props.value.trim()
  if (trimmed.length < 2) return null
  const first = trimmed[0]
  if (first !== '{' && first !== '[') return null
  try {
    const parsed = JSON.parse(trimmed) as unknown
    if (parsed === null) return null
    if (Array.isArray(parsed)) return parsed
    if (typeof parsed === 'object') return parsed
    return null
  } catch {
    return null
  }
})

const isEmbeddedJson = computed<boolean>(() => parsedEmbeddedJson.value !== null)

const effectiveValue = computed<unknown>(() => {
  return isEmbeddedJson.value ? parsedEmbeddedJson.value : props.value
})

const kind = computed<Kind>(() => {
  const v = effectiveValue.value
  if (Array.isArray(v)) return 'array'
  if (v !== null && typeof v === 'object') return 'object'
  return 'primitive'
})

const childEntries = computed<{ key: string | number; value: unknown }[]>(() => {
  const v = effectiveValue.value
  if (Array.isArray(v)) return v.map((item, i) => ({ key: i, value: item }))
  if (v && typeof v === 'object') {
    return Object.entries(v as Record<string, unknown>).map(([k, val]) => ({ key: k, value: val }))
  }
  return []
})

const childCount = computed(() => childEntries.value.length)

const primitiveText = computed<string>(() => {
  const v = props.value
  if (v === null) return 'null'
  if (v === undefined) return 'undefined'
  if (typeof v === 'string') return `"${v}"`
  if (typeof v === 'boolean' || typeof v === 'number') return String(v)
  try {
    return JSON.stringify(v)
  } catch {
    return String(v)
  }
})

const primitiveColor = computed<string>(() => {
  const v = props.value
  if (v === null || v === undefined) return 'text-fg-muted italic'
  if (typeof v === 'string') return 'text-success'
  if (typeof v === 'number') return 'text-accent'
  if (typeof v === 'boolean') return 'text-warning'
  return 'text-fg-2'
})

// Collapse by default beyond the first two levels — avoids a wall of rows on open.
const defaultExpanded = props.depth <= 1 ? (props.initiallyExpanded ?? true) : false
const expanded = ref(defaultExpanded)

function keyMatches(re: RegExp): boolean {
  return props.nodeKey !== undefined && re.test(String(props.nodeKey))
}

function primitiveMatches(re: RegExp): boolean {
  if (kind.value !== 'primitive') return false
  return re.test(primitiveText.value)
}

const selfMatch = computed<boolean>(() => {
  const re = props.matchRegex
  if (!re) return false
  return keyMatches(re) || primitiveMatches(re)
})

// Deep descendant search — used to keep parent rows visible for context + auto-expand.
// Treats JSON-encoded strings as parsed objects so matches inside embedded payloads
// still surface, mirroring what the Explorer renders visually.
function deepMatch(v: unknown, key: string, re: RegExp): boolean {
  if (key && re.test(key)) return true
  if (v === null) return re.test('null')
  if (typeof v === 'string') {
    const trimmed = v.trim()
    if (trimmed.length >= 2 && (trimmed[0] === '{' || trimmed[0] === '[')) {
      try {
        const parsed = JSON.parse(trimmed) as unknown
        if (parsed && typeof parsed === 'object') {
          return Array.isArray(parsed)
            ? parsed.some((item, i) => deepMatch(item, String(i), re))
            : Object.entries(parsed as Record<string, unknown>).some(([k, val]) => deepMatch(val, k, re))
        }
      } catch {
        /* fall through to string match */
      }
    }
    return re.test(`"${v}"`)
  }
  if (typeof v === 'number' || typeof v === 'boolean') return re.test(String(v))
  if (Array.isArray(v)) return v.some((item, i) => deepMatch(item, String(i), re))
  if (v && typeof v === 'object') {
    return Object.entries(v as Record<string, unknown>).some(([k, val]) => deepMatch(val, k, re))
  }
  return false
}

const hasDescendantMatch = computed<boolean>(() => {
  const re = props.matchRegex
  if (!re || kind.value === 'primitive') return false
  return childEntries.value.some((entry) => deepMatch(entry.value, String(entry.key), re))
})

const visible = computed<boolean>(() => {
  if (!props.matchRegex) return true
  return selfMatch.value || hasDescendantMatch.value
})

const effectivelyExpanded = computed<boolean>(() => {
  if (props.matchRegex && hasDescendantMatch.value) return true
  return expanded.value
})

function toggle() {
  expanded.value = !expanded.value
}

const openBracket = computed(() => (kind.value === 'array' ? '[' : '{'))
const closeBracket = computed(() => (kind.value === 'array' ? ']' : '}'))

const keyHighlightClass = computed(() =>
  props.matchRegex && keyMatches(props.matchRegex) ? 'bg-accent/25 rounded-sm px-0.5' : '',
)
const primitiveHighlightClass = computed(() =>
  props.matchRegex && primitiveMatches(props.matchRegex) ? 'bg-accent/25 rounded-sm px-0.5' : '',
)
</script>

<template>
  <div v-if="visible" class="font-mono text-[12px] leading-[1.65]">
    <div class="flex items-start gap-1">
      <button
        v-if="kind !== 'primitive' && childCount > 0"
        type="button"
        :aria-expanded="effectivelyExpanded"
        :aria-label="effectivelyExpanded ? 'Zuklappen' : 'Aufklappen'"
        class="focus-ring shrink-0 p-0.5 text-fg-muted hover:text-fg rounded"
        @click="toggle"
      >
        <ChevronDown v-if="effectivelyExpanded" :size="11" />
        <ChevronRight v-else :size="11" />
      </button>
      <span v-else class="shrink-0 inline-block w-[15px]" />

      <span v-if="nodeKey !== undefined" class="shrink-0">
        <span :class="keyHighlightClass" class="text-fg-2">{{ nodeKey }}</span><span
          class="text-fg-muted"
        >:&nbsp;</span>
      </span>

      <span
        v-if="isEmbeddedJson"
        class="shrink-0 font-mono text-[9.5px] text-accent bg-accent-soft border border-accent/30 rounded-sm px-1 mr-1 uppercase tracking-wide"
        title="String-Wert enthält JSON und wird als Baum gezeigt. Raw-Tab zeigt den Original-String."
      >
        JSON
      </span>

      <template v-if="kind === 'primitive'">
        <span
          class="break-all"
          :class="[primitiveColor, primitiveHighlightClass]"
        >{{ primitiveText }}</span>
      </template>

      <template v-else>
        <span class="text-fg-muted shrink-0">{{ openBracket }}</span>
        <template v-if="childCount === 0">
          <span class="text-fg-muted">{{ closeBracket }}</span>
        </template>
        <template v-else-if="!effectivelyExpanded">
          <button
            type="button"
            class="focus-ring text-fg-subtle hover:text-fg-2 text-[11px] px-1"
            @click="toggle"
          >
            … {{ childCount }}
          </button>
          <span class="text-fg-muted">{{ closeBracket }}</span>
        </template>
      </template>
    </div>

    <div
      v-if="kind !== 'primitive' && effectivelyExpanded && childCount > 0"
      class="pl-[13px] border-l border-border ml-[7px]"
    >
      <JsonNode
        v-for="entry in childEntries"
        :key="String(entry.key)"
        :value="entry.value"
        :node-key="entry.key"
        :match-regex="matchRegex"
        :depth="depth + 1"
        :initially-expanded="initiallyExpanded"
      />
      <div class="text-fg-muted pl-[2px]">
        {{ closeBracket }}
      </div>
    </div>
  </div>
</template>
