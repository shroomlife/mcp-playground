/**
 * MCP Elicitation (server → client request for additional info).
 *
 * Servers send `elicitation/create` when they need input from the user mid-operation.
 * Two modes:
 *   - **form** — server ships a JSON-Schema description, client renders a form.
 *   - **url** — server sends a URL for the user to visit; completion happens
 *     out-of-band (server is notified via some other channel).
 *
 * We expose `elicit()` as a promise-based API: the SDK's request handler awaits it
 * while the UI waits for the user. `ElicitationDialog.vue` is the single render site.
 * Spec: https://modelcontextprotocol.io/specification/draft/client/elicitation
 */
import { ref, type Ref } from 'vue'

export type ElicitationMode = 'form' | 'url'

export interface ElicitationFormSchema {
  type: 'object'
  properties: Record<string, unknown>
  required?: string[]
}

export interface ElicitationParams {
  mode?: ElicitationMode
  message: string
  /** Present in `form` mode. */
  requestedSchema?: ElicitationFormSchema
  /** Present in `url` mode. */
  url?: string
  elicitationId?: string
}

export interface ElicitationResult {
  action: 'accept' | 'decline' | 'cancel'
  content?: Record<string, unknown>
}

interface Pending {
  params: ElicitationParams
  resolve: (result: ElicitationResult) => void
}

const pending = ref<Pending | null>(null)

export function elicit(params: ElicitationParams): Promise<ElicitationResult> {
  return new Promise((resolve) => {
    // Extremely rare but possible: a second elicitation arrives while one is pending.
    // Cancel the older one so the new dialog takes over cleanly.
    pending.value?.resolve({ action: 'cancel' })
    pending.value = { params, resolve }
  })
}

export function resolveElicitation(result: ElicitationResult): void {
  pending.value?.resolve(result)
  pending.value = null
}

export function useElicitation(): { pending: Ref<Pending | null> } {
  return { pending }
}
