import React, { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, ListTree, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  TABLE_OF_CONTENTS_LEVELS,
  areAllLevelNodesCollapsed,
  buildTableOfContentsTree,
  collectBranchIdsByLevels,
  getCollapsibleTableOfContentsLevels,
  type TableOfContentsItem,
  type TableOfContentsTreeNode
} from './markdown-table-of-contents'

const MIN_TOC_WIDTH = 150

type MarkdownTableOfContentsPanelProps = {
  items: TableOfContentsItem[]
  isOpen: boolean
  width: number
  isResizing: boolean
  onSelect: (item: TableOfContentsItem) => void
  onClose: () => void
  onStartResize: (e: React.MouseEvent) => void
}

type MarkdownTableOfContentsRowProps = {
  node: TableOfContentsTreeNode
  depth: number
  collapsedIds: ReadonlySet<string>
  onToggleCollapse: (id: string) => void
  onSelect: (item: TableOfContentsItem) => void
}

function MarkdownTableOfContentsRow({
  node,
  depth,
  collapsedIds,
  onToggleCollapse,
  onSelect
}: MarkdownTableOfContentsRowProps): React.JSX.Element {
  const hasChildren = node.children.length > 0
  const isCollapsed = hasChildren && collapsedIds.has(node.id)

  return (
    <div className="markdown-toc-node">
      <div
        className="markdown-toc-row flex items-center gap-0.5 rounded-lg pr-1.5 transition-colors hover:bg-accent/70"
        style={{ paddingLeft: `${6 + depth * 12}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            aria-label={`${isCollapsed ? 'Expandir' : 'Recolher'} ${node.text}`}
            onClick={() => onToggleCollapse(node.id)}
            className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer"
          >
            {isCollapsed ? (
              <ChevronRight className="size-3.5" />
            ) : (
              <ChevronDown className="size-3.5" />
            )}
          </button>
        ) : (
          <span className="size-5 shrink-0" aria-hidden="true" />
        )}
        <button
          type="button"
          title={`H${node.level}: ${node.text}`}
          onClick={() => onSelect(node)}
          className={cn(
            'min-w-0 flex-1 truncate rounded py-1 pr-1.5 text-left text-xs transition-colors cursor-pointer',
            node.level === 1 && 'font-semibold text-foreground',
            node.level === 2 && 'font-medium text-foreground/90',
            node.level >= 3 && 'text-muted-foreground hover:text-foreground'
          )}
        >
          {node.text}
        </button>
      </div>
      {hasChildren && !isCollapsed ? (
        <div className="markdown-toc-children">
          {node.children.map((child) => (
            <MarkdownTableOfContentsRow
              key={child.id}
              node={child}
              depth={depth + 1}
              collapsedIds={collapsedIds}
              onToggleCollapse={onToggleCollapse}
              onSelect={onSelect}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function MarkdownTableOfContentsPanel({
  items,
  isOpen,
  width,
  isResizing,
  onSelect,
  onClose,
  onStartResize
}: MarkdownTableOfContentsPanelProps): React.JSX.Element {
  const tree = useMemo(() => buildTableOfContentsTree(items), [items])
  const collapsibleLevels = useMemo(
    () => getCollapsibleTableOfContentsLevels(tree),
    [tree]
  )
  const [collapsedLevels, setCollapsedLevels] = useState<
    Set<TableOfContentsItem['level']>
  >(() => new Set())
  const [manualCollapsedIds, setManualCollapsedIds] = useState<Set<string>>(
    () => new Set()
  )
  const [manualExpandedIds, setManualExpandedIds] = useState<Set<string>>(
    () => new Set()
  )

  useEffect(() => {
    setCollapsedLevels((current) => {
      const next = new Set(
        Array.from(current).filter((level) => collapsibleLevels.has(level))
      )
      return next.size === current.size ? current : next
    })
    setManualCollapsedIds((current) => (current.size === 0 ? current : new Set()))
    setManualExpandedIds((current) => (current.size === 0 ? current : new Set()))
  }, [collapsibleLevels, items])

  const collapsedIds = useMemo(() => {
    const next = collectBranchIdsByLevels(tree, collapsedLevels)
    manualCollapsedIds.forEach((id) => next.add(id))
    manualExpandedIds.forEach((id) => next.delete(id))
    return next
  }, [collapsedLevels, manualCollapsedIds, manualExpandedIds, tree])

  const handleToggleCollapse = (id: string) => {
    const isCurrentlyCollapsed = collapsedIds.has(id)
    if (isCurrentlyCollapsed) {
      setManualCollapsedIds((current) => {
        if (!current.has(id)) return current
        const next = new Set(current)
        next.delete(id)
        return next
      })
      setManualExpandedIds((current) => {
        const next = new Set(current)
        next.add(id)
        return next
      })
      return
    }

    setManualExpandedIds((current) => {
      if (!current.has(id)) return current
      const next = new Set(current)
      next.delete(id)
      return next
    })
    setManualCollapsedIds((current) => {
      const next = new Set(current)
      next.add(id)
      return next
    })
  }

  const handleToggleLevelCollapse = (level: TableOfContentsItem['level']) => {
    if (!collapsibleLevels.has(level)) return

    const levelIds = collectBranchIdsByLevels(tree, new Set([level]))
    const shouldCollapseLevel = !areAllLevelNodesCollapsed(
      tree,
      level,
      collapsedIds
    )

    setCollapsedLevels((current) => {
      const next = new Set(current)
      if (shouldCollapseLevel) {
        next.add(level)
      } else {
        next.delete(level)
      }
      return next
    })
    setManualCollapsedIds((current) => {
      const next = new Set(current)
      levelIds.forEach((id) => next.delete(id))
      return next
    })
    setManualExpandedIds((current) => {
      const next = new Set(current)
      levelIds.forEach((id) => next.delete(id))
      return next
    })
  }

  return (
    <>
      {/* Linha divisória redimensionável (min 150px, <150px recolhe suavemente) */}
      {isOpen && (
        <div
          role="separator"
          aria-orientation="vertical"
          title="Arraste para redimensionar o Sumário (menos de 150px oculta)"
          onMouseDown={onStartResize}
          style={{ cursor: 'ew-resize' }}
          className="rys-column-resizer group relative z-40 -mx-1.5 w-3 shrink-0 cursor-ew-resize flex items-center justify-center select-none print:hidden"
        >
          <div
            style={{ cursor: 'ew-resize' }}
            className={cn(
              'h-full w-[2px] cursor-ew-resize transition-colors',
              isResizing
                ? 'bg-primary'
                : 'bg-transparent group-hover:bg-primary/60'
            )}
          />
        </div>
      )}

      <aside
        aria-hidden={!isOpen}
        aria-label="Table of Contents"
        style={{ width: isOpen ? `${Math.max(MIN_TOC_WIDTH, width)}px` : 0 }}
        className={cn(
          'rys-glass-sidebar flex h-full shrink-0 flex-col select-none overflow-hidden print:hidden',
          !isResizing &&
            'transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
          isOpen
            ? 'opacity-100 translate-x-0 border-l border-border/60'
            : 'opacity-0 translate-x-4 pointer-events-none border-l-0'
        )}
      >
        <div className="flex h-full w-full min-w-[150px] flex-col">
          {/* Header com título e filtros de nível H1..H5 estilo Orca ADE */}
          <div className="flex flex-col gap-2 border-b border-border/50 px-3 py-2.5 shrink-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground truncate">
                <ListTree className="size-3.5 text-primary shrink-0" />
                <span className="truncate">Table of Contents</span>
              </div>
              <button
                type="button"
                onClick={onClose}
                title="Fechar Table of Contents"
                className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer shrink-0"
              >
                <X className="size-3.5" />
              </button>
            </div>

            {collapsibleLevels.size > 0 && (
              <div
                className="flex items-center gap-1"
                role="group"
                aria-label="Controles de nível de cabeçalho"
              >
                {TABLE_OF_CONTENTS_LEVELS.filter((level) =>
                  collapsibleLevels.has(level)
                ).map((level) => {
                  const isCollapsed = areAllLevelNodesCollapsed(
                    tree,
                    level,
                    collapsedIds
                  )
                  return (
                    <button
                      key={level}
                      type="button"
                      aria-label={`${isCollapsed ? 'Expandir' : 'Recolher'} cabeçalhos H${level}`}
                      title={`${isCollapsed ? 'Expandir' : 'Recolher'} H${level}`}
                      onClick={() => handleToggleLevelCollapse(level)}
                      className={cn(
                        'rounded px-1.5 py-0.5 text-[10.5px] font-semibold transition-colors cursor-pointer',
                        isCollapsed
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-accent/60 text-muted-foreground hover:bg-accent hover:text-foreground'
                      )}
                    >
                      H{level}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Lista de Títulos Hierárquica */}
          <div className="flex-1 overflow-y-auto px-2 py-2.5 scrollbar-sleek">
            {tree.length === 0 ? (
              <div className="px-2 py-6 text-center text-xs text-muted-foreground leading-relaxed">
                Adicione cabeçalhos Markdown (<code>#</code> a <code>#####</code>) para visualizar a estrutura do documento.
              </div>
            ) : (
              <div className="space-y-0.5">
                {tree.map((node) => (
                  <MarkdownTableOfContentsRow
                    key={node.id}
                    node={node}
                    depth={0}
                    collapsedIds={collapsedIds}
                    onToggleCollapse={handleToggleCollapse}
                    onSelect={onSelect}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  )
}
