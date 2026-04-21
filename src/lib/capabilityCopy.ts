/**
 * Human-readable explanations for MCP server capability flags. The Connected-Header
 * shows only top-level keys as chips; sub-flags (`listChanged`, `subscribe`, …) and
 * server-provided feature names (`experimental.xyz`, `extensions.foo`) are surfaced
 * inside the tooltip based on what the server actually advertises.
 */
export interface CapabilityInfo {
  title: string
  description: string
  /**
   * Known boolean sub-flags per capability (e.g. `resources.subscribe`).
   * Value is the German tooltip copy shown when the flag is `true`.
   */
  subFlags?: Record<string, string>
  /**
   * Opt-in mode: `experimental` / `extensions` carry an arbitrary map of
   * vendor-defined features. We list the actual keys of that map instead of
   * trying to invent descriptions for each one.
   */
  listsFeatureKeys?: boolean
  /** Pointer to the tab that surfaces the live list of items. */
  tabHint?: string
}

export const CAPABILITY_INFO: Record<string, CapabilityInfo> = {
  tools: {
    title: 'Tools',
    description:
      'Der Server bietet aufrufbare Werkzeuge — strukturierte Funktionen mit Argumenten und Rückgabewerten.',
    subFlags: {
      listChanged: 'Meldet Änderungen an der Tool-Liste zur Laufzeit automatisch.',
    },
    tabHint: 'Tools-Tab zeigt die live Liste.',
  },
  resources: {
    title: 'Resources',
    description:
      'Der Server stellt adressierbare Inhalte bereit (Dateien, Records, URIs) zum Auslesen und Referenzieren.',
    subFlags: {
      subscribe: 'Unterstützt Live-Abos auf einzelne Ressourcen-URIs.',
      listChanged: 'Meldet, wenn sich die Ressourcen-Liste ändert.',
    },
    tabHint: 'Resources-Tab zeigt die live Liste.',
  },
  prompts: {
    title: 'Prompts',
    description:
      'Vorgefertigte Prompt-Templates mit Argumenten, die der Server zur Verfügung stellt.',
    subFlags: {
      listChanged: 'Meldet Änderungen an der Prompt-Liste.',
    },
    tabHint: 'Prompts-Tab zeigt die live Liste.',
  },
  logging: {
    title: 'Logging',
    description:
      'Der Server pusht strukturierte Log-Nachrichten — sie landen im Log-Tab des Playgrounds.',
  },
  experimental: {
    title: 'Experimental',
    description:
      'Hersteller-eigene Features außerhalb der MCP-Spec. Verhalten nicht stabil — kann sich jederzeit ändern.',
    listsFeatureKeys: true,
  },
  completions: {
    title: 'Completions',
    description:
      'Der Server liefert Argument-Autovervollständigung für Prompts und Resource-Templates.',
  },
  tasks: {
    title: 'Tasks',
    description:
      'Langlaufende, asynchrone Operationen mit Status-Tracking und Cancel-Support.',
  },
  extensions: {
    title: 'Extensions',
    description:
      'Hersteller-definierte Erweiterungen jenseits der Standard-Capabilities.',
    listsFeatureKeys: true,
  },
}

export function capabilityInfo(key: string): CapabilityInfo {
  return (
    CAPABILITY_INFO[key] ?? {
      title: key,
      description:
        'Unbekannte Capability — keine Erklärung im Playground hinterlegt. Details ggf. in der Server-Dokumentation.',
    }
  )
}

export interface CapabilityFeature {
  /** Stable key used for `v-for`. */
  key: string
  /** User-visible label. */
  label: string
  /** Optional detail (e.g. object-valued feature definition serialized short). */
  hint?: string
}

function stringifyFeatureHint(value: unknown): string | undefined {
  if (value === true) return undefined
  if (value === null || value === undefined) return undefined
  if (typeof value === 'string') return value.length > 80 ? `${value.slice(0, 77)}…` : value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (typeof value === 'object') {
    try {
      const json = JSON.stringify(value)
      return json.length > 80 ? `${json.slice(0, 77)}…` : json
    } catch {
      return undefined
    }
  }
  return undefined
}

/**
 * Resolves which sub-flags / feature keys to display inside the tooltip for a
 * given capability entry:
 *
 * - `tools`, `resources`, `prompts`: the well-known boolean sub-flags (listChanged,
 *   subscribe) — only the ones the server set to `true` are included.
 * - `experimental`, `extensions`: the actual keys of the object become the list,
 *   so the user sees *which* vendor-specific feature is advertised. Object values
 *   are short-previewed when they carry nested info.
 */
export function describeCapability(
  key: string,
  entry: unknown,
  info: CapabilityInfo,
): CapabilityFeature[] {
  if (!entry || typeof entry !== 'object') return []
  const record = entry as Record<string, unknown>

  if (info.listsFeatureKeys) {
    return Object.entries(record).map(([featureKey, value]) => ({
      key: `${key}:${featureKey}`,
      label: featureKey,
      hint: stringifyFeatureHint(value),
    }))
  }

  if (info.subFlags) {
    return Object.entries(info.subFlags).flatMap(([flag, label]) =>
      record[flag] === true ? [{ key: `${key}:${flag}`, label }] : [],
    )
  }

  return []
}
