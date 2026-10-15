import React, { useCallback, useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { NodeViewContent, NodeViewWrapper } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import { Copy, Check } from 'lucide-react'
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
  const [languageListMounted, setLanguageListMounted] = useState(false)
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

  const mountLanguageList = useCallback(() => {
    if (languageListMounted) return
    flushSync(() => setLanguageListMounted(true))
  }, [languageListMounted])

  const onChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      updateAttributes({ language: e.target.value })
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

  return (
    <NodeViewWrapper className="rich-markdown-code-block-wrapper">
      <select
        className="rich-markdown-code-block-lang cursor-pointer"
        contentEditable={false}
        value={language}
        onChange={onChange}
        onMouseDown={mountLanguageList}
        onFocus={mountLanguageList}
      >
        {languageListMounted ? (
          getCodeBlockLanguages().map((lang) => (
            <option key={lang.value} value={lang.value}>
              {lang.label}
            </option>
          ))
        ) : (
          <option value={language}>{getCodeBlockLanguageLabel(language)}</option>
        )}
        {languageListMounted && language && !isKnownCodeBlockLanguage(language) ? (
          <option key={language} value={language}>
            {language}
          </option>
        ) : null}
      </select>
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
            <Check size={14} />
            <span className="code-block-copy-label text-[11px] ml-1">Copiado</span>
          </>
        ) : (
          <Copy size={14} />
        )}
      </button>
      <NodeViewContent<'pre'> as="pre" />
      {isMermaid && node.textContent.trim() && (
        <div contentEditable={false} className="mermaid-preview">
          <MermaidBlock content={node.textContent.trim()} isDark={isDark} htmlLabels={false} />
        </div>
      )}
    </NodeViewWrapper>
  )
}
