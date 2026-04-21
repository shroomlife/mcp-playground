/**
 * Human-readable explanations for MCP server capability flags. The Connected-Header
 * shows only top-level keys as chips; sub-flags (`listChanged`, `subscribe`, …) get
 * surfaced inside the tooltip when the server actually advertises them.
 */
export interface CapabilityInfo {
  title: string
  description: string
  subFlags?: Record<string, string>
}

export const CAPABILITY_INFO: Record<string, CapabilityInfo> = {
  tools: {
    title: 'Tools',
    description:
      'Der Server bietet aufrufbare Werkzeuge — Funktionen, die du mit strukturierten Argumenten ausführen kannst.',
    subFlags: {
      listChanged: 'Meldet Änderungen an der Tool-Liste zur Laufzeit automatisch.',
    },
  },
  resources: {
    title: 'Resources',
    description:
      'Der Server stellt Inhalte bereit (Dateien, Daten, URIs), die du auslesen und referenzieren kannst.',
    subFlags: {
      subscribe: 'Unterstützt Live-Abos auf einzelne Ressourcen-URIs.',
      listChanged: 'Meldet, wenn sich die Ressourcen-Liste ändert.',
    },
  },
  prompts: {
    title: 'Prompts',
    description:
      'Vorgefertigte Prompt-Templates mit Argumenten, die der Server zur Verfügung stellt.',
    subFlags: {
      listChanged: 'Meldet Änderungen an der Prompt-Liste.',
    },
  },
  logging: {
    title: 'Logging',
    description:
      'Der Server pusht strukturierte Log-Nachrichten — sie landen im Log-Tab des Playgrounds.',
  },
  experimental: {
    title: 'Experimental',
    description:
      'Hersteller-eigene Experimentier-Features außerhalb der MCP-Spec. Verhalten kann sich jederzeit ändern.',
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
      'Server-definierte Erweiterungen jenseits der Standard-Capabilities — meist hersteller-spezifisch.',
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

/**
 * Extracts the enabled boolean sub-flags from the server's raw capability entry.
 * Only string-keyed truthy flags are included — nested objects (e.g. `tasks.requests`)
 * are skipped because we don't have UI copy for them.
 */
export function activeSubFlags(entry: unknown, info: CapabilityInfo): Array<{ key: string; label: string }> {
  if (!entry || typeof entry !== 'object' || !info.subFlags) return []
  const record = entry as Record<string, unknown>
  return Object.entries(info.subFlags).flatMap(([flag, label]) =>
    record[flag] === true ? [{ key: flag, label }] : [],
  )
}
