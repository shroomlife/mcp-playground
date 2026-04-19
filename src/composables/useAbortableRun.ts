import { computed, onBeforeUnmount, ref } from 'vue'
import type { CallOptions } from './useMcpPlayground'

export interface ProgressState {
  progress: number
  total?: number
  message?: string
}

/**
 * Generic "abortable, progress-aware run" primitive used by Tool/Prompt/Resource details.
 * Each detail component creates its own instance; `:key` on the parent auto-aborts when
 * the user switches to another item.
 */
export function useAbortableRun<T>() {
  const running = ref(false)
  const progress = ref<ProgressState | null>(null)
  let controller: AbortController | null = null

  const progressPercent = computed<number | null>(() => {
    const p = progress.value
    if (!p || typeof p.total !== 'number' || p.total <= 0) return null
    return Math.min(100, Math.round((p.progress / p.total) * 100))
  })

  async function run(runner: (options: CallOptions) => Promise<T>): Promise<T | null> {
    if (running.value) return null
    running.value = true
    progress.value = null
    const current = new AbortController()
    controller = current
    try {
      return await runner({
        signal: current.signal,
        onProgress: (p) => {
          if (controller !== current) return
          progress.value = { progress: p.progress, total: p.total, message: p.message }
        },
      })
    } finally {
      if (controller === current) {
        controller = null
        running.value = false
        progress.value = null
      }
    }
  }

  function cancel() {
    controller?.abort()
  }

  onBeforeUnmount(() => {
    controller?.abort()
  })

  return { running, progress, progressPercent, run, cancel }
}
