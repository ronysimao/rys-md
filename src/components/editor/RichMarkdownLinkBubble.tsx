import React, { useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { Copy, ExternalLink, Pencil, Trash2, Check, X } from 'lucide-react'

export type LinkBubbleState = {
  href: string
  left: number
  top: number
}

export function getLinkBubblePosition(
  editor: Editor,
  rootEl: HTMLElement | null
): { left: number; top: number } | null {
  if (!rootEl) return null
  try {
    const { from } = editor.state.selection
    const coords = editor.view.coordsAtPos(from)
    const rect = rootEl.getBoundingClientRect()
    return {
      left: Math.max(12, Math.min(coords.left - rect.left, rect.width - 320)),
      top: coords.bottom - rect.top + 6
    }
  } catch {
    return null
  }
}

export function RichMarkdownLinkBubble({
  linkBubble,
  isEditing,
  onSave,
  onRemove,
  onEditStart,
  onCancel,
  onOpen
}: {
  linkBubble: LinkBubbleState
  isEditing: boolean
  onSave: (href: string) => void
  onRemove: () => void
  onEditStart: () => void
  onCancel: () => void
  onOpen: (href: string) => void
}): React.JSX.Element {
  const [value, setValue] = useState(linkBubble.href)
  const [copied, setCopied] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    setValue(linkBubble.href)
  }, [linkBubble.href])

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  return (
    <div
      className="rich-markdown-link-bubble"
      style={{ position: 'absolute', left: linkBubble.left, top: linkBubble.top }}
      onMouseDown={(e) => {
        if (!(e.target instanceof HTMLInputElement)) {
          e.preventDefault()
        }
      }}
    >
      {isEditing ? (
        <div className="flex items-center gap-1">
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="https://exemplo.com"
            className="rich-markdown-link-input"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                onSave(value.trim())
              } else if (e.key === 'Escape') {
                e.preventDefault()
                onCancel()
              }
            }}
          />
          <button
            type="button"
            title="Salvar link"
            onClick={() => onSave(value.trim())}
            className="rich-markdown-link-button cursor-pointer text-primary"
          >
            <Check size={14} />
          </button>
          <button
            type="button"
            title="Cancelar"
            onClick={onCancel}
            className="rich-markdown-link-button cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <>
          <span className="rich-markdown-link-url" title={linkBubble.href}>
            {linkBubble.href.length > 38
              ? `${linkBubble.href.slice(0, 38)}…`
              : linkBubble.href}
          </span>
          <button
            type="button"
            title="Abrir link"
            onClick={() => onOpen(linkBubble.href)}
            className="rich-markdown-link-button cursor-pointer"
          >
            <ExternalLink size={14} />
          </button>
          <button
            type="button"
            title="Copiar link"
            onClick={() => {
              void navigator.clipboard.writeText(linkBubble.href)
              setCopied(true)
              setTimeout(() => setCopied(false), 1200)
            }}
            className="rich-markdown-link-button cursor-pointer"
          >
            {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
          </button>
          <button
            type="button"
            title="Editar link"
            onClick={onEditStart}
            className="rich-markdown-link-button cursor-pointer"
          >
            <Pencil size={14} />
          </button>
          <button
            type="button"
            title="Remover link"
            onClick={onRemove}
            className="rich-markdown-link-button cursor-pointer text-red-400"
          >
            <Trash2 size={14} />
          </button>
        </>
      )}
    </div>
  )
}
