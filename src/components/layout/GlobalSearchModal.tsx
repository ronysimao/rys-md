import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  FileText,
  Folder,
  Hash,
  Search,
  Sparkles,
  TextSelect,
  X,
  CornerDownLeft,
  ArrowUp,
  ArrowDown
} from 'lucide-react'
import { cn, formatAppleNotesDate } from '@/lib/utils'
import type { NoteItem, SidebarFilter } from '@/types/notes'

export type GlobalSearchMatchSource = 'tag' | 'title' | 'folder' | 'content'

export interface GlobalSearchResultItem {
  id: string
  source: GlobalSearchMatchSource
  sourceLabel: string
  locationTitle: string
  locationSubtitle: string
  matchedSnippet: string
  score: number
  updatedAt: number
  noteRelativePath?: string
  folderPath?: string
  tag?: string
}

interface GlobalSearchModalProps {
  isOpen: boolean
  notes: NoteItem[]
  folders: string[]
  onClose: () => void
  onSelectNote: (relativePath: string) => void
  onSelectFilter: (filter: SidebarFilter) => void
}

/**
 * Normalizes strings for accent-insensitive and case-insensitive fuzzy matching.
 */
function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

/**
 * Computes a fuzzy match score (> 0 when matched, 0 when not matched) and
 * returns the index of the best match in `target`.
 */
