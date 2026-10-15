import React, { useEffect, useRef } from 'react'
import type { Editor } from '@tiptap/react'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  runSlashCommand,
  type SlashCommand,
  type SlashMenuState
} from './rich-markdown-slash-commands'

type RichMarkdownSlashMenuProps = {
  editor: Editor | null
  slashMenu: SlashMenuState
  filteredCommands: SlashCommand[]
  selectedIndex: number
  onImagePick: () => void
}

export function RichMarkdownSlashMenu({
  editor,
  slashMenu,
  filteredCommands,
  selectedIndex,
  onImagePick
}: RichMarkdownSlashMenuProps): React.JSX.Element {
  const resultsRef = useRef<HTMLDivElement | null>(null)
  let currentGroup: SlashCommand['group'] | null = null

  useEffect(() => {
    const container = resultsRef.current
    if (!container) return
    if (selectedIndex === 0) {
      container.scrollTop = 0
      return
    }
    const activeEl = container.querySelector<HTMLElement>(
      `[data-slash-index="${selectedIndex}"]`
    )
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex, filteredCommands.length])

  return (
    <div
      className="rich-markdown-slash-menu"
      style={{ left: slashMenu.left, top: slashMenu.top }}
      role="dialog"
      aria-label="Comandos Slash"
    >
      <div
        className="rich-markdown-slash-search"
        onMouseDown={(event) => event.preventDefault()}
      >
        <Search className="size-3.5 shrink-0" />
        <input
          aria-label="Buscar blocos"
          readOnly
          type="text"
          value={slashMenu.query}
          placeholder="Buscar blocos..."
        />
      </div>
      <div
        ref={resultsRef}
        className="rich-markdown-slash-results scrollbar-sleek"
        role="listbox"
      >
        {filteredCommands.length === 0 ? (
          <div className="rich-markdown-slash-empty">Nenhum bloco encontrado</div>
        ) : (
          filteredCommands.map((command, index) => {
            const showGroup = command.group !== currentGroup
            currentGroup = command.group
            return (
              <React.Fragment key={command.id}>
                {showGroup ? (
                  <div className="rich-markdown-slash-section">{command.group}</div>
                ) : null}
                <button
                  type="button"
                  data-slash-index={index}
                  title={command.description}
                  role="option"
                  aria-selected={index === selectedIndex}
                  className={cn(
                    'rich-markdown-slash-item cursor-pointer',
                    index === selectedIndex && 'is-active'
                  )}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() =>
                    editor && runSlashCommand(editor, slashMenu, command, onImagePick)
                  }
                >
                  <span className="rich-markdown-slash-icon">
                    {command.icon.kind === 'component' ? (
                      <command.icon.component className="size-3.5" />
                    ) : (
                      <span className="text-sm leading-none">{command.icon.value}</span>
                    )}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col items-start">
                    <span className="truncate text-[13px] font-medium leading-4">
                      {command.label}
                    </span>
                    <span className="truncate text-[11px] text-muted-foreground leading-4">
                      {command.description}
                    </span>
                  </span>
                </button>
              </React.Fragment>
            )
          })
        )}
      </div>
    </div>
  )
}
