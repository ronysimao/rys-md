import React, { useState } from 'react'
import {
  Check,
  Code2,
  Copy,
  FileCode2,
  FileDown,
  FolderOpen,
  ListTree,
  Maximize2,
  Minimize2,
  Pin,
  RotateCcw,
  Sparkles,
  Trash2
} from 'lucide-react'
import { marked } from 'marked'
import { cn, countWordsAndChars } from '@/lib/utils'
import { exportActiveNoteToPdf } from '@/components/editor/markdown-export-pdf'
import { WindowTrafficLights } from './AppleSidebar'
import type { EditorMode, NoteItem } from '@/types/notes'

interface NoteHeaderBarProps {
  note: NoteItem
  editorMode: EditorMode
  saveStatus: 'saved' | 'saving' | 'dirty'
  focusMode: boolean
  isTocOpen: boolean
  onToggleFocusMode: () => void
  onToggleToc: () => void
  onChangeEditorMode: (mode: EditorMode) => void
  onTogglePin: () => void
  onTrashNote: () => void
  onRestoreNote: () => void
  onRevealInFolder: () => void
  onOpenVersionModal?: () => void
}

export function NoteHeaderBar({
  note,
  editorMode,
  saveStatus,
  focusMode,
  isTocOpen,
  onToggleFocusMode,
  onToggleToc,
  onChangeEditorMode,
  onTogglePin,
  onTrashNote,
  onRestoreNote,
  onRevealInFolder,
  onOpenVersionModal
}: NoteHeaderBarProps): React.JSX.Element {
  const [copiedType, setCopiedType] = useState<'md' | 'html' | null>(null)
  const [isExportingPdf, setIsExportingPdf] = useState(false)
  const { words, chars } = countWordsAndChars(note.content)

  const handleCopyMarkdown = async () => {
    await navigator.clipboard.writeText(note.content)
    setCopiedType('md')
    setTimeout(() => setCopiedType(null), 1500)
  }

  const handleCopyRichHtml = async () => {
    const html = (await marked.parse(note.content, { gfm: true })).trim()
    try {
      const blobHtml = new Blob([html], { type: 'text/html' })
      const blobText = new Blob([html], { type: 'text/plain' })
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': blobHtml,
          'text/plain': blobText
        })
      ])
    } catch {
      await navigator.clipboard.writeText(html)
    }
    setCopiedType('html')
    setTimeout(() => setCopiedType(null), 1500)
  }

  const handleExportPdf = async () => {
    if (isExportingPdf) return
    setIsExportingPdf(true)
    try {
      await exportActiveNoteToPdf({
        title: note.title || 'Nota',
        markdownContent: note.content
      })
    } finally {
      setIsExportingPdf(false)
    }
  }

  const isEditing = saveStatus !== 'saved'

  return (
    <header className="rys-glass-header flex h-12 shrink-0 items-center justify-between border-b border-border/60 px-4 select-none print:hidden">
      {/* Esquerda: Controles de janela no Modo Foco + Botão Modo Foco + Status Suave */}
      <div className="flex items-center gap-3 min-w-0">
        {focusMode && (
          <WindowTrafficLights
            onToggleSidebar={onToggleFocusMode}
            sidebarCollapsed={true}
            onOpenVersionModal={onOpenVersionModal}
          />
        )}

        <button
          type="button"
          onClick={onToggleFocusMode}
          title={
            focusMode
              ? 'Mostrar barras laterais (Ctrl+\\)'
              : 'Modo Foco — Ocultar barras laterais (Ctrl+\\)'
          }
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer',
            focusMode
              ? 'border-primary/60 bg-primary/15 text-primary'
              : 'border-border hover:bg-accent text-muted-foreground hover:text-foreground'
          )}
        >
          {focusMode ? (
            <>
              <Minimize2 className="size-3.5" />
              <span>Sair do Foco</span>
            </>
          ) : (
            <>
              <Maximize2 className="size-3.5" />
              <span>Modo Foco</span>
            </>
          )}
        </button>

        <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground truncate">
          <span className="inline-flex items-center gap-1.5 font-medium transition-colors duration-300">
            <span
              className={cn(
                'size-2 rounded-full transition-colors duration-300',
                isEditing ? 'bg-primary' : 'bg-emerald-500'
              )}
            />
            <span className="w-14">{isEditing ? 'Editando' : 'Salvo'}</span>
          </span>
          <span>·</span>
          <span className="tabular-nums">
            {words} {words === 1 ? 'palavra' : 'palavras'} ({chars} caract.)
          </span>
        </div>
      </div>

      {/* Direita: Toggle Rich/Source (Orca) + Table of Contents + Ações Rápidas */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Toggle Rich / Source estilo Orca ADE */}
        <div className="inline-flex items-center rounded-lg border border-border bg-muted/50 p-0.5">
          <button
            type="button"
            onClick={() => onChangeEditorMode('rich')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer',
              editorMode === 'rich'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            )}
            title="Modo Rich WYSIWYG"
          >
            <Sparkles className="size-3" />
            <span>Rich</span>
          </button>
          <button
            type="button"
            onClick={() => onChangeEditorMode('source')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer',
              editorMode === 'source'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            )}
            title="Código Markdown"
          >
            <Code2 className="size-3" />
            <span>Source</span>
          </button>
        </div>

        {/* Botão Table of Contents (Heading Outline) ao lado do toggle Rich | Source */}
        <button
          type="button"
          aria-label="Table of Contents"
          aria-pressed={isTocOpen}
          onClick={onToggleToc}
          title="Table of Contents"
          className={cn(
            'inline-flex items-center justify-center rounded-lg border p-1.5 transition-colors cursor-pointer',
            isTocOpen
              ? 'border-primary/60 bg-primary/15 text-primary'
              : 'border-border bg-muted/30 hover:bg-accent text-muted-foreground hover:text-foreground'
          )}
        >
          <ListTree className="size-3.5" />
        </button>

        <div className="mx-1 h-4 w-px bg-border" />

        {/* Fixar Nota */}
        {!note.trashed && (
          <button
            type="button"
            onClick={onTogglePin}
            title={note.pinned ? 'Desafixar nota' : 'Fixar nota no topo'}
            className={cn(
              'inline-flex items-center justify-center rounded-lg border p-1.5 transition-colors cursor-pointer',
              note.pinned
                ? 'border-primary/60 bg-primary/15 text-primary'
                : 'border-transparent hover:bg-accent text-muted-foreground hover:text-foreground'
            )}
          >
            <Pin className={cn('size-3.5', note.pinned && 'fill-primary')} />
          </button>
        )}

        {/* Copiar Markdown */}
        <button
          type="button"
          onClick={() => void handleCopyMarkdown()}
          title="Copiar como Markdown"
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
        >
          {copiedType === 'md' ? (
            <Check className="size-3.5 text-emerald-500" />
          ) : (
            <Copy className="size-3.5" />
          )}
          <span className="hidden lg:inline">MD</span>
        </button>

        {/* Copiar HTML Rico */}
        <button
          type="button"
          onClick={() => void handleCopyRichHtml()}
          title="Copiar como HTML / Texto Rico"
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
        >
          {copiedType === 'html' ? (
            <Check className="size-3.5 text-emerald-500" />
          ) : (
            <FileCode2 className="size-3.5" />
          )}
          <span className="hidden lg:inline">HTML</span>
        </button>

        {/* Abrir no Nautilus */}
        <button
          type="button"
          onClick={onRevealInFolder}
          title="Abrir arquivo na pasta do Ubuntu (Nautilus)"
          className="inline-flex items-center justify-center rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
        >
          <FolderOpen className="size-3.5" />
        </button>

        {/* Exportar para PDF (A4 com tratamento de quebra de página e modal nativo) */}
        <button
          type="button"
          disabled={isExportingPdf}
          onClick={() => void handleExportPdf()}
          title="Exportar para PDF"
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer disabled:opacity-50"
        >
          <FileDown className="size-3.5 text-primary" />
          <span className="hidden xl:inline font-semibold">PDF</span>
        </button>

        {/* Restaurar ou Mover para Lixeira */}
        {note.trashed ? (
          <button
            type="button"
            onClick={onRestoreNote}
            title="Restaurar nota da Lixeira"
            className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-500 hover:bg-emerald-500/25 cursor-pointer"
          >
            <RotateCcw className="size-3.5" />
            <span>Restaurar</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onTrashNote}
            title="Mover nota para a Lixeira"
            className="inline-flex items-center justify-center rounded-lg p-1.5 text-muted-foreground hover:bg-red-500/10 hover:text-red-400 transition-colors cursor-pointer"
          >
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>
    </header>
  )
}

