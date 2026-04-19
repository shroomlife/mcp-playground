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

// Curated list of public remote MCP servers. All entries verified against
// the community-maintained awesome-remote-mcp-servers registry — entries
// without auth get preferred placement since they work one-click from this
// browser-only client.
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
    id: 'cloudflare-docs',
    name: 'Cloudflare Docs',
    description: 'Durchsuchbare Cloudflare-Developer-Docs als MCP-Tool.',
    url: 'https://docs.mcp.cloudflare.com/sse',
    transport: 'sse',
    auth: 'none',
    category: 'docs',
    docsUrl: 'https://developers.cloudflare.com/agents/model-context-protocol/',
  },
  {
    id: 'astro-docs',
    name: 'Astro Docs',
    description: 'Dokumentation zum Astro-Webframework — semantische Suche.',
    url: 'https://mcp.docs.astro.build/mcp',
    transport: 'http',
    auth: 'none',
    category: 'docs',
    docsUrl: 'https://docs.astro.build',
  },
  {
    id: 'aws-knowledge',
    name: 'AWS Knowledge',
    description: 'AWS Developer-Referenz — Services, APIs, Best Practices.',
    url: 'https://knowledge-mcp.global.api.aws',
    transport: 'http',
    auth: 'none',
    category: 'docs',
    docsUrl: 'https://awslabs.github.io/mcp/',
  },
  {
    id: 'gitmcp',
    name: 'GitMCP',
    description: 'Zugriff auf beliebige öffentliche GitHub-Repos über Git-Ops.',
    url: 'https://gitmcp.io/docs',
    transport: 'http',
    auth: 'none',
    category: 'dev',
    docsUrl: 'https://gitmcp.io',
  },
  {
    id: 'semgrep',
    name: 'Semgrep',
    description: 'Statische Code-Analyse via SAST-Rules — Security-Scan on demand.',
    url: 'https://mcp.semgrep.ai/sse',
    transport: 'sse',
    auth: 'none',
    category: 'dev',
    docsUrl: 'https://semgrep.dev/docs',
  },
  {
    id: 'exa-search',
    name: 'Exa Search',
    description: 'Neurale Web-Suche mit Fokus auf Research-Queries.',
    url: 'https://mcp.exa.ai/mcp',
    transport: 'http',
    auth: 'none',
    category: 'search',
    docsUrl: 'https://docs.exa.ai',
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
  {
    id: 'linear',
    name: 'Linear',
    description: 'Linear-Issues und Projekte — OAuth-gesichert.',
    url: 'https://mcp.linear.app/sse',
    transport: 'sse',
    auth: 'oauth',
    category: 'dev',
    docsUrl: 'https://linear.app/docs/mcp',
  },
  {
    id: 'notion',
    name: 'Notion',
    description: 'Notion-Pages und Datenbanken — OAuth-gesichert.',
    url: 'https://mcp.notion.com/mcp',
    transport: 'http',
    auth: 'oauth',
    category: 'data',
    docsUrl: 'https://developers.notion.com/docs/mcp',
  },
  {
    id: 'sentry',
    name: 'Sentry',
    description: 'Error-Tracking, Issues und Events — OAuth-gesichert.',
    url: 'https://mcp.sentry.dev/mcp',
    transport: 'http',
    auth: 'oauth',
    category: 'dev',
    docsUrl: 'https://docs.sentry.io/product/sentry-mcp/',
  },
]

export const CATEGORY_LABELS: Record<PublicServer['category'], string> = {
  docs: 'Docs',
  search: 'Suche',
  dev: 'Developer',
  data: 'Data',
  fun: 'Sonstige',
}
