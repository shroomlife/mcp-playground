import type { TransportKind } from '~/composables/useMcpPlayground'

export interface McpJsonFile {
  mcpServers?: Record<string, unknown>
  [key: string]: unknown
}

export interface ExistingFileInfo {
  exists: boolean
  serverNames: string[]
  hasNameCollision: boolean
  raw?: string
}

export interface InstallResult {
  created: boolean
  overwrote: boolean
  path: string
  serverCount: number
}

export function isDirectoryPickerSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function'
}

export function sanitizeServerName(input: string): string {
  const cleaned = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return cleaned || 'mcp-server'
}

export function suggestServerName(serverDisplayName: string | undefined, targetUrl: string): string {
  if (serverDisplayName) {
    const fromServer = sanitizeServerName(serverDisplayName)
    if (fromServer !== 'mcp-server') return fromServer
  }
  try {
    const parsed = new URL(targetUrl)
    const host = parsed.hostname.split('.').filter((p) => p !== 'www' && p !== 'mcp')
    const base = host[0] ?? parsed.hostname
    return sanitizeServerName(base)
  } catch {
    return 'mcp-server'
  }
}

export function buildMcpEntry(url: string, transport: TransportKind): Record<string, unknown> {
  return {
    type: transport,
    url,
  }
}

export async function pickProjectDirectory(): Promise<FileSystemDirectoryHandle> {
  if (!isDirectoryPickerSupported() || !window.showDirectoryPicker) {
    throw new Error('Dein Browser unterstützt die File System Access API nicht (nur Chrome/Edge).')
  }
  return window.showDirectoryPicker({
    mode: 'readwrite',
    id: 'mcp-playground-project',
    startIn: 'documents',
  })
}

export async function inspectMcpJson(
  dirHandle: FileSystemDirectoryHandle,
  proposedName: string,
): Promise<ExistingFileInfo> {
  try {
    const fileHandle = await dirHandle.getFileHandle('.mcp.json', { create: false })
    const file = await fileHandle.getFile()
    const raw = await file.text()
    if (!raw.trim()) {
      return { exists: true, serverNames: [], hasNameCollision: false, raw }
    }
    let parsed: McpJsonFile
    try {
      parsed = JSON.parse(raw) as McpJsonFile
    } catch {
      throw new Error('.mcp.json existiert, ist aber kein gültiges JSON')
    }
    const servers = (parsed.mcpServers ?? {}) as Record<string, unknown>
    const names = Object.keys(servers)
    return {
      exists: true,
      serverNames: names,
      hasNameCollision: names.includes(proposedName),
      raw,
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'NotFoundError') {
      return { exists: false, serverNames: [], hasNameCollision: false }
    }
    throw err
  }
}

export async function installToClaudeCode(
  dirHandle: FileSystemDirectoryHandle,
  serverName: string,
  entry: Record<string, unknown>,
): Promise<InstallResult> {
  let existingData: McpJsonFile = {}
  let fileExisted = false

  try {
    const existingHandle = await dirHandle.getFileHandle('.mcp.json', { create: false })
    fileExisted = true
    const file = await existingHandle.getFile()
    const text = await file.text()
    if (text.trim()) {
      try {
        existingData = JSON.parse(text) as McpJsonFile
      } catch {
        throw new Error('.mcp.json existiert, ist aber kein gültiges JSON — bitte manuell reparieren')
      }
    }
  } catch (err) {
    if (!(err instanceof DOMException && err.name === 'NotFoundError')) {
      if (err instanceof Error && err.message.includes('.mcp.json')) throw err
      // other errors re-throw as-is
      if (fileExisted) throw err
    }
  }

  const existingServers = (existingData.mcpServers ?? {}) as Record<string, unknown>
  const overwrote = serverName in existingServers

  const nextData: McpJsonFile = {
    ...existingData,
    mcpServers: {
      ...existingServers,
      [serverName]: entry,
    },
  }

  const json = JSON.stringify(nextData, null, 2) + '\n'

  const writeHandle = await dirHandle.getFileHandle('.mcp.json', { create: true })
  const writable = await writeHandle.createWritable()
  try {
    await writable.write(json)
  } finally {
    await writable.close()
  }

  return {
    created: !fileExisted,
    overwrote,
    path: `${dirHandle.name}/.mcp.json`,
    serverCount: Object.keys(nextData.mcpServers ?? {}).length,
  }
}

export function buildSnippet(serverName: string, entry: Record<string, unknown>): string {
  return JSON.stringify(
    {
      mcpServers: {
        [serverName]: entry,
      },
    },
    null,
    2,
  )
}

/**
 * Known MCP client targets — each wraps the server entry in its own config format.
 * Adding a new client == add another entry.
 */
export type ClientTargetId = 'claude-code' | 'cursor' | 'vscode' | 'windsurf'

export interface ClientTarget {
  id: ClientTargetId
  label: string
  filePath: string
  pathNote: string
  docsUrl: string
  /** Whether the Install flow can directly write via File System Access API. */
  supportsDirectWrite: boolean
  buildSnippet(serverName: string, entry: Record<string, unknown>): string
}

const mcpServersWrap = (name: string, entry: Record<string, unknown>) =>
  JSON.stringify({ mcpServers: { [name]: entry } }, null, 2)

const vscodeServersWrap = (name: string, entry: Record<string, unknown>) =>
  JSON.stringify({ servers: { [name]: entry } }, null, 2)

export const CLIENT_TARGETS: ClientTarget[] = [
  {
    id: 'claude-code',
    label: 'Claude Code',
    filePath: '.mcp.json',
    pathNote: 'Im Projekt-Root. Claude Code liest es automatisch beim Start.',
    docsUrl: 'https://docs.claude.com/en/docs/claude-code/mcp',
    supportsDirectWrite: true,
    buildSnippet: mcpServersWrap,
  },
  {
    id: 'cursor',
    label: 'Cursor',
    filePath: '.cursor/mcp.json',
    pathNote: 'Projekt-Scope. Für User-Scope: ~/.cursor/mcp.json.',
    docsUrl: 'https://docs.cursor.com/context/mcp',
    supportsDirectWrite: false,
    buildSnippet: mcpServersWrap,
  },
  {
    id: 'vscode',
    label: 'VS Code',
    filePath: '.vscode/mcp.json',
    pathNote: 'VS Code nutzt "servers" statt "mcpServers".',
    docsUrl: 'https://code.visualstudio.com/docs/copilot/chat/mcp-servers',
    supportsDirectWrite: false,
    buildSnippet: vscodeServersWrap,
  },
  {
    id: 'windsurf',
    label: 'Windsurf',
    filePath: '~/.codeium/windsurf/mcp_config.json',
    pathNote: 'User-Scope, alle Workspaces.',
    docsUrl: 'https://docs.windsurf.com/windsurf/cascade/mcp',
    supportsDirectWrite: false,
    buildSnippet: mcpServersWrap,
  },
]
