export const APP_VERSION = '0.9.2'
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
    version: '0.9.2',
    date: 'Outubro 2026',
    title: 'Bordas Arredondadas Transparentes no Windows 10/11 & Redimensionamento Nativo nos 8 Lados/Cantos',
    highlights: [
      'Correção das bordas retangulares e cantos escuros no Windows 10: desativação do frame DWM retangular (shadow: false no Windows) combinada com fundo WebView2 100% transparente (RGBA 0,0,0,0) para exibir cantos arredondados suaves de 16px.',
      'Redimensionamento nativo em todas as 8 bordas e cantos (N, S, L, O, NO, NE, SO, SE) integrado diretamente ao motor de janelas no Windows, macOS e Linux.',
      'Instalador de macOS resiliente: busca automaticamente o binário Universal mais recente nas Releases do GitHub sem falhar caso uma versão ainda esteja compilando.'
    ]
  },
  {
    version: '0.9.1',
    date: 'Outubro 2026',
    title: 'Bordas Arredondadas Transparentes no macOS & Janela Inteligente (80% da Tela Centralizada)',
    highlights: [
      'Correção das 4 pontas brancas na janela do macOS: ativação de transparência nativa (transparent: true + macOSPrivateApi: true) no WKWebView/NSWindow.',
      'Dimensionamento inteligente em todas as plataformas (Linux, macOS e Windows): o aplicativo agora detecta automaticamente a resolução do monitor principal e abre ocupando 80% da tela e centralizado.'
    ]
  },
  {
    version: '0.9.0',
    date: 'Outubro 2026',
    title: 'macOS Universal (Sonoma & Versões Básicas 10.15+) + Windows PortableApps Edition',
    highlights: [
      'macOS Universal Binary (x86_64 Intel + arm64 Apple Silicon) com suporte estendido desde o macOS 10.15 Catalina até o macOS 14 Sonoma e 15 Sequoia.',
      'Instalador automático de 1 linha para macOS Sonoma (scripts/install-macos.sh) e pacote com desbloqueador automático do Gatekeeper (xattr -cr + assinatura ad-hoc) para instalação sem bloqueios.',
      'Edição Windows PortableApps (Rys-MD_0.9.0_Windows_x64_Portable.zip): roda direto de qualquer pasta ou pendrive sem necessidade de instalador ou privilégios de Administrador, com cofre portátil integrado (Rys MD Vault) e launcher anti-SmartScreen.',
      'Paridade completa de comandos nativos (Exportar PDF A4, Abrir arquivo .md, Auto-Update e Seletor de Emojis) no motor multi-plataforma para macOS e Windows.'
    ]
  },
  {
    version: '0.8.0',
    date: 'Outubro 2026',
    title: 'Reabertura Automática no Auto-Update (Estilo Orca ADE) & Importação Nativa de Arquivos .md',
    highlights: [
      'Correção definitiva do Auto-Update: o processo atualizador agora desacopla sua sessão (double-fork + setsid) e coordena com o script postinst, encerrando a versão antiga e reabrindo automaticamente a nova versão do Rys MD na nota em que você estava.',
      'Botão "Abrir arquivo" reposicionado ao lado do rótulo NOTAS LOCAIS na 1ª coluna, com tooltip simplificado ("Abrir arquivo").',
      'Importação nativa de arquivos .md: ao clicar em "Abrir arquivo" e selecionar qualquer .md no modal nativo do sistema operacional, uma cópia é criada automaticamente na sua pasta padrão do Rys MD (~/Documentos/RYS MD), exibindo aviso informativo e abrindo a nota imediatamente na interface do aplicativo.'
    ]
  },
  {
    version: '0.7.0',
    date: 'Outubro 2026',
    title: 'Barra de Busca Global Unificada na 3ª Coluna & Instância Única Garantida no Auto-Update (prerm + Startup Guard)',
    highlights: [
      'Barra de busca movida da 2ª coluna para o cabeçalho da 3ª coluna com ícone 🔎️ único, placeholder "Busca global" e atalho Ctrl+K integrado.',
      'Remoção de termos técnicos ("Fuzzy Search") dos placeholders e rodapé da Busca Global.',
      'Garantia de instância única no Linux: adição de script DEBIAN/prerm no pacote .deb e verificação ensure_single_instance() na inicialização do binário Rust, encerrando qualquer janela de versão anterior mesmo ao atualizar a partir de versões antigas.'
    ]
  },
  {
    version: '0.6.0',
    date: 'Outubro 2026',
    title: 'Busca Global Estilo daily.dev (Ctrl + K / 🔎️), Estabilidade de Checklists em Toggle H3 & Auto-Update Limpo',
    highlights: [
      'Nova Busca Global (Ctrl + K ou clique no ícone 🔎️) inspirada no daily.dev: escurece o fundo, exibe modal retangular centralizado no topo (~54% da tela) e realiza busca inteligente em tempo real em tags (#tag), títulos de notas, títulos de pastas e conteúdo completo das notas.',
      'Resultados da Busca Global organizados em 2 colunas (Esquerda: Local Encontrado | Direita: Conteúdo/Trecho), com navegação completa por teclado (↑/↓/Enter/Esc) e mouse com realce dinâmico na cor de acentuação.',
      'Correção definitiva do cursor em elementos Toggle (H1–H5): checklists extensos não pulam mais para fora do bloco retrátil durante a digitação.',
      'Encerramento atômico da janela anterior durante o Auto-Update (watchdog GTK + finalização da árvore de processos filhos antes de abrir a nova versão).'
    ]
  },
  {
    version: '0.5.0',
    date: 'Outubro 2026',
    title: 'Cursores de Redimensionamento Imediatos em Todas as Bordas & Efeito Visual de Tags (#tag)',
    highlights: [
      'Cursores nativos de redimensionamento (ew-resize, ns-resize, nwse-resize e nesw-resize) exibidos instantaneamente ao passar o mouse em todas as bordas/cantos da janela e divisórias de colunas antes do clique.',
      'Efeito visual em formato de pílula/badge luminosa ao redor de qualquer TAG (#<texto>) escrita na nota (modos Rich e Source), acompanhando dinamicamente a cor de acentuação escolhida pelo usuário (Azul macOS ou Amarelo Clássico).'
    ]
  },
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
