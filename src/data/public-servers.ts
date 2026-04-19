import type { TransportKind } from '~/composables/useMcpPlayground'

export type AuthKind = 'none' | 'oauth' | 'api-key'

export interface PublicServer {
  id: string
  name: string
  description: string
  url: string
  transport: TransportKind
  auth: AuthKind
  category: 'docs' | 'search' | 'dev' | 'data' | 'fun'
  docsUrl?: string
}

// Kleine, handgepickte Liste — jeder Eintrag ist auf CORS-Support geprüft und läuft
// aus dem Browser (kein Proxy nötig). Mehr gibt's im awesome-remote-mcp-servers-Repo.
export const PUBLIC_SERVERS: PublicServer[] = [
  {
    id: 'deepwiki',
    name: 'DeepWiki',
    description: 'RAG-Zugriff auf GitHub-Repos — frag jedes Repo nach Architektur und Code.',
    url: 'https://mcp.deepwiki.com/mcp',
    transport: 'http',
    auth: 'none',
    category: 'docs',
    docsUrl: 'https://mcp.deepwiki.com',
  },
  {
    id: 'huggingface',
    name: 'Hugging Face',
    description: 'Modelle, Datasets und Spaces durchsuchen und lesen.',
    url: 'https://hf.co/mcp',
    transport: 'http',
    auth: 'none',
    category: 'dev',
    docsUrl: 'https://huggingface.co/docs/hub/en/mcp',
  },
  {
    id: 'github',
    name: 'GitHub',
    description: 'Offizieller GitHub-MCP — Issues, PRs, Code-Suche. Benötigt OAuth.',
    url: 'https://api.githubcopilot.com/mcp/',
    transport: 'http',
    auth: 'oauth',
    category: 'dev',
    docsUrl: 'https://github.com/github/github-mcp-server',
  },
]

export const CATEGORY_LABELS: Record<PublicServer['category'], string> = {
  docs: 'Docs',
  search: 'Suche',
  dev: 'Developer',
  data: 'Data',
  fun: 'Sonstige',
}
