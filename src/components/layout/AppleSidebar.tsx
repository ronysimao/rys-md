import React, { useState } from 'react'
import {
  Folder,
  FolderOpen,
  Hash,
  Moon,
  Pin,
  Sun,
  Trash2,
  FileText,
  HardDrive,
  X,
  Check,
  PlusCircle,
  PanelLeft,
  Minus,
  Maximize2,
  ChevronUp,
  ChevronDown,
  GripVertical,
  RefreshCw,
  Sparkles
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { APP_VERSION } from '@/lib/version-changelog'
import type { AccentColor, NoteItem, SidebarFilter } from '@/types/notes'

interface AppleSidebarProps {
  vaultPath: string
  folders: string[]
  notes: NoteItem[]
  activeFilter: SidebarFilter
  isDark: boolean
  accentColor: AccentColor
  collapsed: boolean
  width: number
  isResizing?: boolean
  updateInfo?: {
    hasUpdate: boolean
    latestVersion: string
    releaseUrl: string
    downloadUrl?: string
  } | null
  isCheckingUpdate?: boolean
  isUpdating?: boolean
  onToggleCollapse: () => void
  onSelectFilter: (filter: SidebarFilter) => void
  onCreateFolder: (folderPath: string) => void
  onDeleteFolder: (folderPath: string) => void
  onReorderFolders: (nextOrder: string[]) => void
  onMoveNoteToFolder: (noteRelativePath: string, targetFolder: string) => void
  onTrashNote: (noteRelativePath: string) => void
  onToggleTheme: () => void
  onChangeAccentColor: (color: AccentColor) => void
  onChangeVaultPath: () => void
  onOpenMarkdownFile: () => void
  onOpenVersionModal: () => void
  onCheckOrPerformUpdate: () => void
}

export type WindowActionType =
  | 'close'
  | 'minimize'
  | 'maximize'
  | 'drag'
  | 'resize-n'
  | 'resize-s'
  | 'resize-w'
  | 'resize-e'
  | 'resize-nw'
  | 'resize-ne'
  | 'resize-sw'
  | 'resize-se'

const RESIZE_DIRECTION_MAP: Record<
  string,
  'North' | 'South' | 'West' | 'East' | 'NorthWest' | 'NorthEast' | 'SouthWest' | 'SouthEast'
> = {
  'resize-n': 'North',
  'resize-s': 'South',
  'resize-w': 'West',
  'resize-e': 'East',
  'resize-nw': 'NorthWest',
  'resize-ne': 'NorthEast',
  'resize-sw': 'SouthWest',
  'resize-se': 'SouthEast'
}

export async function handleWindowAction(action: WindowActionType) {
  const isTauri =
    typeof window !== 'undefined' &&
    Boolean((window as unknown as Record<string, unknown>).__TAURI_INTERNALS__)

  if (isTauri) {
    const resizeDir = RESIZE_DIRECTION_MAP[action]
    if (resizeDir) {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window')
        await getCurrentWindow().startResizeDragging(resizeDir)
      } catch {
        // ignore
      }
      return
    }
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('window_action', { action })
      return
    } catch {
      // fallback to @tauri-apps/api/window below
    }
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window')
      const win = getCurrentWindow()
      if (action === 'close') await win.close()
      else if (action === 'minimize') await win.minimize()
      else if (action === 'maximize') await win.toggleMaximize()
      else if (action === 'drag') await win.startDragging()
      return
    } catch {
      // fallback below
    }
  }

  // Sinaliza a janela nativa Linux (GTK3 + WebKit2) via document.title
  if (typeof document !== 'undefined') {
    document.title = `__RYS_WIN_CMD__:${action}:${Date.now()}`
    setTimeout(() => {
      if (document.title.startsWith('__RYS_WIN_CMD__:')) {
        document.title = 'Rys MD'
      }
    }, 60)
  }

  if (action === 'close') {
    window.close()
  } else if (action === 'maximize') {
    if (
      typeof window !== 'undefined' &&
      !(window as unknown as Record<string, unknown>).__RYS_NATIVE_GTK__
    ) {
      if (!document.fullscreenElement) {
        void document.documentElement.requestFullscreen().catch(() => {})
      } else {
        void document.exitFullscreen().catch(() => {})
      }
    }
  }
}

