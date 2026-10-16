import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { EditorContent, useEditor, type Editor } from '@tiptap/react'
import CodeMirror from '@uiw/react-codemirror'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { oneDark } from '@codemirror/theme-one-dark'
import { EditorView } from '@codemirror/view'
import { createRichMarkdownExtensions } from './rich-markdown-extensions'
import { RichMarkdownToolbar } from './RichMarkdownToolbar'
import { RichMarkdownSlashMenu } from './RichMarkdownSlashMenu'
import {
  filterRichMarkdownSlashCommands,
  runSlashCommand,
  slashCommands,
  syncSlashMenu,
  type SlashCommand,
  type SlashMenuState
} from './rich-markdown-slash-commands'
import {
  RichMarkdownLinkBubble,
  getLinkBubblePosition,
  type LinkBubbleState
} from './RichMarkdownLinkBubble'
import { RichMarkdownTableControls } from './RichMarkdownTableControls'
import { vaultClient } from '@/lib/vault-client'
import { cn, formatFullDateTime } from '@/lib/utils'
import type { EditorMode } from '@/types/notes'

interface RichMarkdownEditorProps {
  noteId: string
  content: string
  createdAt: number
  vaultPath: string
  mode: EditorMode
  isDark: boolean
  readOnly?: boolean
  onContentChange: (nextMarkdown: string) => void
  onForceSave: (nextMarkdown: string) => void
}

interface ThickCaretState {
  top: number
  left: number
  height: number
}

function splitFrontmatter(raw: string): { frontmatter: string; body: string } {
  const match = raw.match(/^(---\r?\n[\s\S]*?\r?\n---\r?\n+)/)
  if (!match) return { frontmatter: '', body: raw }
  return {
    frontmatter: match[1],
    body: raw.slice(match[1].length)
  }
}

