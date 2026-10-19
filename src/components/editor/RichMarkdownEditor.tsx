import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { EditorContent, useEditor, type Editor } from '@tiptap/react'
import { TextSelection } from '@tiptap/pm/state'
import { ArrowDownToLine } from 'lucide-react'
import CodeMirror from '@uiw/react-codemirror'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { oneDark } from '@codemirror/theme-one-dark'
import {
  Decoration as CmDecoration,
  type DecorationSet as CmDecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate
} from '@codemirror/view'
import { createRichMarkdownExtensions } from './rich-markdown-extensions'
import { RichMarkdownToolbar } from './RichMarkdownToolbar'
import { RichMarkdownSlashMenu } from './RichMarkdownSlashMenu'
import {
  RichMarkdownEmojiMenu,
  type EmojiMenuPosition
} from './RichMarkdownEmojiMenu'
import { MarkdownTableOfContentsPanel } from './MarkdownTableOfContentsPanel'
import {
  extractMarkdownTableOfContents,
  extractRichMarkdownTableOfContents,
  type TableOfContentsItem
} from './markdown-table-of-contents'
import { RichMarkdownSearchBar } from './RichMarkdownSearchBar'
import {
  createRichMarkdownSearchPlugin,
  findPlainTextMatchRanges,
  findRichMarkdownSearchMatches,
  richMarkdownSearchPluginKey,
  type RichMarkdownSearchMatch
} from './rich-markdown-search'
import {
  createRichMarkdownHashtagPlugin,
  findMarkdownSourceHashtagRanges,
  richMarkdownHashtagPluginKey
} from './rich-markdown-hashtags'
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

const STORAGE_TOC_WIDTH_KEY = 'rys-md-toc-width'
const MIN_TOC_WIDTH = 150

interface RichMarkdownEditorProps {
  noteId: string
  content: string
  createdAt: number
  vaultPath: string
  mode: EditorMode
  isDark: boolean
  readOnly?: boolean
  isTocOpen: boolean
  onToggleToc: () => void
  onContentChange: (nextMarkdown: string) => void
  onForceSave: (nextMarkdown: string) => void
}