export function WindowTrafficLights({
  onToggleSidebar,
  sidebarCollapsed,
  onOpenVersionModal
}: {
  onToggleSidebar: () => void
  sidebarCollapsed: boolean
  onOpenVersionModal?: () => void
}): React.JSX.Element {
  return (
    <div
      className={cn(
        'flex items-center gap-2',
        !sidebarCollapsed && 'w-full justify-between'
      )}
    >
      <div className="flex items-center gap-2">
        {/* Botões de Controle de Janela (Fechar, Minimizar, Maximizar) no canto superior esquerdo */}
        <div className="group/lights flex items-center gap-1.5 mr-1">
          <button
            type="button"
            onClick={() => void handleWindowAction('close')}
            title="Fechar janela"
            style={{ cursor: 'pointer' }}
            className="flex size-3 items-center justify-center rounded-full bg-[#ff5f57] border border-black/15 text-black/75 transition-transform active:scale-90 cursor-pointer"
          >
            <X className="size-2 opacity-0 group-hover/lights:opacity-100 stroke-[2.5]" />
          </button>
          <button
            type="button"
            onClick={() => void handleWindowAction('minimize')}
            title="Minimizar janela"
            style={{ cursor: 'pointer' }}
            className="flex size-3 items-center justify-center rounded-full bg-[#febc2e] border border-black/15 text-black/75 transition-transform active:scale-90 cursor-pointer"
          >
            <Minus className="size-2 opacity-0 group-hover/lights:opacity-100 stroke-[2.5]" />
          </button>
          <button
            type="button"
            onClick={() => void handleWindowAction('maximize')}
            title="Maximizar / Tela Cheia"
            style={{ cursor: 'pointer' }}
            className="flex size-3 items-center justify-center rounded-full bg-[#28c840] border border-black/15 text-black/75 transition-transform active:scale-90 cursor-pointer"
          >
            <Maximize2 className="size-1.5 opacity-0 group-hover/lights:opacity-100 stroke-[2.5]" />
          </button>
        </div>

        {/* Botão Retrátil da Primeira Coluna */}
        <button
          type="button"
          onClick={onToggleSidebar}
          title={sidebarCollapsed ? 'Mostrar barra lateral' : 'Ocultar barra lateral'}
          style={{ cursor: 'pointer' }}
          className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
        >
          <PanelLeft className="size-4" />
        </button>
      </div>

      {/* Pill Clicável da Versão do Aplicativo no lado oposto ao botão de recolher a primeira coluna */}
      {onOpenVersionModal && (
        <button
          type="button"
          onClick={onOpenVersionModal}
          style={{ cursor: 'pointer' }}
          title={`Versão v${APP_VERSION} — Clique para ver as novidades e o repositório`}
          className={cn(
            'inline-flex items-center rounded-md border border-border/70 bg-accent/45 px-2 py-0.5 text-[10.5px] font-semibold font-mono text-muted-foreground hover:border-primary/50 hover:bg-primary/15 hover:text-primary transition-colors cursor-pointer shrink-0',
            !sidebarCollapsed && 'ml-auto'
          )}
        >
          <span style={{ cursor: 'pointer' }}>v{APP_VERSION}</span>
        </button>
      )}
    </div>
  )
}