export function RichMarkdownEditor({
  noteId,
  content,
  createdAt,
  vaultPath,
  mode,
  isDark,
  readOnly = false,
  onContentChange,
  onForceSave
}: RichMarkdownEditorProps): React.JSX.Element {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const editorRef = useRef<Editor | null>(null)
  const frontmatterRef = useRef<string>('')
  const lastCommittedRef = useRef<string>(content)
  const isProgrammaticRef = useRef<boolean>(false)
  const debounceTimerRef = useRef<number | null>(null)
  const typingTimerRef = useRef<number | null>(null)

  // Always keep latest callbacks in refs to avoid stale closures on note switch
  const onContentChangeRef = useRef(onContentChange)
  onContentChangeRef.current = onContentChange
  const onForceSaveRef = useRef(onForceSave)
  onForceSaveRef.current = onForceSave

  const [slashMenu, setSlashMenu] = useState<SlashMenuState | null>(null)
  const [selectedSlashIndex, setSelectedSlashIndex] = useState(0)
  const [linkBubble, setLinkBubble] = useState<LinkBubbleState | null>(null)
  const [isEditingLink, setIsEditingLink] = useState(false)
  const [thickCaret, setThickCaret] = useState<ThickCaretState | null>(null)
  const [isTyping, setIsTyping] = useState(false)
  const [zoomPercent, setZoomPercent] = useState<number>(() => {
    const saved = Number(localStorage.getItem('rys-md-editor-zoom'))
    return Number.isFinite(saved) && saved >= 70 && saved <= 200 ? saved : 100
  })

  const slashMenuRef = useRef<SlashMenuState | null>(null)
  slashMenuRef.current = slashMenu

  const filteredSlashCommands = useMemo(
    () => filterRichMarkdownSlashCommands(slashCommands, slashMenu?.query ?? ''),
    [slashMenu?.query]
  )
  const filteredSlashRef = useRef<SlashCommand[]>(filteredSlashCommands)
  filteredSlashRef.current = filteredSlashCommands

  const selectedSlashIndexRef = useRef(0)
  selectedSlashIndexRef.current = selectedSlashIndex

  useEffect(() => {
    setSelectedSlashIndex(0)
  }, [slashMenu?.query])

  const initialParts = useMemo(() => splitFrontmatter(content), [noteId])
  frontmatterRef.current = initialParts.frontmatter

  const extensions = useMemo(() => createRichMarkdownExtensions(vaultPath), [vaultPath])

  const serializeEditorContent = useCallback((ed: Editor): string => {
    const bodyMd = ed.getMarkdown()
    return frontmatterRef.current ? `${frontmatterRef.current}${bodyMd}` : bodyMd
  }, [])

  const updateThickCaret = useCallback((ed: Editor | null) => {
    const container = scrollContainerRef.current
    if (!ed || !container || !ed.isFocused || ed.isDestroyed) {
      setThickCaret(null)
      return
    }
    const { selection } = ed.state
    if (!selection.empty) {
      setThickCaret(null)
      return
    }
    try {
      const coords = ed.view.coordsAtPos(selection.from)
      const rect = container.getBoundingClientRect()
      const rawHeight = Math.max(16, Math.min(64, coords.bottom - coords.top))
      const top = coords.top - rect.top + container.scrollTop
      const left = coords.left - rect.left + container.scrollLeft
      setThickCaret({
        top,
        left,
        height: rawHeight
      })
    } catch {
      setThickCaret(null)
    }
  }, [])

  const applyZoom = useCallback(
    (updater: (prev: number) => number) => {
      setZoomPercent((prev) => {
        const next = Math.max(70, Math.min(200, updater(prev)))
        localStorage.setItem('rys-md-editor-zoom', String(next))
        window.requestAnimationFrame(() => {
          updateThickCaret(editorRef.current)
        })
        return next
      })
    },
    [updateThickCaret]
  )

  const handleZoomOut = useCallback(() => applyZoom((z) => z - 10), [applyZoom])
  const handleZoomIn = useCallback(() => applyZoom((z) => z + 10), [applyZoom])
  const handleZoomReset = useCallback(() => applyZoom(() => 100), [applyZoom])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return
      if (e.key === '=' || e.key === '+') {
        e.preventDefault()
        handleZoomIn()
      } else if (e.key === '-') {
        e.preventDefault()
        handleZoomOut()
      } else if (e.key === '0') {
        e.preventDefault()
        handleZoomReset()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleZoomIn, handleZoomOut, handleZoomReset])

  const markTypingPulse = useCallback(() => {
    setIsTyping(true)
    if (typingTimerRef.current !== null) {
      window.clearTimeout(typingTimerRef.current)
    }
    typingTimerRef.current = window.setTimeout(() => {
      setIsTyping(false)
    }, 420)
  }, [])

  const handleImageFiles = useCallback(
    async (files: FileList | File[]) => {
      const ed = editorRef.current
      if (!ed) return
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) continue
        const reader = new FileReader()
        const base64Data = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(String(reader.result))
          reader.onerror = () => reject(reader.error)
          reader.readAsDataURL(file)
        })
        const { relativeAssetPath } = await vaultClient.saveAsset({
          vaultPath,
          fileName: file.name || 'clipboard.png',
          base64Data
        })
        ed.chain()
          .focus()
          .setImage({ src: relativeAssetPath, alt: file.name || 'Imagem' })
          .run()
      }
    },
    [vaultPath]
  )

  const triggerImagePick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])
  const triggerImagePickRef = useRef(triggerImagePick)
  triggerImagePickRef.current = triggerImagePick

  const editor = useEditor(
    {
      immediatelyRender: false,
      editable: !readOnly,
      extensions,
      content: initialParts.body,
      contentType: 'markdown',
      editorProps: {
        attributes: {
          class: 'rich-markdown-editor has-custom-thick-caret',
          spellcheck: 'true',
          autocapitalize: 'sentences'
        },
        // Automatic Apple Notes sentence capitalization
        handleTextInput: (view, from, to, text) => {
          if (text.length !== 1 || !/^[a-zà-öø-ÿ]$/.test(text)) {
            return false
          }
          const { state } = view
          const $from = state.doc.resolve(from)
          if ($from.parent.type.name === 'codeBlock') {
            return false
          }
          if ($from.marks().some((m) => m.type.name === 'code')) {
            return false
          }

          const beforeText = $from.parent.textBetween(0, $from.parentOffset, undefined, '\ufffc')
          const shouldCapitalize =
            beforeText.length === 0 ||
            /^\s+$/.test(beforeText) ||
            /^#{1,6}\s+$/.test(beforeText) ||
            /^[-*+]\s+(\[[ xX]\]\s+)?$/.test(beforeText) ||
            /^\d+\.\s+$/.test(beforeText) ||
            /[.!?]\s+$/.test(beforeText)

          if (!shouldCapitalize) {
            return false
          }

          const upper = text.toUpperCase()
          if (upper === text) return false
          view.dispatch(state.tr.insertText(upper, from, to))
          return true
        },
        handlePaste: (_view, event) => {
          const items = event.clipboardData?.items
          if (!items) return false
          const imageFiles: File[] = []
          for (const item of Array.from(items)) {
            if (item.type.startsWith('image/')) {
              const f = item.getAsFile()
              if (f) imageFiles.push(f)
            }
          }
          if (imageFiles.length > 0) {
            event.preventDefault()
            void handleImageFiles(imageFiles)
            return true
          }
          return false
        },
        handleKeyDown: (_view, event) => {
          const ed = editorRef.current
          if (!ed) return false

          // Ctrl/Cmd + S -> force save immediately
          if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
            event.preventDefault()
            if (debounceTimerRef.current !== null) {
              window.clearTimeout(debounceTimerRef.current)
              debounceTimerRef.current = null
            }
            const fullMd = serializeEditorContent(ed)
            lastCommittedRef.current = fullMd
            onForceSaveRef.current(fullMd)
            return true
          }

          // Ctrl/Cmd + K -> toggle link bubble
          if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
            event.preventDefault()
            const pos = getLinkBubblePosition(ed, rootRef.current)
            if (pos) {
              const href = ed.isActive('link')
                ? (ed.getAttributes('link').href as string) || ''
                : ''
              setLinkBubble({ href, ...pos })
              setIsEditingLink(true)
            }
            return true
          }

          // Ctrl/Cmd + Shift + X -> Strikethrough
          if (
            (event.ctrlKey || event.metaKey) &&
            event.shiftKey &&
            event.key.toLowerCase() === 'x'
          ) {
            event.preventDefault()
            ed.chain().focus().toggleStrike().run()
            return true
          }

          // Slash Menu keyboard navigation
          const currentSlash = slashMenuRef.current
          if (currentSlash) {
            const cmds = filteredSlashRef.current
            if (event.key === 'Escape') {
              event.preventDefault()
              setSlashMenu(null)
              return true
            }
            if (cmds.length > 0) {
              if (event.key === 'ArrowDown') {
                event.preventDefault()
                setSelectedSlashIndex((i) => (i + 1) % cmds.length)
                return true
              }
              if (event.key === 'ArrowUp') {
                event.preventDefault()
                setSelectedSlashIndex((i) => (i - 1 + cmds.length) % cmds.length)
                return true
              }
              if (event.key === 'Enter' || event.key === 'Tab') {
                event.preventDefault()
                const chosen = cmds[selectedSlashIndexRef.current] ?? cmds[0]
                if (chosen) {
                  runSlashCommand(ed, currentSlash, chosen, () =>
                    triggerImagePickRef.current()
                  )
                }
                setSlashMenu(null)
                return true
              }
            }
          }

          // Tab inside code block
          if (event.key === 'Tab' && !currentSlash) {
            if (ed.isActive('codeBlock')) {
              event.preventDefault()
              ed.commands.insertContent('  ')
              return true
            }
          }

          return false
        }
      },
      onCreate: ({ editor: nextEditor }) => {
        editorRef.current = nextEditor
        updateThickCaret(nextEditor)
      },
      onFocus: ({ editor: nextEditor }) => {
        updateThickCaret(nextEditor)
      },
      onBlur: () => {
        setThickCaret(null)
      },
      onUpdate: ({ editor: nextEditor }) => {
        editorRef.current = nextEditor
        syncSlashMenu(nextEditor, rootRef.current, setSlashMenu)
        markTypingPulse()
        updateThickCaret(nextEditor)

        if (isProgrammaticRef.current) return

        if (debounceTimerRef.current !== null) {
          window.clearTimeout(debounceTimerRef.current)
        }
        debounceTimerRef.current = window.setTimeout(() => {
          debounceTimerRef.current = null
          try {
            const nextMd = serializeEditorContent(nextEditor)
            if (nextMd !== lastCommittedRef.current) {
              lastCommittedRef.current = nextMd
              onContentChangeRef.current(nextMd)
            }
          } catch (err) {
            console.error('[RysMD] Erro ao serializar Markdown:', err)
          }
        }, 90)
      },
      onSelectionUpdate: ({ editor: nextEditor }) => {
        syncSlashMenu(nextEditor, rootRef.current, setSlashMenu)
        updateThickCaret(nextEditor)
        if (nextEditor.isActive('link')) {
          const href = (nextEditor.getAttributes('link').href as string) || ''
          const pos = getLinkBubblePosition(nextEditor, rootRef.current)
          if (pos && href) {
            setLinkBubble({ href, ...pos })
            setIsEditingLink(false)
            return
          }
        }
        if (!isEditingLink) {
          setLinkBubble(null)
        }
      }
    },
    [noteId]
  )

  // Flush any uncommitted keystrokes immediately if the component unmounts or switches note
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
        const ed = editorRef.current
        if (ed && !ed.isDestroyed) {
          try {
            const nextMd = serializeEditorContent(ed)
            if (nextMd !== lastCommittedRef.current) {
              lastCommittedRef.current = nextMd
              onContentChangeRef.current(nextMd)
            }
          } catch {
            // ignore
          }
        }
      }
    }
  }, [noteId, serializeEditorContent])

  useEffect(() => {
    editorRef.current = editor
  }, [editor])

  useEffect(() => {
    if (!editor) return
    editor.setEditable(!readOnly)
  }, [editor, readOnly])

  // Sync external changes or note switching
  useEffect(() => {
    const parts = splitFrontmatter(content)
    frontmatterRef.current = parts.frontmatter
    if (!editor) return
    if (content === lastCommittedRef.current) return

    lastCommittedRef.current = content
    isProgrammaticRef.current = true
    try {
      editor.commands.setContent(parts.body, { contentType: 'markdown' })
      updateThickCaret(editor)
    } finally {
      isProgrammaticRef.current = false
    }
  }, [content, editor, noteId, updateThickCaret])

  const handleToggleLink = useCallback(() => {
    if (!editor) return
    const pos = getLinkBubblePosition(editor, rootRef.current)
    if (!pos) return
    const href = editor.isActive('link')
      ? (editor.getAttributes('link').href as string) || ''
      : ''
    setLinkBubble({ href, ...pos })
    setIsEditingLink(true)
  }, [editor])

  const handleLinkSave = useCallback(
    (href: string) => {
      if (!editor) return
      if (href) {
        if (editor.isActive('link')) {
          editor.chain().focus().extendMarkRange('link').setLink({ href }).run()
        } else {
          const { from, to } = editor.state.selection
          if (from === to) {
            editor
              .chain()
              .focus()
              .insertContent({
                type: 'text',
                text: href,
                marks: [{ type: 'link', attrs: { href } }]
              })
              .run()
          } else {
            editor.chain().focus().setLink({ href }).run()
          }
        }
      } else if (editor.isActive('link')) {
        editor.chain().focus().extendMarkRange('link').unsetLink().run()
      }
      setIsEditingLink(false)
      setLinkBubble(null)
    },
    [editor]
  )

  const handleLinkRemove = useCallback(() => {
    if (!editor) return
    editor.chain().focus().extendMarkRange('link').unsetLink().run()
    setIsEditingLink(false)
    setLinkBubble(null)
  }, [editor])

  const cmExtensions = useMemo(
    () => [
      markdown({ base: markdownLanguage, codeLanguages: languages }),
      EditorView.lineWrapping
    ],
    []
  )

  if (mode === 'source') {
    return (
      <div className="flex h-full min-h-0 flex-1 flex-col bg-editor-surface">
        <div className="flex items-center justify-between border-b border-border/60 bg-background/60 px-4 py-1.5 text-[11px] text-muted-foreground font-mono">
          <span>MODO SOURCE (MARKDOWN CRU — CODEMIRROR 6)</span>
          <span>{formatFullDateTime(createdAt)}</span>
        </div>
        <div className="min-h-0 flex-1 overflow-auto text-sm">
          <CodeMirror
            value={content}
            height="100%"
            theme={isDark ? oneDark : 'light'}
            extensions={cmExtensions}
            editable={!readOnly}
            onChange={(val) => {
              lastCommittedRef.current = val
              onContentChangeRef.current(val)
            }}
            basicSetup={{
              lineNumbers: true,
              foldGutter: true,
              highlightActiveLine: true,
              bracketMatching: true
            }}
            className="h-full font-mono"
            style={{ fontSize: `${13.5 * (zoomPercent / 100)}px` }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="rich-markdown-editor-layout">
      <div
        ref={rootRef}
        className="rich-markdown-editor-shell"
        style={
          {
            '--rys-editor-zoom': String(zoomPercent / 100)
          } as React.CSSProperties
        }
      >
        {!readOnly && (
          <RichMarkdownToolbar
            editor={editor}
            zoomPercent={zoomPercent}
            onZoomOut={handleZoomOut}
            onZoomIn={handleZoomIn}
            onZoomReset={handleZoomReset}
            onToggleLink={handleToggleLink}
            onImagePick={triggerImagePick}
          />
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) {
              void handleImageFiles(e.target.files)
              e.target.value = ''
            }
          }}
        />
        <div
          ref={scrollContainerRef}
          onScroll={() => updateThickCaret(editor)}
          className="relative min-h-0 flex-1 overflow-auto scrollbar-sleek"
          onMouseDown={(event) => {
            if (!editor?.isEmpty || event.button !== 0) return
            const target = event.target
            if (
              target instanceof Element &&
              !target.closest('.rich-markdown-editor-shell button, .rich-markdown-editor-shell input')
            ) {
              event.preventDefault()
              editor.commands.focus('start')
            }
          }}
        >
          {/* Data completa de criação no topo da nota (estilo Apple Notes do Mac) */}
          <div
            className="pt-4 pb-1 text-center font-medium text-muted-foreground/80 select-none"
            style={{ fontSize: 'calc(12px * var(--rys-editor-zoom, 1))' }}
          >
            {formatFullDateTime(createdAt)}
          </div>

          <RichMarkdownTableControls editor={editor} />
          <EditorContent editor={editor} />

          {/* Cursor "gordinho" que pisca na mesma cor da acentuação */}
          {thickCaret && !readOnly && (
            <div
              aria-hidden="true"
              className={cn('rys-thick-caret', isTyping && 'is-typing')}
              style={{
                top: `${thickCaret.top}px`,
                left: `${thickCaret.left}px`,
                height: `${thickCaret.height}px`
              }}
            />
          )}
        </div>

        {linkBubble && (
          <RichMarkdownLinkBubble
            linkBubble={linkBubble}
            isEditing={isEditingLink}
            onSave={handleLinkSave}
            onRemove={handleLinkRemove}
            onEditStart={() => setIsEditingLink(true)}
            onCancel={() => {
              setIsEditingLink(false)
              if (!linkBubble.href) setLinkBubble(null)
            }}
            onOpen={(href) => window.open(href, '_blank', 'noopener,noreferrer')}
          />
        )}

        {slashMenu && (
          <RichMarkdownSlashMenu
            editor={editor}
            slashMenu={slashMenu}
            filteredCommands={filteredSlashCommands}
            selectedIndex={selectedSlashIndex}
            onImagePick={triggerImagePick}
          />
        )}
      </div>
    </div>
  )
}
