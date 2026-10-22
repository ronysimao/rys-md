import React from 'react'
import {
  Folder,
  Pin,
  Plus,
  RotateCcw,
  SquarePen,
  Trash2
} from 'lucide-react'
import {
  cn,
  formatAppleNotesDate,
  getTemporalGroupLabel
} from '@/lib/utils'
import { WindowTrafficLights } from './AppleSidebar'
import type { NoteItem, SidebarFilter } from '@/types/notes'

interface AppleNoteListProps {
  notes: NoteItem[]
  selectedNotePath: string | null
  activeFilter: SidebarFilter
  searchQuery: string
  searchInputRef: React.RefObject<HTMLInputElement | null>
  sidebarCollapsed: boolean
  width: number
  onToggleSidebar: () => void
  onSearchChange: (q: string) => void
  onOpenGlobalSearch: () => void
  onSelectNote: (relativePath: string) => void
  onCreateNote: () => void
  onTogglePin: (relativePath: string) => void
  onTrashNote: (relativePath: string) => void
  onRestoreNote: (relativePath: string) => void
  onOpenVersionModal?: () => void
}

export function AppleNoteList({
  notes,
  selectedNotePath,
  activeFilter,
  searchQuery,
  searchInputRef,
  sidebarCollapsed,
  width,
  onToggleSidebar,
  onSearchChange,
  onOpenGlobalSearch,
  onSelectNote,
  onCreateNote,
  onTogglePin,
  onTrashNote,
  onRestoreNote,
  onOpenVersionModal
}: AppleNoteListProps): React.JSX.Element {
  const headerTitle =
    activeFilter.kind === 'all'
      ? 'Todas as Notas'
      : activeFilter.kind === 'pinned'
        ? 'Notas Fixadas'
        : activeFilter.kind === 'trash'
          ? 'Apagadas Recentemente'
          : activeFilter.kind === 'folder'
            ? activeFilter.folderPath.split('/').pop() || activeFilter.folderPath
            : `#${activeFilter.tag}`

  const isTrashView = activeFilter.kind === 'trash'
  const pinnedNotes = isTrashView ? [] : notes.filter((n) => n.pinned)
  const unpinnedNotes = isTrashView ? notes : notes.filter((n) => !n.pinned)

  // Group unpinned notes by temporal section ("Hoje", "Ontem", "7 Dias Anteriores", etc.)
  const temporalGroups: Array<{ label: string; items: NoteItem[] }> = []
  for (const note of unpinnedNotes) {
    const label = getTemporalGroupLabel(note.updatedAt)
    const last = temporalGroups[temporalGroups.length - 1]
    if (last && last.label === label) {
      last.items.push(note)
    } else {
      temporalGroups.push({ label, items: [note] })
    }
  }

  const renderNoteCard = (note: NoteItem) => {
    const isSelected = note.relativePath === selectedNotePath

    return (
      <div
        key={note.relativePath}
        draggable={!note.trashed}
        onDragStart={(e) => {
          e.dataTransfer.setData('text/rys-note-path', note.relativePath)
        }}
        onClick={() => onSelectNote(note.relativePath)}
        className={cn(
          'group relative flex flex-col gap-1 rounded-xl px-3.5 py-2.5 transition-all cursor-pointer border',
          isSelected
            ? 'bg-primary text-primary-foreground border-primary shadow-sm'
            : 'border-transparent hover:bg-accent/70'
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <h3
            className={cn(
              'truncate text-[13.5px] font-semibold leading-snug',
              isSelected ? 'text-primary-foreground' : 'text-foreground'
            )}
          >
            {note.title}
          </h3>
          <div className="flex items-center gap-0.5 shrink-0">
            {note.trashed ? (
              <div className="hidden group-hover:flex items-center gap-0.5">
                <button
                  type="button"
                  title="Restaurar nota"
                  onClick={(e) => {
                    e.stopPropagation()
                    onRestoreNote(note.relativePath)
                  }}
                  className={cn(
                    'rounded p-1 cursor-pointer',
                    isSelected
                      ? 'hover:bg-black/15 text-primary-foreground'
                      : 'hover:bg-background/80 text-emerald-500'
                  )}
                >
                  <RotateCcw className="size-3" />
                </button>
                <button
                  type="button"
                  title="Excluir permanentemente"
                  onClick={(e) => {
                    e.stopPropagation()
                    onTrashNote(note.relativePath)
                  }}
                  className={cn(
                    'rounded p-1 cursor-pointer',
                    isSelected
                      ? 'hover:bg-black/15 text-primary-foreground'
                      : 'hover:bg-background/80 text-red-400'
                  )}
                >
                  <Trash2 className="size-3" />
                </button>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  title={note.pinned ? 'Desafixar nota' : 'Fixar no topo'}
                  onClick={(e) => {
                    e.stopPropagation()
                    onTogglePin(note.relativePath)
                  }}
                  className={cn(
                    'rounded p-1 cursor-pointer items-center justify-center transition-colors',
                    note.pinned ? 'inline-flex' : 'hidden group-hover:inline-flex',
                    isSelected
                      ? 'hover:bg-black/15 text-primary-foreground'
                      : 'hover:bg-background/80 text-primary'
                  )}
                >
                  <Pin
                    className={cn(
                      'size-3',
                      note.pinned &&
                        (isSelected
                          ? 'fill-primary-foreground'
                          : 'fill-primary')
                    )}
                  />
                </button>
                <button
                  type="button"
                  title="Mover para a Lixeira"
                  onClick={(e) => {
                    e.stopPropagation()
                    onTrashNote(note.relativePath)
                  }}
                  className={cn(
                    'hidden group-hover:inline-flex items-center justify-center rounded p-1 cursor-pointer transition-colors',
                    isSelected
                      ? 'hover:bg-black/15 text-primary-foreground'
                      : 'hover:bg-background/80 text-muted-foreground hover:text-red-400'
                  )}
                >
                  <Trash2 className="size-3" />
                </button>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span
            className={cn(
              'shrink-0 font-semibold tabular-nums',
              isSelected ? 'text-primary-foreground/95' : 'text-muted-foreground'
            )}
          >
            {formatAppleNotesDate(note.updatedAt)}
          </span>
          <span
            className={cn(
              'truncate',
              isSelected
                ? 'text-primary-foreground/85'
                : 'text-muted-foreground/85'
            )}
          >
            {note.preview}
          </span>
        </div>

        {(note.folder && note.folder !== '.trash') || note.tags.length > 0 ? (
          <div className="mt-0.5 flex items-center gap-2 overflow-hidden">
            {note.folder && note.folder !== '.trash' && (
              <span
                className={cn(
                  'inline-flex items-center gap-1 truncate text-[11px]',
                  isSelected
                    ? 'text-primary-foreground/85'
                    : 'text-muted-foreground'
                )}
              >
                <Folder
                  className={cn(
                    'size-2.5 shrink-0',
                    isSelected ? 'text-primary-foreground' : 'text-primary/85'
                  )}
                />
                <span className="truncate">{note.folder}</span>
              </span>
            )}
            {note.tags.slice(0, 2).map((t) => (
              <span
                key={t}
                className={cn(
                  'rounded px-1.5 py-0.2 text-[10px] font-medium',
                  isSelected
                    ? 'bg-black/15 text-primary-foreground'
                    : 'bg-primary/12 text-primary'
                )}
              >
                #{t}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <section
      style={{ width: `${width}px` }}
      className="rys-glass-notelist flex h-full min-w-[200px] shrink-0 flex-col border-r border-border select-none"
    >
      {/* Cabeçalho da Lista de Notas + Botão Nova Nota */}
      <div className="flex h-12 items-center justify-between gap-2 px-3.5 border-b border-border/50">
        <div className="flex items-center gap-2.5 min-w-0">
          {sidebarCollapsed && (
            <WindowTrafficLights
              onToggleSidebar={onToggleSidebar}
              sidebarCollapsed={sidebarCollapsed}
              onOpenVersionModal={onOpenVersionModal}
            />
          )}
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold">{headerTitle}</h2>
            <p className="text-[11px] text-muted-foreground">
              {notes.length} {notes.length === 1 ? 'nota' : 'notas'}
            </p>
          </div>
        </div>
        {!isTrashView && (
          <button
            type="button"
            onClick={onCreateNote}
            title="Nova Nota (Ctrl+N)"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground shadow-xs hover:opacity-90 transition-opacity cursor-pointer shrink-0"
          >
            <SquarePen className="size-3.5" />
            <span>Nova</span>
          </button>
        )}
      </div>

      {/* Lista Agrupada */}
      <div className="flex-1 overflow-y-auto px-2.5 py-2.5 space-y-4 scrollbar-sleek">
        {notes.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center px-4 text-center">
            <p className="text-xs text-muted-foreground mb-2">
              {searchQuery
                ? 'Nenhuma nota encontrada para esta busca.'
                : isTrashView
                  ? 'A lixeira está vazia.'
                  : 'Nenhuma nota nesta visualização.'}
            </p>
            {!isTrashView && !searchQuery && (
              <button
                type="button"
                onClick={onCreateNote}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline cursor-pointer"
              >
                <Plus className="size-3.5" /> Criar primeira nota
              </button>
            )}
          </div>
        ) : (
          <>
            {pinnedNotes.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary">
                  <Pin className="size-3" />
                  <span>Fixadas</span>
                </div>
                {pinnedNotes.map(renderNoteCard)}
              </div>
            )}

            {temporalGroups.map((group) => (
              <div key={group.label} className="space-y-1">
                <div className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/40 mb-1.5">
                  {group.label}
                </div>
                {group.items.map(renderNoteCard)}
              </div>
            ))}
          </>
        )}
      </div>
    </section>
  )
}
