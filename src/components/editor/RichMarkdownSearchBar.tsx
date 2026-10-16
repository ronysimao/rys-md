import React, { type RefObject } from 'react'
import {
  CaseSensitive,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Replace,
  ReplaceAll,
  WholeWord,
  X
} from 'lucide-react'

type RichMarkdownSearchBarProps = {
  activeMatchIndex: number
  isOpen: boolean
  isReplaceMode: boolean
  matchCase: boolean
  matchCount: number
  query: string
  replaceQuery: string
  replaceDisabled?: boolean
  placeholder?: string
  searchInputRef: RefObject<HTMLInputElement | null>
  wholeWord: boolean
  onClose: () => void
  onMoveToMatch: (direction: 1 | -1) => void
  onQueryChange: (value: string) => void
  onReplaceAll: () => void
  onReplaceCurrent: () => void
  onReplaceQueryChange: (value: string) => void
  onToggleMatchCase: () => void
  onToggleReplaceMode: () => void
  onToggleWholeWord: () => void
}

export function RichMarkdownSearchBar({
  activeMatchIndex,
  isOpen,
  isReplaceMode,
  matchCase,
  matchCount,
  query,
  replaceQuery,
  replaceDisabled = false,
  placeholder = 'Buscar no editor visual',
  searchInputRef,
  wholeWord,
  onClose,
  onMoveToMatch,
  onQueryChange,
  onReplaceAll,
  onReplaceCurrent,
  onReplaceQueryChange,
  onToggleMatchCase,
  onToggleReplaceMode,
  onToggleWholeWord
}: RichMarkdownSearchBarProps): React.JSX.Element | null {
  if (!isOpen) {
    return null
  }

  const keepSearchFocus = (event: React.MouseEvent<HTMLButtonElement>): void => {
    event.preventDefault()
  }

  const noMatches = matchCount === 0

  return (
    <div
      className="rich-markdown-search rys-glass-popover"
      onKeyDown={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        onMouseDown={keepSearchFocus}
        onClick={onToggleReplaceMode}
        title={isReplaceMode ? 'Ocultar substituir' : 'Alternar substituir (Ctrl+H)'}
        aria-label="Alternar substituir"
        aria-expanded={isReplaceMode}
        className="rich-markdown-search-toggle cursor-pointer inline-flex items-center justify-center"
      >
        {isReplaceMode ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>
      <div className="rich-markdown-search-rows">
        <div className="rich-markdown-search-row">
          <div className="rich-markdown-search-field">
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.nativeEvent.isComposing) {
                  return
                }
                if (event.key === 'Enter' && event.shiftKey) {
                  event.preventDefault()
                  onMoveToMatch(-1)
                  return
                }
                if (event.key === 'Enter') {
                  event.preventDefault()
                  onMoveToMatch(1)
                  return
                }
                if (event.key === 'Escape') {
                  event.preventDefault()
                  onClose()
                }
              }}
              placeholder={placeholder}
              className="rich-markdown-search-input h-7 border-0 bg-transparent px-2 text-foreground outline-none"
              aria-label={placeholder}
            />
            <button
              type="button"
              onMouseDown={keepSearchFocus}
              onClick={onToggleMatchCase}
              data-active={matchCase ? 'true' : undefined}
              aria-pressed={matchCase}
              title="Diferenciar maiúsculas/minúsculas"
              aria-label="Diferenciar maiúsculas/minúsculas"
              className="rich-markdown-search-option cursor-pointer inline-flex items-center justify-center"
            >
              <CaseSensitive size={14} />
            </button>
            <button
              type="button"
              onMouseDown={keepSearchFocus}
              onClick={onToggleWholeWord}
              data-active={wholeWord ? 'true' : undefined}
              aria-pressed={wholeWord}
              title="Palavra inteira"
              aria-label="Palavra inteira"
              className="rich-markdown-search-option cursor-pointer inline-flex items-center justify-center"
            >
              <WholeWord size={14} />
            </button>
          </div>
          <div className="rich-markdown-search-status select-none">
            {query && noMatches
              ? 'Sem resultados'
              : `${noMatches ? 0 : activeMatchIndex + 1}/${matchCount}`}
          </div>
          <button
            type="button"
            onMouseDown={keepSearchFocus}
            onClick={() => onMoveToMatch(-1)}
            disabled={noMatches}
            title="Ocorrência anterior (Shift+Enter)"
            aria-label="Ocorrência anterior"
            className="rich-markdown-search-button cursor-pointer inline-flex items-center justify-center disabled:opacity-35"
          >
            <ChevronUp size={14} />
          </button>
          <button
            type="button"
            onMouseDown={keepSearchFocus}
            onClick={() => onMoveToMatch(1)}
            disabled={noMatches}
            title="Próxima ocorrência (Enter)"
            aria-label="Próxima ocorrência"
            className="rich-markdown-search-button cursor-pointer inline-flex items-center justify-center disabled:opacity-35"
          >
            <ChevronDown size={14} />
          </button>
          <div className="rich-markdown-search-divider" />
          <button
            type="button"
            onMouseDown={keepSearchFocus}
            onClick={onClose}
            title="Fechar busca (Esc)"
            aria-label="Fechar busca"
            className="rich-markdown-search-button cursor-pointer inline-flex items-center justify-center"
          >
            <X size={14} />
          </button>
        </div>
        {isReplaceMode ? (
          <div className="rich-markdown-search-row">
            <div className="rich-markdown-search-field">
              <input
                type="text"
                value={replaceQuery}
                onChange={(event) => onReplaceQueryChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.nativeEvent.isComposing) {
                    return
                  }
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    onReplaceCurrent()
                    return
                  }
                  if (event.key === 'Escape') {
                    event.preventDefault()
                    onClose()
                  }
                }}
                placeholder="Substituir"
                className="rich-markdown-search-input h-7 border-0 bg-transparent px-2 text-foreground outline-none"
                aria-label="Substituir no editor"
              />
            </div>
            <button
              type="button"
              onMouseDown={keepSearchFocus}
              onClick={onReplaceCurrent}
              disabled={noMatches || replaceDisabled}
              title="Substituir ocorrência atual (Enter)"
              aria-label="Substituir"
              className="rich-markdown-search-button cursor-pointer inline-flex items-center justify-center disabled:opacity-35"
            >
              <Replace size={14} />
            </button>
            <button
              type="button"
              onMouseDown={keepSearchFocus}
              onClick={onReplaceAll}
              disabled={noMatches || replaceDisabled}
              title="Substituir todas as ocorrências"
              aria-label="Substituir tudo"
              className="rich-markdown-search-button cursor-pointer inline-flex items-center justify-center disabled:opacity-35"
            >
              <ReplaceAll size={14} />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
