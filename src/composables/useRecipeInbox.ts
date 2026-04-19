/**
 * Transient stash for "recipe" args that arrive via the URL (see `useRouter` +
 * `buildRecipeUrl`). When a user opens a shared link like
 * `#/s/<server>?run=<tool>&args=<b64>`, the router extracts the recipe; App.vue
 * stashes it here once the server is connected; the matching `ToolDetail` mount
 * consumes it to prefill its form. One-shot — consumption clears the stash so
 * tool-switching doesn't re-apply stale args.
 */
import { ref } from 'vue'

const pendingToolName = ref<string | null>(null)
const pendingArgs = ref<Record<string, unknown> | null>(null)

export function stashRecipe(toolName: string, args: Record<string, unknown>): void {
  pendingToolName.value = toolName
  pendingArgs.value = args
}

export function consumeRecipe(toolName: string): Record<string, unknown> | null {
  if (pendingToolName.value !== toolName) return null
  const args = pendingArgs.value
  pendingToolName.value = null
  pendingArgs.value = null
  return args
}

export function clearRecipe(): void {
  pendingToolName.value = null
  pendingArgs.value = null
}
