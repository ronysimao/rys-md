export const APP_VERSION = '0.4.0'
export const APP_REPO_URL = 'https://github.com/ronysimao/rys-md'
export const APP_RELEASES_URL = 'https://github.com/ronysimao/rys-md/releases'
export const APP_SITE_URL = 'https://md.rysdev.com'

export interface VersionReleaseEntry {
  version: string
  date: string
  title: string
  highlights: string[]
}

export const VERSION_CHANGELOG: VersionReleaseEntry[] = [
  {
    version: '0.4.0',
    date: 'Outubro 2026',
    title: 'Table of Contents, Exportação A4 para PDF, Emojis Nativos & Auto-Update',
    highlights: [
      'Novo painel lateral retrátil e redimensionável (mín. 150px) de Table of Contents (Heading Outline) com filtros de nível H1–H5.',
      'Exportação nativa para PDF (A4) com tratamento inteligente de quebra de página e modal do sistema pré-preenchido com <Nome da Nota>.pdf.',
      'Comando /emoji no menu Slash com renderização nativa de acordo com o Sistema Operacional (Linux, macOS ou Windows) e atalho para o seletor do SO.',
      'Cursor dinâmico que inclina suavemente em Itálico (Ctrl + I) e fica mais espesso em Negrito (Ctrl + B).',
      'Botão flutuante no canto inferior esquerdo da nota para rolar instantaneamente até a última linha escrita (Ctrl + End).',
      'Sistema de verificação e atualização automática (Auto-Update estilo Orca ADE) que atualiza e reabre o Rys MD exatamente de onde parou.'
    ]
  },
  {
    version: '0.3.0',
    date: 'Outubro 2026',
    title: 'Busca Visual (Ctrl+F / Ctrl+H), Sincronia Bidirecional Source ⇄ Rich & Multi-Plataforma',
    highlights: [
      'Barra de Busca e Substituição (Ctrl + F e Ctrl + H) idêntica ao Orca ADE funcionando nos modos Rich e Source em todo o documento.',
      'Sincronização bidirecional instantânea entre o editor Source (CodeMirror 6) e o editor Rich (TipTap v3).',
      'Workflow CI/CD multi-plataforma para compilação automática em Linux (.deb / .AppImage), Windows (.exe / MSI) e macOS (.dmg).'
    ]
  },
  {
    version: '0.2.0',
    date: 'Outubro 2026',
    title: 'Liquid Glass UI, Reordenação de Pastas & Zoom Universal',
    highlights: [
      'Design Liquid Glass translúcido em todas as barras laterais, cabeçalhos e menus flutuantes.',
      'Reordenação de pastas via Drag & Drop e botões rápidos de subida/descida.',
      'Zoom universal (70% a 200%) respeitado por todos os blocos da nota, incluindo blocos de código e diagramas Mermaid.'
    ]
  },
  {
    version: '0.1.0',
    date: 'Outubro 2026',
    title: 'Lançamento Inicial do Rys MD',
    highlights: [
      'Arquitetura Local-First em Rust + React 19 unindo o layout de 3 colunas do Apple Notes ao editor Markdown Dual-Mode do Orca ADE.',
      'Suporte nativo a tabelas GFM interativas, checklists, blocos retráteis (Toggle H1–H3), KaTeX e Mermaid.'
    ]
  }
]