function scoreFuzzyMatch(
  rawTarget: string,
  rawQuery: string
): { score: number; matchIndex: number } {
  if (!rawTarget || !rawQuery) return { score: 0, matchIndex: -1 }
  const target = normalizeText(rawTarget)
  const query = normalizeText(rawQuery.trim())
  if (!query) return { score: 0, matchIndex: -1 }

  // 1. Exact full match
  if (target === query) {
    return { score: 200, matchIndex: 0 }
  }

  // 2. Prefix match
  if (target.startsWith(query)) {
    return { score: 160, matchIndex: 0 }
  }

  // 3. Direct substring match
  const exactIdx = target.indexOf(query)
  if (exactIdx !== -1) {
    const wordBoundaryBonus =
      exactIdx === 0 || /[\s/_#.-]/.test(target[exactIdx - 1] ?? '') ? 25 : 0
    return {
      score: Math.max(85, 130 + wordBoundaryBonus - Math.min(40, exactIdx * 0.25)),
      matchIndex: exactIdx
    }
  }

  // 4. Multi-token match (all space-separated tokens appear in target)
  const tokens = query.split(/\s+/).filter(Boolean)
  if (tokens.length > 1) {
    let firstIdx = -1
    let allFound = true
    for (const tok of tokens) {
      const idx = target.indexOf(tok)
      if (idx === -1) {
        allFound = false
        break
      }
      if (firstIdx === -1 || idx < firstIdx) {
        firstIdx = idx
      }
    }
    if (allFound) {
      return { score: 95, matchIndex: Math.max(0, firstIdx) }
    }
  }

  // 5. Subsequence fuzzy match (for short targets or queries >= 2 chars)
  if (query.length >= 2 && target.length <= 260) {
    let qIdx = 0
    let firstMatch = -1
    let lastMatch = -1
    let consecutive = 0

    for (let i = 0; i < target.length && qIdx < query.length; i++) {
      if (target[i] === query[qIdx]) {
        if (firstMatch === -1) firstMatch = i
        if (lastMatch === i - 1) consecutive += 1
        lastMatch = i
        qIdx += 1
      }
    }

    if (qIdx === query.length && firstMatch !== -1) {
      const span = lastMatch - firstMatch + 1
      const compactness = query.length / Math.max(1, span)
      if (compactness >= 0.42 || consecutive >= Math.max(1, query.length - 2)) {
        return {
          score: Math.round(45 + compactness * 35 + consecutive * 4),
          matchIndex: firstMatch
        }
      }
    }
  }

  return { score: 0, matchIndex: -1 }
}

/**
 * Strips raw Markdown/HTML boilerplate for clean preview snippets in the right column.
 */
function cleanMarkdownLine(line: string): string {
  return line
    .replace(/^<details[^>]*>/gi, '')
    .replace(/^<\/details>/gi, '')
    .replace(/<\/?summary[^>]*>/gi, '')
    .replace(/^#{1,6}\s+/, '')
    .replace(/^[-*+]\s+\[[ xX]\]\s+/, '☐ ')
    .replace(/^[-*+]\s+/, '• ')
    .replace(/`{1,3}/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .trim()
}

/**
 * Extracts the best matching line or surrounding context from a note's content.
 */
function extractContentSnippet(content: string, query: string): {
  score: number
  snippet: string
} {
  const lines = content
    .split(/\r?\n/)
    .map(cleanMarkdownLine)
    .filter((l) => l.length > 0 && l !== '---' && l !== '&nbsp;')

  let bestScore = 0
  let bestLine = ''

  for (const line of lines) {
    const { score, matchIndex } = scoreFuzzyMatch(line, query)
    if (score > bestScore) {
      bestScore = score
      if (line.length > 130 && matchIndex > 35) {
        const start = Math.max(0, matchIndex - 28)
        bestLine = `…${line.slice(start, start + 130)}`
      } else {
        bestLine = line.slice(0, 140)
      }
      if (bestScore >= 145) break
    }
  }

  return { score: bestScore, snippet: bestLine }
}

/**
 * Highlights occurrences of query words inside `text` using the user's accent color.
 */
function renderHighlightedText(text: string, rawQuery: string): React.ReactNode {
  const trimmed = rawQuery.trim()
  if (!trimmed || !text) return text

  const normText = normalizeText(text)
  const normQuery = normalizeText(trimmed)
  const directIdx = normText.indexOf(normQuery)

  if (directIdx !== -1 && directIdx + normQuery.length <= text.length) {
    const before = text.slice(0, directIdx)
    const match = text.slice(directIdx, directIdx + normQuery.length)
    const after = text.slice(directIdx + normQuery.length)
    return (
      <>
        {before}
        <mark className="rounded bg-primary/25 px-1 py-0.2 font-semibold text-primary">
          {match}
        </mark>
        {after}
      </>
    )
  }

  return text
}

export function GlobalSearchModal({
  isOpen,
  notes,
  folders,
  onClose,
  onSelectNote,
  onSelectFilter
}: GlobalSearchModalProps): React.JSX.Element | null {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const listContainerRef = useRef<HTMLDivElement | null>(null)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)

  const activeNotes = useMemo(
    () => notes.filter((n) => !n.trashed),
    [notes]
  )

  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setActiveIndex(0)
      const id = window.requestAnimationFrame(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      })
      return () => window.cancelAnimationFrame(id)
    }
  }, [isOpen])

  const results = useMemo<GlobalSearchResultItem[]>(() => {
    const q = query.trim()

    // When input is empty, show recent notes so the user can immediately navigate with keyboard/mouse
    if (!q) {
      return [...activeNotes]
        .sort((a, b) => {
          if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
          return b.updatedAt - a.updatedAt
        })
        .slice(0, 14)
        .map((note) => ({
          id: `recent:${note.relativePath}`,
          source: 'title' as const,
          sourceLabel: 'Nota Recente',
          locationTitle: note.title,
          locationSubtitle: note.folder ? `📁 ${note.folder}` : 'Notas Locais',
          matchedSnippet:
            note.preview && note.preview !== 'Sem texto adicional'
              ? note.preview
              : cleanMarkdownLine(note.content.slice(0, 140)) || 'Nota sem texto adicional',
          score: 100,
          updatedAt: note.updatedAt,
          noteRelativePath: note.relativePath
        }))
    }

    const qWithoutHash = q.startsWith('#') ? q.slice(1) : q
    const items: GlobalSearchResultItem[] = []

    // 1. Search across Folders (Título de Pasta)
    for (const folder of folders) {
      const folderMatch = scoreFuzzyMatch(folder, q)
      if (folderMatch.score > 0) {
        const folderNotes = activeNotes
          .filter(
            (n) => n.folder === folder || n.folder.startsWith(`${folder}/`)
          )
          .sort((a, b) => b.updatedAt - a.updatedAt)
        const topNote = folderNotes[0]

        items.push({
          id: `folder:${folder}`,
          source: 'folder',
          sourceLabel: 'Pasta',
          locationTitle: folder.split('/').pop() || folder,
          locationSubtitle: `Pasta • ${folderNotes.length} ${
            folderNotes.length === 1 ? 'nota' : 'notas'
          }`,
          matchedSnippet: topNote
            ? `Última nota: "${topNote.title}" — ${topNote.preview}`
            : `Abrir pasta "${folder}"`,
          score: folderMatch.score + 12,
          updatedAt: topNote?.updatedAt ?? 0,
          noteRelativePath: topNote?.relativePath,
          folderPath: folder
        })
      }
    }

    // 2. Search across Notes: Tag, Título de Nota, Pasta da Nota e Conteúdo da Nota
    for (const note of activeNotes) {
      const folderLabel = note.folder ? `📁 ${note.folder}` : 'Notas Locais'

      // 2a. Check Tags (#tag)
      let bestTag = ''
      let bestTagScore = 0
      for (const tag of note.tags) {
        const { score } = scoreFuzzyMatch(tag, qWithoutHash || q)
        if (score > bestTagScore) {
          bestTagScore = score
          bestTag = tag
        }
      }
      if (bestTagScore > 0) {
        const snippetFromContent = extractContentSnippet(
          note.content,
          `#${bestTag}`
        ).snippet
        items.push({
          id: `tag:${note.relativePath}:${bestTag}`,
          source: 'tag',
          sourceLabel: 'Tag',
          locationTitle: `#${bestTag} — ${note.title}`,
          locationSubtitle: `${folderLabel} • Tag #${bestTag}`,
          matchedSnippet:
            snippetFromContent || note.preview || `Nota marcada com #${bestTag}`,
          score: bestTagScore + 24,
          updatedAt: note.updatedAt,
          noteRelativePath: note.relativePath,
          tag: bestTag
        })
      }

      // 2b. Check Note Title (Título de Nota)
      const titleMatch = scoreFuzzyMatch(note.title, q)
      if (titleMatch.score > 0) {
        const contentCtx = extractContentSnippet(note.content, q)
        items.push({
          id: `title:${note.relativePath}`,
          source: 'title',
          sourceLabel: 'Título da Nota',
          locationTitle: note.title,
          locationSubtitle: folderLabel,
          matchedSnippet:
            contentCtx.snippet ||
            note.preview ||
            cleanMarkdownLine(note.content.slice(0, 130)),
          score: titleMatch.score + 20,
          updatedAt: note.updatedAt,
          noteRelativePath: note.relativePath
        })
      }

      // 2c. Check Note Content (Conteúdo da Nota)
      const contentMatch = extractContentSnippet(note.content, q)
      if (contentMatch.score > 0) {
        items.push({
          id: `content:${note.relativePath}`,
          source: 'content',
          sourceLabel: 'Conteúdo da Nota',
          locationTitle: note.title,
          locationSubtitle: `${folderLabel}${
            note.tags.length > 0
              ? ` • ${note.tags.slice(0, 2).map((t) => `#${t}`).join(' ')}`
              : ''
          }`,
          matchedSnippet: contentMatch.snippet || note.preview,
          score: contentMatch.score,
          updatedAt: note.updatedAt,
          noteRelativePath: note.relativePath
        })
      } else if (note.folder && titleMatch.score === 0 && bestTagScore === 0) {
        // 2d. Note inside a matched folder name
        const noteFolderMatch = scoreFuzzyMatch(note.folder, q)
        if (noteFolderMatch.score > 0) {
          items.push({
            id: `notefolder:${note.relativePath}`,
            source: 'folder',
            sourceLabel: 'Nota na Pasta',
            locationTitle: note.title,
            locationSubtitle: `📁 ${note.folder}`,
            matchedSnippet: note.preview,
            score: noteFolderMatch.score,
            updatedAt: note.updatedAt,
            noteRelativePath: note.relativePath,
            folderPath: note.folder
          })
        }
      }
    }

    return items
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score
        return b.updatedAt - a.updatedAt
      })
      .slice(0, 30)
  }, [query, activeNotes, folders])

  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  useEffect(() => {
    const container = listContainerRef.current
    if (!container) return
    const activeEl = container.querySelector<HTMLElement>(
      `[data-search-index="${activeIndex}"]`
    )
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' })
    }
  }, [activeIndex])

  const handleConfirmResult = (item: GlobalSearchResultItem | undefined) => {
    if (!item) return
    if (item.folderPath && !item.noteRelativePath) {
      onSelectFilter({ kind: 'folder', folderPath: item.folderPath })
      onClose()
      return
    }
    if (item.noteRelativePath) {
      onSelectNote(item.noteRelativePath)
      onClose()
    }
  }

  if (!isOpen) return null

  const renderSourceBadge = (source: GlobalSearchMatchSource, label: string) => {
    const Icon =
      source === 'tag'
        ? Hash
        : source === 'folder'
          ? Folder
          : source === 'title'
            ? FileText
            : TextSelect

    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary shrink-0">
        <Icon className="size-2.5" />
        <span>{label}</span>
      </span>
    )
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Busca Global Rys MD"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/72 backdrop-blur-md pt-[8vh] px-4 select-none animate-in fade-in duration-150"
    >
      {/* Modal retangular estilo daily.dev ocupando ~54% da tela a partir do centro superior */}
      <div
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault()
            e.stopPropagation()
            onClose()
            return
          }
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            if (results.length > 0) {
              setActiveIndex((prev) => (prev + 1) % results.length)
            }
            return
          }
          if (e.key === 'ArrowUp') {
            e.preventDefault()
            if (results.length > 0) {
              setActiveIndex((prev) => (prev - 1 + results.length) % results.length)
            }
            return
          }
          if (e.key === 'Enter') {
            e.preventDefault()
            handleConfirmResult(results[activeIndex] ?? results[0])
          }
        }}
        className="rys-glass-popover w-[94vw] md:w-[54vw] min-w-[340px] max-w-[920px] max-h-[80vh] flex flex-col overflow-hidden rounded-2xl border border-border/80 shadow-2xl text-foreground"
      >
        {/* Barra Superior de Busca Elegante (inspirada no daily.dev) */}
        <div className="relative flex items-center gap-3 border-b border-border/60 bg-background/45 px-4 py-3.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/30">
            <Search className="size-4" />
          </div>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Busca Global (Fuzzy Search): pesquise por #tag, título de nota, pasta ou conteúdo..."
            className="w-full bg-transparent text-sm font-medium text-foreground placeholder:text-muted-foreground/75 focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('')
                inputRef.current?.focus()
              }}
              title="Limpar busca"
              className="rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
            >
              <X className="size-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            title="Fechar Busca Global (Esc)"
            className="rounded-lg border border-border/70 bg-muted/40 px-2 py-1 text-[10.5px] font-semibold text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer shrink-0"
          >
            ESC
          </button>
        </div>

        {/* Cabeçalho das 2 Colunas: Esquerda (Local Encontrado) | Direita (Conteúdo) */}
        <div className="grid grid-cols-12 items-center border-b border-border/45 bg-muted/25 px-4 py-2 text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">
          <div className="col-span-5 flex items-center gap-1.5 pr-3">
            <Sparkles className="size-3 text-primary" />
            <span>
              {query.trim() ? 'Local Encontrado' : 'Notas Recentes'} (
              {results.length})
            </span>
          </div>
          <div className="col-span-7 pl-3 border-l border-border/40">
            <span>Conteúdo / Trecho Relacionado</span>
          </div>
        </div>

        {/* Lista de Resultados em Duas Colunas com Navegação Teclado + Mouse */}
        <div
          ref={listContainerRef}
          role="listbox"
          aria-label="Resultados da Busca Global"
          className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-sleek"
        >
          {results.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 px-4 text-center">
              <div className="mb-3 flex size-11 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                <Search className="size-5" />
              </div>
              <p className="text-sm font-semibold text-foreground mb-1">
                Nenhum resultado encontrado para &ldquo;{query}&rdquo;
              </p>
              <p className="text-xs text-muted-foreground max-w-md">
                Tente buscar por parte de uma <code>#tag</code>, nome de pasta, título de nota ou qualquer palavra dentro das suas anotações.
              </p>
            </div>
          ) : (
            results.map((item, idx) => {
              const isSelected = idx === activeIndex

              return (
                <div
                  key={item.id}
                  role="option"
                  aria-selected={isSelected}
                  data-search-index={idx}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => handleConfirmResult(item)}
                  className={cn(
                    'group grid grid-cols-12 items-center rounded-xl px-3 py-2.5 transition-all cursor-pointer border',
                    isSelected
                      ? 'border-primary/65 bg-primary/16 shadow-xs ring-1 ring-primary/30'
                      : 'border-transparent hover:border-primary/35 hover:bg-primary/10'
                  )}
                >
                  {/* Coluna da Esquerda: Local Encontrado (Tipo + Título/Tag/Pasta + Subtítulo) */}
                  <div className="col-span-5 flex flex-col gap-1 pr-3 min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {renderSourceBadge(item.source, item.sourceLabel)}
                      <span
                        className={cn(
                          'truncate text-xs font-semibold transition-colors',
                          isSelected ? 'text-primary' : 'text-foreground'
                        )}
                      >
                        {renderHighlightedText(item.locationTitle, query)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground truncate">
                      <span className="truncate">{item.locationSubtitle}</span>
                      {item.updatedAt > 0 && (
                        <span className="shrink-0 tabular-nums text-[10px] opacity-80">
                          {formatAppleNotesDate(item.updatedAt)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Coluna da Direita: Conteúdo Encontrado */}
                  <div className="col-span-7 flex items-center justify-between gap-2 pl-3 border-l border-border/45 min-w-0">
                    <p
                      className={cn(
                        'line-clamp-2 text-xs leading-relaxed break-words min-w-0 flex-1',
                        isSelected
                          ? 'text-foreground font-medium'
                          : 'text-muted-foreground group-hover:text-foreground/90'
                      )}
                    >
                      {renderHighlightedText(item.matchedSnippet, query)}
                    </p>
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold transition-opacity shrink-0',
                        isSelected
                          ? 'bg-primary text-primary-foreground opacity-100'
                          : 'opacity-0 group-hover:opacity-80 bg-accent text-foreground'
                      )}
                    >
                      <CornerDownLeft className="size-2.5" />
                      <span>Abrir</span>
                    </span>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Rodapé com Dicas de Navegação */}
        <div className="flex items-center justify-between border-t border-border/50 bg-background/50 px-4 py-2 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <kbd className="inline-flex items-center justify-center rounded border border-border bg-muted/60 px-1 py-0.5 text-[10px]">
                <ArrowUp className="size-2.5" />
              </kbd>
              <kbd className="inline-flex items-center justify-center rounded border border-border bg-muted/60 px-1 py-0.5 text-[10px]">
                <ArrowDown className="size-2.5" />
              </kbd>
              <span>Navegar</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <kbd className="inline-flex items-center justify-center rounded border border-border bg-muted/60 px-1.5 py-0.5 text-[10px] font-semibold">
                Enter
              </kbd>
              <span>Abrir nota</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <kbd className="inline-flex items-center justify-center rounded border border-border bg-muted/60 px-1.5 py-0.5 text-[10px] font-semibold">
                Esc
              </kbd>
              <span>Fechar</span>
            </span>
          </div>
          <span className="hidden sm:inline text-[10.5px] text-primary font-medium">
            Busca Global Fuzzy • Ctrl + K
          </span>
        </div>
      </div>
    </div>
  )
}
