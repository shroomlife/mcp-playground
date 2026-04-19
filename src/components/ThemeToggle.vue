<script setup lang="ts">
import { computed } from 'vue'
import { Sun, Moon } from 'lucide-vue-next'
import { useTheme } from '~/composables/useTheme'

const { theme, toggle } = useTheme()

const label = computed(() =>
  theme.value === 'dark' ? 'Zu Light Mode wechseln' : 'Zu Dark Mode wechseln',
)
</script>

<template>
  <button
    type="button"
    :aria-label="label"
    :title="label"
    class="focus-ring inline-flex items-center justify-center size-8 rounded-md text-fg-muted hover:text-fg hover:bg-surface-2 transition-colors"
    @click="toggle"
  >
    <Moon v-if="theme === 'light'" :size="14" aria-hidden="true" />
    <Sun v-else :size="14" aria-hidden="true" />
  </button>
</template>