interface ThickCaretState {
  top: number
  left: number
  height: number
  isBold: boolean
  isItalic: boolean
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
  isTocOpen,
  onToggleToc,
  onContentChange,
  onForceSave
}: RichMarkdownEditorProps): React.JSX.Element {
  const layoutRef = useRef<HTMLDivElement | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const editorRef = useRef<Editor | null>(null)
  const cmViewRef = useRef<EditorView | null>(null)
  const frontmatterRef = useRef<string>('')
  const lastCommittedRef = useRef<string>(content)
  // Tracks the exact Markdown string currently loaded into or serialized from TipTap Rich mode
  const lastRichSyncedRef = useRef<string>(content)
  const modeRef = useRef<EditorMode>(mode)
  modeRef.current = mode
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
  const [emojiMenu, setEmojiMenu] = useState<EmojiMenuPosition | null>(null)
  const [linkBubble, setLinkBubble] = useState<LinkBubbleState | null>(null)
  const [isEditingLink, setIsEditingLink] = useState(false)
  const [thickCaret, setThickCaret] = useState<ThickCaretState | null>(null)
  const [isTyping, setIsTyping] = useState(false)
  const [zoomPercent, setZoomPercent] = useState<number>(() => {
    const saved = Number(localStorage.getItem('rys-md-editor-zoom'))
    return Number.isFinite(saved) && saved >= 70 && saved <= 200 ? saved : 100
  })

  // Table of Contents panel width & resize state
  const [tocWidth, setTocWidth] = useState<number>(() => {
    const saved = Number(localStorage.getItem(STORAGE_TOC_WIDTH_KEY))
    return Number.isFinite(saved) && saved >= MIN_TOC_WIDTH ? saved : 240
  })
  const [isResizingToc, setIsResizingToc] = useState(false)

  // Orca ADE In-Editor Search & Replace state (works in both Rich and Source modes)
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isReplaceMode, setIsReplaceMode] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [replaceQuery, setReplaceQuery] = useState('')
  const [matchCase, setMatchCase] = useState(false)
  const [wholeWord, setWholeWord] = useState(false)
  const [rawActiveMatchIndex, setRawActiveMatchIndex] = useState(0)
  const [searchRevision, setSearchRevision] = useState(0)
  const [navigationTrigger, setNavigationTrigger] = useState(0)

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
    const { selection, storedMarks } = ed.state
    if (!selection.empty) {
      setThickCaret(null)
      return
    }
    const activeMarks = storedMarks ?? selection.$from.marks()
    const isBold =
      ed.isActive('bold') || activeMarks.some((m) => m.type.name === 'bold')
    const isItalic =
      ed.isActive('italic') || activeMarks.some((m) => m.type.name === 'italic')

    try {
      const coords = ed.view.coordsAtPos(selection.from)
      const rect = container.getBoundingClientRect()
      const rawHeight = Math.max(16, Math.min(64, coords.bottom - coords.top))
      const top = coords.top - rect.top + container.scrollTop
      const left = coords.left - rect.left + container.scrollLeft
      setThickCaret({
        top,
        left,
        height: rawHeight,
        isBold,
        isItalic
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
            lastRichSyncedRef.current = fullMd
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
                  runSlashCommand(
                    ed,
                    currentSlash,
                    chosen,
                    () => triggerImagePickRef.current(),
                    (menu) => setEmojiMenu({ left: menu.left, top: menu.top })
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
      onTransaction: ({ editor: nextEditor }) => {
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
        setEmojiMenu(null)
        syncSlashMenu(nextEditor, rootRef.current, setSlashMenu)
        markTypingPulse()
        updateThickCaret(nextEditor)
        setSearchRevision((r) => r + 1)

        if (isProgrammaticRef.current || modeRef.current !== 'rich') return

        if (debounceTimerRef.current !== null) {
          window.clearTimeout(debounceTimerRef.current)
        }
        debounceTimerRef.current = window.setTimeout(() => {
          debounceTimerRef.current = null
          if (modeRef.current !== 'rich') return
          try {
            const nextMd = serializeEditorContent(nextEditor)
            lastRichSyncedRef.current = nextMd
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

  // Register Orca ADE search highlight plugin and inline hashtag badge plugin on TipTap editor
  useEffect(() => {
    if (!editor || editor.isDestroyed) return
    const searchPlugin = createRichMarkdownSearchPlugin()
    const hashtagPlugin = createRichMarkdownHashtagPlugin()
    editor.registerPlugin(searchPlugin)
    editor.registerPlugin(hashtagPlugin)
    return () => {
      if (!editor.isDestroyed) {
        editor.unregisterPlugin(richMarkdownSearchPluginKey)
        editor.unregisterPlugin(richMarkdownHashtagPluginKey)
      }
    }
  }, [editor])

  // Flush any pending Rich debounce immediately when switching from Rich to Source mode
  useEffect(() => {
    if (mode === 'source' && debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
      const ed = editorRef.current
      if (ed && !ed.isDestroyed) {
        try {
          const nextMd = serializeEditorContent(ed)
          lastRichSyncedRef.current = nextMd
          if (nextMd !== lastCommittedRef.current) {
            lastCommittedRef.current = nextMd
            onContentChangeRef.current(nextMd)
          }
        } catch {
          // ignore
        }
      }
    }
  }, [mode, serializeEditorContent])

  // Flush any uncommitted keystrokes immediately if the component unmounts or switches note
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
        if (modeRef.current === 'rich') {
          const ed = editorRef.current
          if (ed && !ed.isDestroyed) {
            try {
              const nextMd = serializeEditorContent(ed)
              lastRichSyncedRef.current = nextMd
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
    }
  }, [noteId, serializeEditorContent])

  useEffect(() => {
    editorRef.current = editor
  }, [editor])

  useEffect(() => {
    if (!editor) return
    editor.setEditable(!readOnly)
  }, [editor, readOnly])

  // Sync external changes, note switching, AND changes made in Source mode back into Rich mode!
  useEffect(() => {
    const parts = splitFrontmatter(content)
    frontmatterRef.current = parts.frontmatter
    if (!editor || editor.isDestroyed) return
    if (mode !== 'rich') return
    if (content === lastRichSyncedRef.current) return

    lastRichSyncedRef.current = content
    lastCommittedRef.current = content
    isProgrammaticRef.current = true
    try {
      editor.commands.setContent(parts.body, { contentType: 'markdown' })
      setSearchRevision((r) => r + 1)
      updateThickCaret(editor)
    } finally {
      isProgrammaticRef.current = false
    }
  }, [content, editor, noteId, mode, updateThickCaret])

  // Compute search matches for current mode (Rich ProseMirror doc or Source full raw Markdown)
  const matches = useMemo<RichMarkdownSearchMatch[]>(() => {
    if (!isSearchOpen || !searchQuery) {
      return []
    }
    if (mode === 'source') {
      return findPlainTextMatchRanges(content, searchQuery, {
        matchCase,
        wholeWord
      })
    }
    if (!editor || editor.isDestroyed) {
      return []
    }
    return findRichMarkdownSearchMatches(editor.state.doc, searchQuery, {
      matchCase,
      wholeWord
    })
  }, [
    isSearchOpen,
    searchQuery,
    mode,
    content,
    editor,
    matchCase,
    wholeWord,
    searchRevision
  ])

  const matchCount = matches.length
  const activeMatchIndex =
    !isSearchOpen || matchCount === 0
      ? -1
      : rawActiveMatchIndex >= 0 && rawActiveMatchIndex < matchCount
        ? rawActiveMatchIndex
        : 0

  // Sync ProseMirror decorations and scroll in Rich mode
  const prevSearchSnapRef = useRef<{
    query: string
    matchCase: boolean
    wholeWord: boolean
    navTrigger: number
    mode: EditorMode
  }>({
    query: '',
    matchCase: false,
    wholeWord: false,
    navTrigger: 0,
    mode
  })

  useEffect(() => {
    const prev = prevSearchSnapRef.current
    const queryOrNavChanged =
      prev.query !== (isSearchOpen ? searchQuery : '') ||
      prev.matchCase !== matchCase ||
      prev.wholeWord !== wholeWord ||
      prev.navTrigger !== navigationTrigger ||
      prev.mode !== mode
    prevSearchSnapRef.current = {
      query: isSearchOpen ? searchQuery : '',
      matchCase,
      wholeWord,
      navTrigger: navigationTrigger,
      mode
    }

    if (mode === 'rich') {
      if (!editor || editor.isDestroyed) return
      const activeMatch =
        isSearchOpen && searchQuery && activeMatchIndex >= 0
          ? matches[activeMatchIndex]
          : null

      const tr = editor.state.tr.setMeta(richMarkdownSearchPluginKey, {
        activeIndex: activeMatchIndex,
        matches,
        query: isSearchOpen ? searchQuery : ''
      })

      if (activeMatch && queryOrNavChanged) {
        try {
          tr.setSelection(
            TextSelection.create(tr.doc, activeMatch.from, activeMatch.to)
          )
        } catch {
          // ignore if range invalid
        }
      }
      editor.view.dispatch(tr)

      const container = scrollContainerRef.current
      if (activeMatch && container && queryOrNavChanged) {
        try {
          const coords = editor.view.coordsAtPos(activeMatch.from)
          const containerRect = container.getBoundingClientRect()
          const relativeTop = coords.top - containerRect.top
          const targetScroll =
            container.scrollTop + relativeTop - containerRect.height / 2
          container.scrollTo({ top: Math.max(0, targetScroll), behavior: 'instant' })
        } catch {
          // ignore
        }
      }
    } else if (mode === 'source') {
      const view = cmViewRef.current
      if (!view) return
      const activeMatch =
        isSearchOpen && searchQuery && activeMatchIndex >= 0
          ? matches[activeMatchIndex]
          : null

      // Trigger CodeMirror decoration plugin refresh
      view.dispatch({
         ...(activeMatch && queryOrNavChanged
          ? {
              selection: { anchor: activeMatch.from, head: activeMatch.to },
              effects: EditorView.scrollIntoView(activeMatch.from, { y: 'center' })
            }
          : {})
      })
    }
  }, [
    mode,
    editor,
    isSearchOpen,
    searchQuery,
    matchCase,
    wholeWord,
    matches,
    activeMatchIndex,
    navigationTrigger
  ])

  const openSearch = useCallback(
    (withReplace = false) => {
      if (withReplace) {
        setIsReplaceMode(true)
      }
      if (isSearchOpen) {
        window.requestAnimationFrame(() => {
          searchInputRef.current?.focus()
          searchInputRef.current?.select()
        })
      } else {
        setIsSearchOpen(true)
        window.requestAnimationFrame(() => {
          searchInputRef.current?.focus()
          searchInputRef.current?.select()
        })
      }
    },
    [isSearchOpen]
  )

  const closeSearch = useCallback(() => {
    setIsSearchOpen(false)
    setIsReplaceMode(false)
    setSearchQuery('')
    setReplaceQuery('')
    setRawActiveMatchIndex(0)
    if (modeRef.current === 'rich') {
      editorRef.current?.commands.focus()
    } else {
      cmViewRef.current?.focus()
    }
  }, [])

  const moveToMatch = useCallback(
    (direction: 1 | -1) => {
      if (matches.length === 0) return
      setRawActiveMatchIndex((curr) => {
        const base = curr >= 0 && curr < matches.length ? curr : 0
        return (base + direction + matches.length) % matches.length
      })
      setNavigationTrigger((n) => n + 1)
    },
    [matches.length]
  )

  const replaceCurrentMatch = useCallback(() => {
    if (readOnly || matches.length === 0) return
    const idx =
      activeMatchIndex >= 0 && activeMatchIndex < matches.length
        ? activeMatchIndex
        : 0
    const match = matches[idx]
    if (!match) return

    if (mode === 'rich') {
      if (!editor || editor.isDestroyed) return
      const tr = editor.state.tr
      if (replaceQuery) {
        tr.insertText(replaceQuery, match.from, match.to)
      } else {
        tr.delete(match.from, match.to)
      }
      editor.view.dispatch(tr)
      setNavigationTrigger((n) => n + 1)
    } else {
      const nextContent =
        content.slice(0, match.from) + replaceQuery + content.slice(match.to)
      lastCommittedRef.current = nextContent
      onContentChangeRef.current(nextContent)
      setNavigationTrigger((n) => n + 1)
    }
  }, [readOnly, matches, activeMatchIndex, mode, editor, replaceQuery, content])

  const replaceAllMatches = useCallback(() => {
    if (readOnly || matches.length === 0) return
    if (mode === 'rich') {
      if (!editor || editor.isDestroyed) return
      const tr = editor.state.tr
      for (let i = matches.length - 1; i >= 0; i--) {
        const m = matches[i]!
        if (replaceQuery) {
          tr.insertText(replaceQuery, m.from, m.to)
        } else {
          tr.delete(tr.mapping.map(m.from), tr.mapping.map(m.to))
        }
      }
      editor.view.dispatch(tr)
      setNavigationTrigger((n) => n + 1)
    } else {
      let nextContent = content
      for (let i = matches.length - 1; i >= 0; i--) {
        const m = matches[i]!
        nextContent =
          nextContent.slice(0, m.from) + replaceQuery + nextContent.slice(m.to)
      }
      lastCommittedRef.current = nextContent
      onContentChangeRef.current(nextContent)
      setNavigationTrigger((n) => n + 1)
    }
  }, [readOnly, matches, mode, editor, replaceQuery, content])

  // Capture Ctrl+F / Cmd+F and Ctrl+H in both Rich and Source modes
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isMod = event.ctrlKey || event.metaKey
      if (isMod && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 'f') {
        event.preventDefault()
        event.stopPropagation()
        openSearch(false)
        return
      }
      if (isMod && !event.shiftKey && event.key.toLowerCase() === 'h') {
        event.preventDefault()
        event.stopPropagation()
        openSearch(true)
        return
      }
      if (event.key === 'Escape' && isSearchOpen) {
        event.preventDefault()
        event.stopPropagation()
        closeSearch()
      }
    }
    window.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true })
  }, [openSearch, closeSearch, isSearchOpen])

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

  // Keep latest Source search state in a ref for the CodeMirror decoration plugin
  const cmSearchStateRef = useRef<{
    isOpen: boolean
    query: string
    matches: RichMarkdownSearchMatch[]
    activeIndex: number
  }>({
    isOpen: false,
    query: '',
    matches: [],
    activeIndex: -1
  })
  cmSearchStateRef.current = {
    isOpen: isSearchOpen && mode === 'source',
    query: searchQuery,
    matches: mode === 'source' ? matches : [],
    activeIndex: activeMatchIndex
  }

  const cmExtensions = useMemo(() => {
    const searchHighlightPlugin = ViewPlugin.fromClass(
      class {
        decorations: CmDecorationSet
        constructor(view: EditorView) {
          this.decorations = this.buildDecorations(view)
        }
        update(update: ViewUpdate) {
          this.decorations = this.buildDecorations(update.view)
        }
        buildDecorations(view: EditorView): CmDecorationSet {
          const state = cmSearchStateRef.current
          if (!state.isOpen || !state.query || state.matches.length === 0) {
            return CmDecoration.none
          }
          const docLen = view.state.doc.length
          const decos = []
          for (let i = 0; i < state.matches.length; i++) {
            const m = state.matches[i]!
            if (m.from >= 0 && m.to <= docLen && m.from < m.to) {
              decos.push(
                CmDecoration.mark({
                  class: 'rich-markdown-search-match',
                  attributes:
                    i === state.activeIndex ? { 'data-active': 'true' } : undefined
                }).range(m.from, m.to)
              )
            }
          }
          return CmDecoration.set(decos, true)
        }
      },
      {
        decorations: (v) => v.decorations
      }
    )

    const hashtagHighlightPlugin = ViewPlugin.fromClass(
      class {
        decorations: CmDecorationSet
        constructor(view: EditorView) {
          this.decorations = this.buildDecorations(view)
        }
        update(update: ViewUpdate) {
          if (update.docChanged || update.viewportChanged) {
            this.decorations = this.buildDecorations(update.view)
          }
        }
        buildDecorations(view: EditorView): CmDecorationSet {
          const docText = view.state.doc.toString()
          const ranges = findMarkdownSourceHashtagRanges(docText)
          if (ranges.length === 0) return CmDecoration.none
          const docLen = view.state.doc.length
          const decos = []
          for (const r of ranges) {
            if (r.from >= 0 && r.to <= docLen && r.from < r.to) {
              decos.push(
                CmDecoration.mark({
                  class: 'rys-inline-tag',
                  attributes: { 'data-tag': r.tag }
                }).range(r.from, r.to)
              )
            }
          }
          return CmDecoration.set(decos, true)
        }
      },
      {
        decorations: (v) => v.decorations
      }
    )

    return [
      markdown({ base: markdownLanguage, codeLanguages: languages }),
      EditorView.lineWrapping,
      hashtagHighlightPlugin,
      searchHighlightPlugin
    ]
  }, [])

  // Persist TOC width and handle mouse resize (collapsing smoothly if dragged < 150px)
  useEffect(() => {
    localStorage.setItem(STORAGE_TOC_WIDTH_KEY, String(tocWidth))
  }, [tocWidth])

  useEffect(() => {
    if (!isResizingToc) return

    const handleMouseMove = (e: MouseEvent) => {
      const layoutEl = layoutRef.current
      if (!layoutEl) return
      const rect = layoutEl.getBoundingClientRect()
      const desiredTocWidth = rect.right - e.clientX
      if (desiredTocWidth < MIN_TOC_WIDTH) {
        if (isTocOpen) {
          onToggleToc()
        }
        setIsResizingToc(false)
        return
      }
      const maxTocWidth = Math.max(MIN_TOC_WIDTH, rect.width - 250)
      setTocWidth(Math.min(desiredTocWidth, maxTocWidth))
    }

    const handleMouseUp = () => {
      setIsResizingToc(false)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizingToc, isTocOpen, onToggleToc])

  // Compute Table of Contents items (hierarchical H1..H5)
  const tocItems = useMemo<TableOfContentsItem[]>(() => {
    if (mode === 'source') {
      return extractMarkdownTableOfContents(content)
    }
    if (!editor || editor.isDestroyed) {
      return extractMarkdownTableOfContents(content)
    }
    return extractRichMarkdownTableOfContents(editor.state.doc)
  }, [mode, content, editor, searchRevision])

  const handleSelectTocItem = useCallback(
    (item: TableOfContentsItem) => {
      if (mode === 'source') {
        const view = cmViewRef.current
        if (!view || !item.line) return
        const lineCount = view.state.doc.lines
        const clampedLine = Math.max(1, Math.min(item.line, lineCount))
        const lineInfo = view.state.doc.line(clampedLine)
        view.focus()
        view.dispatch({
          selection: { anchor: lineInfo.from },
          effects: EditorView.scrollIntoView(lineInfo.from, { y: 'start' })
        })
        return
      }

      if (!editor || editor.isDestroyed || item.pos === undefined) return
      const targetPos = Math.min(
        Math.max(1, item.pos + 1),
        editor.state.doc.content.size
      )
      editor.chain().focus().setTextSelection(targetPos).run()
      const container = scrollContainerRef.current
      if (container) {
        try {
          const coords = editor.view.coordsAtPos(targetPos)
          const rect = container.getBoundingClientRect()
          const targetTop = container.scrollTop + (coords.top - rect.top) - 24
          container.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' })
        } catch {
          // ignore
        }
      }
      window.requestAnimationFrame(() => updateThickCaret(editor))
    },
    [mode, editor, updateThickCaret]
  )

  // Jump & scroll to the last written line (Ctrl + End behavior)
  const handleJumpToLastLine = useCallback(() => {
    if (mode === 'source') {
      const view = cmViewRef.current
      if (!view) return
      const docEnd = view.state.doc.length
      view.focus()
      view.dispatch({
        selection: { anchor: docEnd, head: docEnd },
        effects: EditorView.scrollIntoView(docEnd, { y: 'center' })
      })
      return
    }

    if (!editor || editor.isDestroyed) return
    editor.commands.focus('end')
    const container = scrollContainerRef.current
    if (container) {
      window.requestAnimationFrame(() => {
        try {
          const endPos = editor.state.selection.to
          const coords = editor.view.coordsAtPos(endPos)
          const rect = container.getBoundingClientRect()
          const targetScroll =
            container.scrollTop + (coords.top - rect.top) - rect.height * 0.45
          container.scrollTo({
            top: Math.max(0, targetScroll),
            behavior: 'smooth'
          })
        } catch {
          container.scrollTo({
            top: container.scrollHeight,
            behavior: 'smooth'
          })
        }
        updateThickCaret(editor)
      })
    }
  }, [mode, editor, updateThickCaret])

  const searchBarElement = (
    <RichMarkdownSearchBar
      activeMatchIndex={activeMatchIndex}
      isOpen={isSearchOpen}
      isReplaceMode={isReplaceMode}
      matchCase={matchCase}
      matchCount={matchCount}
      query={searchQuery}
      replaceQuery={replaceQuery}
      replaceDisabled={readOnly}
      placeholder="Buscar no editor visual"
      searchInputRef={searchInputRef}
      wholeWord={wholeWord}
      onClose={closeSearch}
      onMoveToMatch={moveToMatch}
      onQueryChange={(val) => {
        setSearchQuery(val)
        setRawActiveMatchIndex(0)
        setNavigationTrigger((n) => n + 1)
      }}
      onReplaceAll={replaceAllMatches}
      onReplaceCurrent={replaceCurrentMatch}
      onReplaceQueryChange={setReplaceQuery}
      onToggleMatchCase={() => {
        setMatchCase((v) => !v)
        setNavigationTrigger((n) => n + 1)
      }}
      onToggleReplaceMode={() => setIsReplaceMode((v) => !v)}
      onToggleWholeWord={() => {
        setWholeWord((v) => !v)
        setNavigationTrigger((n) => n + 1)
      }}
    />
  )

  const jumpToLastLineButton = (
    <button
      type="button"
      onClick={handleJumpToLastLine}
      title="Rolar para a última linha escrita (Ctrl + End)"
      aria-label="Rolar para a última linha escrita"
      className="fixed sm:absolute bottom-5 left-5 z-30 flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-1 ring-white/20 transition-all hover:scale-105 hover:opacity-95 active:scale-95 cursor-pointer print:hidden"
    >
      <ArrowDownToLine className="size-4" />
    </button>
  )

  const tocPanelElement = (
    <MarkdownTableOfContentsPanel
      items={tocItems}
      isOpen={isTocOpen}
      width={tocWidth}
      isResizing={isResizingToc}
      onSelect={handleSelectTocItem}
      onClose={onToggleToc}
      onStartResize={(e) => {
        e.preventDefault()
        setIsResizingToc(true)
      }}
    />
  )

  if (mode === 'source') {
    return (
      <div ref={layoutRef} className="rich-markdown-editor-layout">
        <div
          ref={rootRef}
          className="relative flex h-full min-h-0 flex-1 flex-col bg-editor-surface min-w-0"
        >
          <div className="flex items-center justify-between border-b border-border/60 bg-background/60 px-4 py-1.5 text-[11px] text-muted-foreground font-mono">
            <span>MODO SOURCE (MARKDOWN CRU — CODEMIRROR 6)</span>
            <span>{formatFullDateTime(createdAt)}</span>
          </div>
          <div className="relative min-h-0 flex-1 overflow-hidden text-sm">
            <CodeMirror
              value={content}
              height="100%"
              theme={isDark ? oneDark : 'light'}
              extensions={cmExtensions}
              editable={!readOnly}
              onCreateEditor={(view) => {
                cmViewRef.current = view
              }}
              onChange={(val) => {
                lastCommittedRef.current = val
                onContentChangeRef.current(val)
              }}
              basicSetup={{
                lineNumbers: true,
                foldGutter: true,
                highlightActiveLine: true,
                bracketMatching: true,
                searchKeymap: false
              }}
              className="rys-codemirror-host h-full font-mono"
              style={{ fontSize: `${13.5 * (zoomPercent / 100)}px` }}
            />
            {searchBarElement}
            {jumpToLastLineButton}
          </div>
        </div>
        {tocPanelElement}
      </div>
    )
  }

  return (
    <div ref={layoutRef} className="rich-markdown-editor-layout">
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
        <div className="relative min-h-0 flex-1 flex flex-col overflow-hidden">
          <div
            ref={scrollContainerRef}
            onScroll={() => updateThickCaret(editor)}
            className="relative min-h-0 flex-1 overflow-auto scrollbar-sleek"
            onMouseDown={(event) => {
              if (!editor?.isEmpty || event.button !== 0) return
              const target = event.target
              if (
                target instanceof Element &&
                !target.closest(
                  '.rich-markdown-editor-shell button, .rich-markdown-editor-shell input'
                )
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

            {/* Cursor "gordinho" que pisca na mesma cor da acentuação (inclinado em Itálico e strong em Negrito) */}
            {thickCaret && !readOnly && (
              <div
                aria-hidden="true"
                className={cn(
                  'rys-thick-caret',
                  isTyping && 'is-typing',
                  thickCaret.isBold && 'is-bold',
                  thickCaret.isItalic && 'is-italic'
                )}
                style={{
                  top: `${thickCaret.top}px`,
                  left: `${thickCaret.left}px`,
                  height: `${thickCaret.height}px`
                }}
              />
            )}
          </div>
          {searchBarElement}
          {jumpToLastLineButton}
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
            onEmojiSelect={(menu) => {
              setSlashMenu(null)
              setEmojiMenu({ left: menu.left, top: menu.top })
            }}
          />
        )}

        {emojiMenu && (
          <RichMarkdownEmojiMenu
            emojiMenu={emojiMenu}
            isDark={isDark}
            onSelect={(emoji) => {
              editor?.chain().focus().insertContent(emoji).run()
              setEmojiMenu(null)
            }}
            onClose={() => {
              setEmojiMenu(null)
              editor?.commands.focus()
            }}
          />
        )}
      </div>

      {tocPanelElement}
    </div>
  )
}