export function AppleSidebar({
  vaultPath,
  folders,
  notes,
  activeFilter,
  isDark,
  accentColor,
  collapsed,
  width,
  isResizing = false,
  updateInfo,
  isCheckingUpdate = false,
  isUpdating = false,
  onToggleCollapse,
  onSelectFilter,
  onCreateFolder,
  onDeleteFolder,
  onReorderFolders,
  onMoveNoteToFolder,
  onTrashNote,
  onToggleTheme,
  onChangeAccentColor,
  onChangeVaultPath,
  onOpenMarkdownFile,
  onOpenVersionModal,
  onCheckOrPerformUpdate
}: AppleSidebarProps): React.JSX.Element {
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null)
  const [draggingFolder, setDraggingFolder] = useState<string | null>(null)
  const [folderDropIndicator, setFolderDropIndicator] = useState<{
    folderPath: string
    position: 'before' | 'after'
  } | null>(null)

  const moveFolderToTarget = (
    sourceFolder: string,
    targetFolder: string,
    position: 'before' | 'after'
  ) => {
    if (sourceFolder === targetFolder) return
    const next = folders.filter((f) => f !== sourceFolder)
    const targetIdx = next.indexOf(targetFolder)
    if (targetIdx === -1) return
    const insertIdx = position === 'before' ? targetIdx : targetIdx + 1
    next.splice(insertIdx, 0, sourceFolder)
    onReorderFolders(next)
  }

  const moveFolderByOffset = (folderPath: string, offset: -1 | 1) => {
    const idx = folders.indexOf(folderPath)
    const targetIdx = idx + offset
    if (idx === -1 || targetIdx < 0 || targetIdx >= folders.length) return
    const next = [...folders]
    const [removed] = next.splice(idx, 1)
    next.splice(targetIdx, 0, removed)
    onReorderFolders(next)
  }

  const activeNotes = notes.filter((n) => !n.trashed)
  const pinnedCount = activeNotes.filter((n) => n.pinned).length
  const trashCount = notes.filter((n) => n.trashed).length

  // Collect all unique tags across active notes
  const allTags = Array.from(
    new Set(activeNotes.flatMap((n) => n.tags))
  ).sort((a, b) => a.localeCompare(b))

  const handleCreateFolderSubmit = () => {
    const trimmed = newFolderName.trim()
    if (trimmed) {
      onCreateFolder(trimmed)
    }
    setNewFolderName('')
    setCreatingFolder(false)
  }

  return (
    <aside
      aria-hidden={collapsed}
      style={{ width: collapsed ? 0 : `${width}px` }}
      className={cn(
        'rys-glass-sidebar flex h-full shrink-0 flex-col text-sidebar-foreground select-none overflow-hidden',
        !isResizing && 'transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
        collapsed
          ? 'opacity-0 -translate-x-4 pointer-events-none border-r-0'
          : 'opacity-100 translate-x-0 border-r border-border'
      )}
    >
      <div className="flex h-full w-full min-w-[150px] flex-col">
        {/* Header estilo Apple Notes: Controles de Janela + Botão Retrátil + Versão Clicável */}
        <div className="flex h-12 items-center justify-between px-3.5 border-b border-border/50 shrink-0">
          <WindowTrafficLights
            onToggleSidebar={onToggleCollapse}
            sidebarCollapsed={collapsed}
            onOpenVersionModal={onOpenVersionModal}
          />
        </div>

        {/* Navegação Principal */}
        <div className="flex-1 overflow-y-auto px-2.5 py-3 space-y-5 scrollbar-sleek">
          {/* Seção Inteligente */}
          <div className="space-y-0.5">
            <div className="flex items-center justify-between px-2.5 pb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Notas Locais
              </span>
              <button
                type="button"
                onClick={onOpenMarkdownFile}
                title="Abrir arquivo"
                aria-label="Abrir arquivo"
                className="inline-flex items-center justify-center rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-primary transition-colors cursor-pointer"
              >
                <FolderOpen className="size-3.5" />
              </button>
            </div>

            {/* Todas as Notas */}
            <button
              type="button"
              onClick={() => onSelectFilter({ kind: 'all' })}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOverTarget('__root__')
              }}
              onDragLeave={() => setDragOverTarget(null)}
              onDrop={(e) => {
                e.preventDefault()
                setDragOverTarget(null)
                const relPath = e.dataTransfer.getData('text/rys-note-path')
                if (relPath) onMoveNoteToFolder(relPath, '')
              }}
              className={cn(
                'flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors cursor-pointer',
                activeFilter.kind === 'all'
                  ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                  : 'hover:bg-accent text-foreground',
                dragOverTarget === '__root__' && 'ring-2 ring-primary'
              )}
            >
              <span className="flex items-center gap-2.5 truncate">
                <FileText
                  className={cn(
                    'size-4 shrink-0',
                    activeFilter.kind === 'all'
                      ? 'text-primary-foreground'
                      : 'text-primary'
                  )}
                />
                <span className="truncate">Todas as Notas</span>
              </span>
              <span
                className={cn(
                  'text-xs tabular-nums',
                  activeFilter.kind === 'all'
                    ? 'text-primary-foreground/90 font-semibold'
                    : 'text-muted-foreground'
                )}
              >
                {activeNotes.length}
              </span>
            </button>

            {/* Fixadas */}
            <button
              type="button"
              onClick={() => onSelectFilter({ kind: 'pinned' })}
              className={cn(
                'flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors cursor-pointer',
                activeFilter.kind === 'pinned'
                  ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                  : 'hover:bg-accent text-foreground'
              )}
            >
              <span className="flex items-center gap-2.5 truncate">
                <Pin
                  className={cn(
                    'size-4 shrink-0',
                    activeFilter.kind === 'pinned'
                      ? 'text-primary-foreground'
                      : 'text-primary'
                  )}
                />
                <span className="truncate">Notas Fixadas</span>
              </span>
              <span
                className={cn(
                  'text-xs tabular-nums',
                  activeFilter.kind === 'pinned'
                    ? 'text-primary-foreground/90 font-semibold'
                    : 'text-muted-foreground'
                )}
              >
                {pinnedCount}
              </span>
            </button>

            {/* Lixeira */}
            <button
              type="button"
              onClick={() => onSelectFilter({ kind: 'trash' })}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOverTarget('__trash__')
              }}
              onDragLeave={() => setDragOverTarget(null)}
              onDrop={(e) => {
                e.preventDefault()
                setDragOverTarget(null)
                const relPath = e.dataTransfer.getData('text/rys-note-path')
                if (relPath) onTrashNote(relPath)
              }}
              className={cn(
                'flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors cursor-pointer',
                activeFilter.kind === 'trash'
                  ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                  : 'hover:bg-accent text-foreground',
                dragOverTarget === '__trash__' && 'ring-2 ring-red-500 bg-red-500/10'
              )}
            >
              <span className="flex items-center gap-2.5 truncate">
                <Trash2
                  className={cn(
                    'size-4 shrink-0',
                    activeFilter.kind === 'trash'
                      ? 'text-primary-foreground'
                      : 'text-primary'
                  )}
                />
                <span className="truncate">Apagadas Recentemente</span>
              </span>
              <span
                className={cn(
                  'text-xs tabular-nums',
                  activeFilter.kind === 'trash'
                    ? 'text-primary-foreground/90 font-semibold'
                    : 'text-muted-foreground'
                )}
              >
                {trashCount}
              </span>
            </button>
          </div>

          {/* Pastas do Usuário */}
          <div className="space-y-0.5">
            <div className="flex items-center justify-between px-2.5 pb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Pastas
              </span>
            </div>

            {creatingFolder && (
              <div className="flex items-center gap-1 px-2 py-1">
                <Folder className="size-4 text-primary shrink-0" />
                <input
                  type="text"
                  autoFocus
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Nome da pasta..."
                  className="min-w-0 flex-1 rounded border border-primary/60 bg-background px-2 py-0.5 text-xs outline-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateFolderSubmit()
                    if (e.key === 'Escape') {
                      setCreatingFolder(false)
                      setNewFolderName('')
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={handleCreateFolderSubmit}
                  className="p-1 text-primary hover:bg-accent rounded cursor-pointer"
                  title="Confirmar"
                >
                  <Check className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCreatingFolder(false)
                    setNewFolderName('')
                  }}
                  className="p-1 text-muted-foreground hover:bg-accent rounded cursor-pointer"
                  title="Cancelar"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            )}

            {folders.length === 0 && !creatingFolder ? (
              <div className="px-2.5 py-2 text-xs text-muted-foreground italic">
                Nenhuma pasta criada
              </div>
            ) : (
              folders.map((folderPath, idx) => {
                const isSelected =
                  activeFilter.kind === 'folder' &&
                  activeFilter.folderPath === folderPath
                const count = activeNotes.filter(
                  (n) =>
                    n.folder === folderPath || n.folder.startsWith(`${folderPath}/`)
                ).length
                const depth = folderPath.split('/').length - 1
                const displayName = folderPath.split('/').pop() || folderPath
                const isDropBefore =
                  folderDropIndicator?.folderPath === folderPath &&
                  folderDropIndicator.position === 'before'
                const isDropAfter =
                  folderDropIndicator?.folderPath === folderPath &&
                  folderDropIndicator.position === 'after'

                return (
                  <div
                    key={folderPath}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = 'move'
                      e.dataTransfer.setData('text/rys-folder-path', folderPath)
                      setDraggingFolder(folderPath)
                    }}
                    onDragEnd={() => {
                      setDraggingFolder(null)
                      setFolderDropIndicator(null)
                      setDragOverTarget(null)
                    }}
                    onDragOver={(e) => {
                      e.preventDefault()
                      if (
                        draggingFolder ||
                        e.dataTransfer.types.includes('text/rys-folder-path')
                      ) {
                        const rect = e.currentTarget.getBoundingClientRect()
                        const pos =
                          e.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
                        setFolderDropIndicator({ folderPath, position: pos })
                        setDragOverTarget(null)
                      } else {
                        setDragOverTarget(folderPath)
                        setFolderDropIndicator(null)
                      }
                    }}
                    onDragLeave={() => {
                      setDragOverTarget(null)
                      setFolderDropIndicator((prev) =>
                        prev?.folderPath === folderPath ? null : prev
                      )
                    }}
                    onDrop={(e) => {
                      e.preventDefault()
                      const draggedFolder =
                        draggingFolder || e.dataTransfer.getData('text/rys-folder-path')
                      if (draggedFolder) {
                        const pos = folderDropIndicator?.position ?? 'after'
                        moveFolderToTarget(draggedFolder, folderPath, pos)
                        setDraggingFolder(null)
                        setFolderDropIndicator(null)
                        setDragOverTarget(null)
                        return
                      }
                      setDragOverTarget(null)
                      setFolderDropIndicator(null)
                      const relPath = e.dataTransfer.getData('text/rys-note-path')
                      if (relPath) onMoveNoteToFolder(relPath, folderPath)
                    }}
                    style={
                      depth > 0 ? { paddingLeft: `${10 + depth * 12}px` } : undefined
                    }
                    className={cn(
                      'group relative flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-all cursor-pointer',
                      isSelected
                        ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                        : 'hover:bg-accent text-foreground',
                      dragOverTarget === folderPath && 'ring-2 ring-primary',
                      draggingFolder === folderPath && 'opacity-50',
                      isDropBefore && 'border-t-2 border-primary',
                      isDropAfter && 'border-b-2 border-primary'
                    )}
                    onClick={() => onSelectFilter({ kind: 'folder', folderPath })}
                  >
                    <span className="flex items-center gap-2.5 truncate">
                      {isSelected ? (
                        <FolderOpen className="size-4 shrink-0 text-primary-foreground" />
                      ) : (
                        <Folder className="size-4 shrink-0 text-primary" />
                      )}
                      <span className="truncate">{displayName}</span>
                    </span>
                    <span className="flex items-center gap-0.5">
                      {folders.length > 1 && (
                        <>
                          <GripVertical
                            className={cn(
                              'size-3 shrink-0 opacity-0 group-hover:opacity-60 transition-opacity mr-0.5',
                              isSelected ? 'text-primary-foreground' : 'text-muted-foreground'
                            )}
                          />
                          <button
                            type="button"
                            title="Mover pasta para cima"
                            disabled={idx === 0}
                            onClick={(e) => {
                              e.stopPropagation()
                              moveFolderByOffset(folderPath, -1)
                            }}
                            className={cn(
                              'opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-black/10 transition-opacity cursor-pointer disabled:opacity-25',
                              isSelected
                                ? 'text-primary-foreground'
                                : 'text-muted-foreground hover:text-foreground'
                            )}
                          >
                            <ChevronUp className="size-3" />
                          </button>
                          <button
                            type="button"
                            title="Mover pasta para baixo"
                            disabled={idx === folders.length - 1}
                            onClick={(e) => {
                              e.stopPropagation()
                              moveFolderByOffset(folderPath, 1)
                            }}
                            className={cn(
                              'opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-black/10 transition-opacity cursor-pointer disabled:opacity-25',
                              isSelected
                                ? 'text-primary-foreground'
                                : 'text-muted-foreground hover:text-foreground'
                            )}
                          >
                            <ChevronDown className="size-3" />
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        title="Excluir pasta"
                        onClick={(e) => {
                          e.stopPropagation()
                          onDeleteFolder(folderPath)
                        }}
                        className={cn(
                          'opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-black/10 transition-opacity cursor-pointer',
                          isSelected
                            ? 'text-primary-foreground'
                            : 'text-muted-foreground hover:text-red-400'
                        )}
                      >
                        <Trash2 className="size-3" />
                      </button>
                      <span
                        className={cn(
                          'ml-0.5 text-xs tabular-nums',
                          isSelected
                            ? 'text-primary-foreground/90 font-semibold'
                            : 'text-muted-foreground'
                        )}
                      >
                        {count}
                      </span>
                    </span>
                  </div>
                )
              })
            )}
          </div>

          {/* Tags (#tags) */}
          {allTags.length > 0 && (
            <div className="space-y-1.5">
              <div className="px-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Etiquetas (Tags)
              </div>
              <div className="flex flex-wrap gap-1.5 px-2">
                {allTags.map((tag) => {
                  const isSelected =
                    activeFilter.kind === 'tag' && activeFilter.tag === tag
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() =>
                        onSelectFilter(
                          isSelected ? { kind: 'all' } : { kind: 'tag', tag }
                        )
                      }
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors cursor-pointer',
                        isSelected
                          ? 'bg-primary text-primary-foreground font-semibold'
                          : 'bg-accent/70 text-muted-foreground hover:bg-accent hover:text-foreground'
                      )}
                    >
                      <Hash className="size-3" />
                      <span>{tag}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Botão de Atualização no rodapé da primeira coluna ACIMA da linha divisória que está ACIMA de Nova Pasta (estilo Orca ADE) */}
        <div className="px-2.5 pb-2 pt-1 shrink-0">
          <button
            type="button"
            disabled={isCheckingUpdate || isUpdating}
            onClick={onCheckOrPerformUpdate}
            title={
              updateInfo?.hasUpdate
                ? `Nova versão v${updateInfo.latestVersion} disponível! Clique para atualizar e reabrir automaticamente de onde parou.`
                : 'Verificar atualizações do Rys MD (fecha, atualiza e reabre de onde estava)'
            }
            className={cn(
              'flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all cursor-pointer disabled:opacity-60',
              updateInfo?.hasUpdate
                ? 'bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/50'
                : 'border border-border/70 bg-accent/40 text-muted-foreground hover:bg-accent hover:text-foreground'
            )}
          >
            <span className="flex items-center gap-2 truncate">
              {updateInfo?.hasUpdate ? (
                <Sparkles className="size-3.5 shrink-0 animate-pulse" />
              ) : (
                <RefreshCw
                  className={cn(
                    'size-3.5 shrink-0 text-primary',
                    (isCheckingUpdate || isUpdating) && 'animate-spin'
                  )}
                />
              )}
              <span className="truncate">
                {isUpdating
                  ? 'Atualizando e reiniciando...'
                  : isCheckingUpdate
                    ? 'Verificando atualização...'
                    : updateInfo?.hasUpdate
                      ? `Atualizar p/ v${updateInfo.latestVersion}`
                      : 'Atualizar Rys MD'}
              </span>
            </span>
            {updateInfo?.hasUpdate && (
              <span className="rounded px-1.5 py-0.5 text-[10px] font-mono shrink-0 bg-black/20 text-primary-foreground">
                NOVO
              </span>
            )}
          </button>
        </div>

        {/* Rodapé da Sidebar: Botão Nova Pasta no canto inferior esquerdo + Tema + Cor */}
        <div className="border-t border-border/50 p-2.5 space-y-2 shrink-0">
          {/* Nova Pasta no canto inferior esquerdo (estilo Apple Notes do Mac) */}
          <div className="flex items-center justify-between px-1">
            <button
              type="button"
              onClick={() => setCreatingFolder(true)}
              title="Criar Nova Pasta"
              className="inline-flex items-center gap-2 rounded-lg px-1.5 py-1 text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
            >
              <PlusCircle className="size-4 text-primary" />
              <span>Nova Pasta</span>
            </button>

            {/* Seletor de Cor de Acentuação (Azul Mac vs Amarelo) + Tema */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onChangeAccentColor('blue')}
                title="Cor de destaque: Azul (Mac)"
                className={cn(
                  'size-4 rounded-full bg-[#0a84ff] transition-transform cursor-pointer',
                  accentColor === 'blue'
                    ? 'ring-2 ring-foreground scale-110'
                    : 'opacity-65 hover:opacity-100'
                )}
              />
              <button
                type="button"
                onClick={() => onChangeAccentColor('yellow')}
                title="Cor de destaque: Amarelo"
                className={cn(
                  'size-4 rounded-full bg-[#eab308] transition-transform cursor-pointer',
                  accentColor === 'yellow'
                    ? 'ring-2 ring-foreground scale-110'
                    : 'opacity-65 hover:opacity-100'
                )}
              />
              <button
                type="button"
                onClick={onToggleTheme}
                title={isDark ? 'Mudar para Modo Claro' : 'Mudar para Modo Escuro'}
                className="ml-1 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
              >
                {isDark ? (
                  <Sun className="size-3.5 text-primary" />
                ) : (
                  <Moon className="size-3.5 text-primary" />
                )}
              </button>
            </div>
          </div>

          {/* Caminho do Cofre Local */}
          <button
            type="button"
            onClick={onChangeVaultPath}
            title={`Pasta atual: ${vaultPath} (Clique para alterar)`}
            className="flex w-full items-center justify-between rounded-md px-2 py-1 text-[11px] text-muted-foreground/80 hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-1.5 truncate">
              <HardDrive className="size-3 text-primary shrink-0" />
              <span className="truncate font-mono">
                {vaultPath.replace(/^\/home\/[^/]+/, '~')}
              </span>
            </span>
          </button>
        </div>
      </div>
    </aside>
  )
}
