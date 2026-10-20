import React, { useCallback, useEffect, useRef, useState } from 'react'
import { NodeViewContent, NodeViewWrapper } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import { Copy, Check, ChevronDown } from 'lucide-react'
import MermaidBlock from './MermaidBlock'
import {
  getCodeBlockLanguageLabel,
  getCodeBlockLanguages,
  isKnownCodeBlockLanguage
} from './rich-markdown-code-block-languages'

export function RichMarkdownCodeBlock({
  node,
  updateAttributes
}: NodeViewProps): React.JSX.Element {
  const language = (node.attrs.language as string) || ''
  const [copied, setCopied] = useState(false)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownContainerRef = useRef<HTMLDivElement | null>(null)
  const copiedResetTimerRef = useRef<number | null>(null)
  const isMountedRef = useRef(false)
  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains('dark')
  )

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'))
    })
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!isDropdownOpen) return
    const handlePointerDownOutside = (e: MouseEvent) => {
      if (
        dropdownContainerRef.current &&
        !dropdownContainerRef.current.contains(e.target as Node)
      ) {
        setIsDropdownOpen(false)
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handlePointerDownOutside, true)
    document.addEventListener('keydown', handleKeyDown, true)
    return () => {
      document.removeEventListener('mousedown', handlePointerDownOutside, true)
      document.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [isDropdownOpen])

  const isMermaid = language === 'mermaid'

  const clearCopiedResetTimer = useCallback((): void => {
    if (copiedResetTimerRef.current !== null) {
      window.clearTimeout(copiedResetTimerRef.current)
      copiedResetTimerRef.current = null
    }
  }, [])

  const setCopyButtonRef = useCallback(
    (btn: HTMLButtonElement | null) => {
      isMountedRef.current = btn !== null
      if (btn === null) {
        clearCopiedResetTimer()
      }
    },
    [clearCopiedResetTimer]
  )

  const handleSelectLanguage = useCallback(
    (nextLang: string) => {
      updateAttributes({ language: nextLang })
      setIsDropdownOpen(false)
    },
    [updateAttributes]
  )

  const handleCopy = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      const text = node.textContent
      void navigator.clipboard
        .writeText(text)
        .then(() => {
          if (!isMountedRef.current) return
          clearCopiedResetTimer()
          setCopied(true)
          copiedResetTimerRef.current = window.setTimeout(() => {
            copiedResetTimerRef.current = null
            setCopied(false)
          }, 1500)
        })
        .catch(() => {})
    },
    [clearCopiedResetTimer, node]
  )

  const languages = getCodeBlockLanguages()
  const hasCustomUnknownLang = Boolean(
    language && !isKnownCodeBlockLanguage(language)
  )

  return (
    <NodeViewWrapper className="rich-markdown-code-block-wrapper">
      <div
        contentEditable={false}
        className="rich-markdown-code-block-actions"
      >
        <button
          ref={setCopyButtonRef}
          type="button"
          className="code-block-copy-btn cursor-pointer"
          contentEditable={false}
          onClick={handleCopy}
          aria-label="Copiar código"
          title="Copiar código"
        >
          {copied ? (
            <>
              <Check size={13} />
              <span className="code-block-copy-label text-[11px] ml-1">Copiado</span>
            </>
          ) : (
            <Copy size={13} />
          )}
        </button>

        <div
          ref={dropdownContainerRef}
          className="rich-markdown-code-block-lang-container"
        >
          <button
            type="button"
            className="rich-markdown-code-block-lang cursor-pointer"
            onMouseDown={(e) => {
              e.preventDefault()
              e.stopPropagation()
            }}
            onClick={(e) => {
              e.stopPropagation()
              setIsDropdownOpen((prev) => !prev)
            }}
            title="Selecionar linguagem do bloco de código"
            aria-expanded={isDropdownOpen}
          >
            <span>{getCodeBlockLanguageLabel(language)}</span>
            <ChevronDown
              size={12}
              className={`transition-transform duration-150 ${isDropdownOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {isDropdownOpen && (
            <div
              role="listbox"
              className="rich-markdown-code-block-dropdown scrollbar-sleek"
              onMouseDown={(e) => {
                e.preventDefault()
                e.stopPropagation()
              }}
            >
              {languages.map((lang) => {
                const isSelected = lang.value === language
                return (
                  <button
                    key={lang.value || '__plain__'}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleSelectLanguage(lang.value)
                    }}
                    className={`rich-markdown-code-block-option cursor-pointer ${
                      isSelected ? 'is-selected' : ''
                    }`}
                  >
                    <span>{lang.label}</span>
                    {isSelected && <Check size={12} className="shrink-0" />}
                  </button>
                )
              })}
              {hasCustomUnknownLang && (
                <button
                  type="button"
                  role="option"
                  aria-selected={true}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleSelectLanguage(language)
                  }}
                  className="rich-markdown-code-block-option is-selected cursor-pointer"
                >
                  <span>{language}</span>
                  <Check size={12} className="shrink-0" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <NodeViewContent<'pre'> as="pre" />
      {isMermaid && node.textContent.trim() && (
        <div contentEditable={false} className="mermaid-preview">
          <MermaidBlock content={node.textContent.trim()} isDark={isDark} htmlLabels={false} />
        </div>
      )}
    </NodeViewWrapper>
  )
}
