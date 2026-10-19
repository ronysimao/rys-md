import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FolderOpen, Sparkles, X } from 'lucide-react'
import type {
  AccentColor,
  EditorMode,
  NoteItem,
  SidebarFilter,
  VaultState
} from '@/types/notes'
import { vaultClient } from '@/lib/vault-client'
import { APP_VERSION } from '@/lib/version-changelog'
import { AppleSidebar, handleWindowAction } from '@/components/layout/AppleSidebar'
import { AppleNoteList } from '@/components/layout/AppleNoteList'
import { NoteHeaderBar } from '@/components/layout/NoteHeaderBar'
import { VersionChangelogModal } from '@/components/layout/VersionChangelogModal'
import { RichMarkdownEditor } from '@/components/editor/RichMarkdownEditor'

const STORAGE_THEME_KEY = 'rys-md-theme'
const STORAGE_ACCENT_KEY = 'rys-md-accent'
const STORAGE_VAULT_KEY = 'rys-md-vault-path'
const STORAGE_SELECTED_NOTE_KEY = 'rys-md-selected-note'
const STORAGE_FILTER_KEY = 'rys-md-active-filter'
const STORAGE_FOLDER_ORDER_KEY = 'rys-md-folder-order'
const STORAGE_SIDEBAR_WIDTH_KEY = 'rys-md-sidebar-width'
const STORAGE_NOTELIST_WIDTH_KEY = 'rys-md-notelist-width'
const STORAGE_TOC_OPEN_KEY = 'rys-md-toc-open'
const STORAGE_EDITOR_MODE_KEY = 'rys-md-editor-mode'

const MIN_SIDEBAR_WIDTH = 150
const MIN_NOTELIST_WIDTH = 200
const MIN_EDITOR_WIDTH = 250

function filterNotesBySidebar(notes: NoteItem[], filter: SidebarFilter): NoteItem[] {
  if (filter.kind === 'trash') {
    return notes.filter((n) => n.trashed)
  }
  if (filter.kind === 'pinned') {
    return notes.filter((n) => !n.trashed && n.pinned)
  }
  if (filter.kind === 'folder') {
    return notes.filter(
      (n) =>
        !n.trashed &&
        (n.folder === filter.folderPath || n.folder.startsWith(`${filter.folderPath}/`))
    )
  }
  if (filter.kind === 'tag') {
    return notes.filter((n) => !n.trashed && n.tags.includes(filter.tag))
  }
  return notes.filter((n) => !n.trashed)
}

export function App(): React.JSX.Element {
  const [isDark, setIsDark] = useState<boolean>(() => {
    const saved = localStorage.getItem(STORAGE_THEME_KEY)
    return saved ? saved === 'dark' : true
  })

  const [accentColor, setAccentColor] = useState<AccentColor>(() => {
    const saved = localStorage.getItem(STORAGE_ACCENT_KEY)
    return saved === 'yellow' || saved === 'blue' ? saved : 'blue'
  })

  const [customVaultPath, setCustomVaultPath] = useState<string | undefined>(() => {
    return localStorage.getItem(STORAGE_VAULT_KEY) || undefined
  })

  const [vaultState, setVaultState] = useState<VaultState | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [activeFilter, setActiveFilter] = useState<SidebarFilter>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_FILTER_KEY)
      if (raw) return JSON.parse(raw) as SidebarFilter
    } catch {
      // ignore
    }
    return { kind: 'all' }
  })

  const [selectedNotePath, setSelectedNotePath] = useState<string | null>(() => {
    return localStorage.getItem(STORAGE_SELECTED_NOTE_KEY) || null
  })

  const [searchQuery, setSearchQuery] = useState('')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    const saved = Number(localStorage.getItem(STORAGE_SIDEBAR_WIDTH_KEY))
    return Number.isFinite(saved) && saved >= MIN_SIDEBAR_WIDTH ? saved : 240
  })
  const [noteListWidth, setNoteListWidth] = useState<number>(() => {
    const saved = Number(localStorage.getItem(STORAGE_NOTELIST_WIDTH_KEY))
    return Number.isFinite(saved) && saved >= MIN_NOTELIST_WIDTH ? saved : 288
  })
  const [activeResizer, setActiveResizer] = useState<'col1' | 'col2' | null>(null)

  const [focusMode, setFocusMode] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'dirty'>('saved')
  const [editorMode, setEditorMode] = useState<EditorMode>(() => {
    const saved = localStorage.getItem(STORAGE_EDITOR_MODE_KEY)
    return saved === 'source' ? 'source' : 'rich'
  })
  const [isTocOpen, setIsTocOpen] = useState<boolean>(() => {
    return localStorage.getItem(STORAGE_TOC_OPEN_KEY) === 'true'
  })

  // Version & Auto-Update state (Orca ADE style)
  const [isVersionModalOpen, setIsVersionModalOpen] = useState(false)
  const [updateInfo, setUpdateInfo] = useState<{
    hasUpdate: boolean
    latestVersion: string
    releaseUrl: string
    downloadUrl?: string
  } | null>(null)
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)

  const [isVaultModalOpen, setIsVaultModalOpen] = useState(false)
  const [vaultPathDraft, setVaultPathDraft] = useState('')
  const [folderOrder, setFolderOrder] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_FOLDER_ORDER_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) return parsed.filter((x) => typeof x === 'string')
      }
    } catch {
      // ignore
    }
    return []
  })

  const activeFilterRef = useRef<SidebarFilter>(activeFilter)
  activeFilterRef.current = activeFilter

  const saveTimerRef = useRef<number | null>(null)
  const pendingSaveRef = useRef<{
    relativePath: string
    content: string
    autoRename: boolean
  } | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    localStorage.setItem(STORAGE_THEME_KEY, isDark ? 'dark' : 'light')
    document.documentElement.classList.toggle('dark', isDark)
    document.documentElement.classList.toggle('light', !isDark)
  }, [isDark])

  useEffect(() => {
    localStorage.setItem(STORAGE_ACCENT_KEY, accentColor)
    document.documentElement.dataset.accent = accentColor
  }, [accentColor])

  useEffect(() => {
    localStorage.setItem(STORAGE_FILTER_KEY, JSON.stringify(activeFilter))
  }, [activeFilter])

  useEffect(() => {
    if (selectedNotePath) {
      localStorage.setItem(STORAGE_SELECTED_NOTE_KEY, selectedNotePath)
    } else {
      localStorage.removeItem(STORAGE_SELECTED_NOTE_KEY)
    }
  }, [selectedNotePath])

  useEffect(() => {
    localStorage.setItem(STORAGE_SIDEBAR_WIDTH_KEY, String(sidebarWidth))
  }, [sidebarWidth])

  useEffect(() => {
    localStorage.setItem(STORAGE_NOTELIST_WIDTH_KEY, String(noteListWidth))
  }, [noteListWidth])

  useEffect(() => {
    localStorage.setItem(STORAGE_EDITOR_MODE_KEY, editorMode)
  }, [editorMode])

  useEffect(() => {
    localStorage.setItem(STORAGE_TOC_OPEN_KEY, String(isTocOpen))
  }, [isTocOpen])

  // Mouse drag handler for column dividers
  useEffect(() => {
    if (!activeResizer) return

    const handleMouseMove = (e: MouseEvent) => {
      const totalWidth = window.innerWidth
      if (activeResizer === 'col1') {
        const nextWidth = e.clientX
        if (nextWidth < MIN_SIDEBAR_WIDTH) {
          // Auto-collapse Column 1 completely if dragged below 150px
          setSidebarCollapsed(true)
          setActiveResizer(null)
          return
        }
        const maxSidebarWidth = Math.max(
          MIN_SIDEBAR_WIDTH,
          totalWidth - noteListWidth - MIN_EDITOR_WIDTH
        )
        setSidebarCollapsed(false)
        setSidebarWidth(Math.min(nextWidth, maxSidebarWidth))
      } else if (activeResizer === 'col2') {
        const currentCol1Width = sidebarCollapsed ? 0 : sidebarWidth
        const rawCol2Width = e.clientX - currentCol1Width
        const maxCol2Width = Math.max(
          MIN_NOTELIST_WIDTH,
          totalWidth - currentCol1Width - MIN_EDITOR_WIDTH
        )
        const clampedCol2 = Math.max(
          MIN_NOTELIST_WIDTH,
          Math.min(rawCol2Width, maxCol2Width)
        )
        setNoteListWidth(clampedCol2)
      }
    }

    const handleMouseUp = () => {
      setActiveResizer(null)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [activeResizer, noteListWidth, sidebarCollapsed, sidebarWidth])

  const handleToggleSidebarCollapse = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev
      if (!next && sidebarWidth < 180) {
        setSidebarWidth(240)
      }
      return next
    })
  }, [sidebarWidth])

  const loadVault = useCallback(
    async (keepSelection = true) => {
      try {
        const state = await vaultClient.scanVault(customVaultPath)
        setVaultState(state)
        setError(null)
        const currentFilter = activeFilterRef.current
        const visibleInFilter = filterNotesBySidebar(state.notes, currentFilter).sort(
          (a, b) => {
            if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
            return b.updatedAt - a.updatedAt
          }
        )
        setSelectedNotePath((prev) => {
          if (
            keepSelection &&
            prev &&
            visibleInFilter.some((n) => n.relativePath === prev)
          ) {
            return prev
          }
          return visibleInFilter[0]?.relativePath ?? null
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar o cofre Rys MD')
      } finally {
        setIsLoading(false)
      }
    },
    [customVaultPath]
  )

  useEffect(() => {
    void loadVault(true)
  }, [loadVault])

  const orderedFolders = useMemo(() => {
    if (!vaultState) return []
    const existing = new Set(vaultState.folders)
    const ordered: string[] = []
    for (const f of folderOrder) {
      if (existing.has(f)) {
        ordered.push(f)
        existing.delete(f)
      }
    }
    for (const f of vaultState.folders) {
      if (existing.has(f)) {
        ordered.push(f)
        existing.delete(f)
      }
    }
    return ordered
  }, [vaultState, folderOrder])

  const handleReorderFolders = useCallback((nextOrder: string[]) => {
    setFolderOrder(nextOrder)
    localStorage.setItem(STORAGE_FOLDER_ORDER_KEY, JSON.stringify(nextOrder))
  }, [])

  // Flush any pending save to disk and return the final relative path
  const flushPendingSave = useCallback(
    async (forceAutoRename = false): Promise<string | null> => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
      }
      const pending = pendingSaveRef.current
      if (!pending || !vaultState) return null
      pendingSaveRef.current = null

      try {
        const res = await vaultClient.saveNote({
          vaultPath: vaultState.vaultPath,
          relativePath: pending.relativePath,
          content: pending.content,
          autoRename: forceAutoRename || pending.autoRename
        })
        setVaultState(res.state)
        setSelectedNotePath((prev) =>
          prev === pending.relativePath ? res.finalRelativePath : prev
        )
        setSaveStatus('saved')
        return res.finalRelativePath
      } catch (err) {
        console.error('Erro ao salvar nota:', err)
        setSaveStatus('dirty')
        return pending.relativePath
      }
    },
    [vaultState]
  )

  // Periodic background check for external file modifications
  useEffect(() => {
    const id = window.setInterval(() => {
      if (!pendingSaveRef.current && saveStatus === 'saved') {
        void loadVault(true)
      }
    }, 8000)
    return () => window.clearInterval(id)
  }, [loadVault, saveStatus])

  const filteredNotes = useMemo(() => {
    if (!vaultState) return []
    let list = filterNotesBySidebar(vaultState.notes, activeFilter)

    const q = searchQuery.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.preview.toLowerCase().includes(q) ||
          n.content.toLowerCase().includes(q) ||
          n.tags.some((t) => t.toLowerCase().includes(q))
      )
    }

    return [...list].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      return b.updatedAt - a.updatedAt
    })
  }, [vaultState, activeFilter, searchQuery])

  const selectedNote: NoteItem | null = useMemo(() => {
    if (!vaultState || !selectedNotePath) return null
    const visibleInFilter = filterNotesBySidebar(vaultState.notes, activeFilter)
    return visibleInFilter.find((n) => n.relativePath === selectedNotePath) ?? null
  }, [vaultState, selectedNotePath, activeFilter])

  const handleContentChange = useCallback(
    (nextMarkdown: string) => {
      if (!selectedNote || !vaultState) return
      const currentPath =
        pendingSaveRef.current?.relativePath ?? selectedNote.relativePath

      // Optimistic local state update for instant feedback
      setVaultState((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          notes: prev.notes.map((n) =>
            n.relativePath === currentPath
              ? {
                  ...n,
                  content: nextMarkdown,
                  updatedAt: Date.now()
                }
              : n
          )
        }
      })

      pendingSaveRef.current = {
        relativePath: currentPath,
        content: nextMarkdown,
        autoRename: true
      }
      setSaveStatus('dirty')

      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current)
      }
      saveTimerRef.current = window.setTimeout(() => {
        void flushPendingSave(true)
      }, 950)
    },
    [selectedNote, vaultState, flushPendingSave]
  )

  const handleForceSave = useCallback(
    async (nextMarkdown: string) => {
      if (!selectedNote || !vaultState) return
      const currentPath =
        pendingSaveRef.current?.relativePath ?? selectedNote.relativePath
      pendingSaveRef.current = {
        relativePath: currentPath,
        content: nextMarkdown,
        autoRename: true
      }
      await flushPendingSave(true)
    },
    [selectedNote, vaultState, flushPendingSave]
  )

  const handleCreateNote = useCallback(async () => {
    if (!vaultState) return
    await flushPendingSave(true)
    const targetFolder =
      activeFilter.kind === 'folder' ? activeFilter.folderPath : ''
    try {
      const res = await vaultClient.createNote({
        vaultPath: vaultState.vaultPath,
        folder: targetFolder
      })
      setVaultState(res.state)
      if (activeFilter.kind === 'trash') {
        setActiveFilter({ kind: 'all' })
      }
      setSelectedNotePath(res.createdRelativePath)
    } catch (err) {
      console.error('Erro ao criar nota:', err)
    }
  }, [vaultState, activeFilter, flushPendingSave])

  const handleTogglePin = useCallback(
    async (relativePath: string) => {
      if (!vaultState) return
      const wasPendingForTarget =
        pendingSaveRef.current?.relativePath === relativePath
      const flushedPath = await flushPendingSave(true)
      const effectivePath =
        wasPendingForTarget && flushedPath ? flushedPath : relativePath
      try {
        const res = await vaultClient.togglePin({
          vaultPath: vaultState.vaultPath,
          relativePath: effectivePath
        })
        setVaultState(res.state)
      } catch (err) {
        console.error('Erro ao fixar nota:', err)
      }
    },
    [vaultState, flushPendingSave]
  )

  const handleTrashNote = useCallback(
    async (relativePath: string) => {
      if (!vaultState) return
      const wasPendingForTarget =
        pendingSaveRef.current?.relativePath === relativePath
      const flushedPath = await flushPendingSave(false)
      const effectivePath =
        wasPendingForTarget && flushedPath ? flushedPath : relativePath
      try {
        const res = await vaultClient.trashNote({
          vaultPath: vaultState.vaultPath,
          relativePath: effectivePath
        })
        setVaultState(res.state)
        if (selectedNotePath === relativePath || selectedNotePath === effectivePath) {
          const remaining = filterNotesBySidebar(res.state.notes, activeFilter)
          setSelectedNotePath(remaining[0]?.relativePath ?? null)
        }
      } catch (err) {
        console.error('Erro ao apagar nota:', err)
      }
    },
    [vaultState, selectedNotePath, activeFilter, flushPendingSave]
  )

  const handleRestoreNote = useCallback(
    async (relativePath: string) => {
      if (!vaultState) return
      await flushPendingSave(false)
      try {
        const res = await vaultClient.restoreNote({
          vaultPath: vaultState.vaultPath,
          relativePath
        })
        setVaultState(res.state)
        setSelectedNotePath(res.restoredRelativePath)
      } catch (err) {
        console.error('Erro ao restaurar nota:', err)
      }
    },
    [vaultState, flushPendingSave]
  )

  const handleMoveNoteToFolder = useCallback(
    async (noteRelativePath: string, targetFolder: string) => {
      if (!vaultState) return
      const wasPendingForMovedNote =
        pendingSaveRef.current?.relativePath === noteRelativePath
      const flushedPath = await flushPendingSave(true)
      const effectiveSourcePath =
        wasPendingForMovedNote && flushedPath ? flushedPath : noteRelativePath

      try {
        const res = await vaultClient.moveNote({
          vaultPath: vaultState.vaultPath,
          relativePath: effectiveSourcePath,
          targetFolder
        })
        setVaultState(res.state)
        setSelectedNotePath(res.movedRelativePath)
      } catch (err) {
        console.error('Erro ao mover nota:', err)
      }
    },
    [vaultState, flushPendingSave]
  )

  const handleCreateFolder = useCallback(
    async (folderPath: string) => {
      if (!vaultState) return
      await flushPendingSave(true)
      try {
        const res = await vaultClient.createFolder({
          vaultPath: vaultState.vaultPath,
          folderPath
        })
        setVaultState(res.state)
        const nextFilter: SidebarFilter = {
          kind: 'folder',
          folderPath: res.createdFolder
        }
        setActiveFilter(nextFilter)
        const inNewFolder = filterNotesBySidebar(res.state.notes, nextFilter)
        setSelectedNotePath(inNewFolder[0]?.relativePath ?? null)
      } catch (err) {
        console.error('Erro ao criar pasta:', err)
      }
    },
    [vaultState, flushPendingSave]
  )

  const handleDeleteFolder = useCallback(
    async (folderPath: string) => {
      if (!vaultState) return
      await flushPendingSave(false)
      try {
        const res = await vaultClient.deleteFolder({
          vaultPath: vaultState.vaultPath,
          folderPath
        })
        setVaultState(res.state)
        if (activeFilter.kind === 'folder' && activeFilter.folderPath === folderPath) {
          setActiveFilter({ kind: 'all' })
          const firstActive = res.state.notes.find((n) => !n.trashed)
          setSelectedNotePath(firstActive?.relativePath ?? null)
        }
      } catch (err) {
        console.error('Erro ao excluir pasta:', err)
      }
    },
    [vaultState, activeFilter, flushPendingSave]
  )

  const handleSelectSidebarFilter = useCallback(
    async (filter: SidebarFilter) => {
      await flushPendingSave(true)
      setActiveFilter(filter)
      if (!vaultState) return
      const matching = filterNotesBySidebar(vaultState.notes, filter).sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
        return b.updatedAt - a.updatedAt
      })
      setSelectedNotePath((prev) => {
        if (prev && matching.some((n) => n.relativePath === prev)) {
          return prev
        }
        return matching[0]?.relativePath ?? null
      })
    },
    [vaultState, flushPendingSave]
  )

  // Global keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        void handleCreateNote()
      } else if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
        e.preventDefault()
        setFocusMode((v) => !v)
      } else if (
        (e.metaKey || e.ctrlKey) &&
        e.shiftKey &&
        e.key.toLowerCase() === 'f'
      ) {
        e.preventDefault()
        setFocusMode(false)
        window.setTimeout(() => searchInputRef.current?.focus(), 40)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleCreateNote])

  const handleCheckUpdate = useCallback(async () => {
    setIsCheckingUpdate(true)
    try {
      const info = await vaultClient.checkUpdate(APP_VERSION)
      setUpdateInfo(info)
      return info
    } finally {
      setIsCheckingUpdate(false)
    }
  }, [])

  const handlePerformUpdate = useCallback(
    async (overrideInfo?: {
      latestVersion: string
      downloadUrl?: string
      releaseUrl: string
    }) => {
      const target = overrideInfo ?? updateInfo
      setIsUpdating(true)
      try {
        await flushPendingSave(true)
        await vaultClient.performUpdate({
          downloadUrl: target?.downloadUrl,
          latestVersion: target?.latestVersion
        })
      } catch {
        if (target?.releaseUrl) {
          void vaultClient.openExternalUrl(target.releaseUrl)
        }
      } finally {
        setIsUpdating(false)
      }
    },
    [flushPendingSave, updateInfo]
  )

  const handleCheckOrPerformUpdate = useCallback(async () => {
    if (updateInfo?.hasUpdate) {
      await handlePerformUpdate(updateInfo)
      return
    }
    const info = await handleCheckUpdate()
    if (info.hasUpdate) {
      await handlePerformUpdate(info)
    } else {
      setIsVersionModalOpen(true)
    }
  }, [updateInfo, handleCheckUpdate, handlePerformUpdate])

  // Automatic background update check (Orca ADE style)
  useEffect(() => {
    const initialTimer = window.setTimeout(() => {
      void handleCheckUpdate()
    }, 1800)
    const interval = window.setInterval(() => {
      void handleCheckUpdate()
    }, 15 * 60 * 1000)
    return () => {
      window.clearTimeout(initialTimer)
      window.clearInterval(interval)
    }
  }, [handleCheckUpdate])

  const handleConfirmVaultPath = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = vaultPathDraft.trim()
    if (!trimmed) {
      localStorage.removeItem(STORAGE_VAULT_KEY)
      setCustomVaultPath(undefined)
    } else {
      localStorage.setItem(STORAGE_VAULT_KEY, trimmed)
      setCustomVaultPath(trimmed)
    }
    setIsVaultModalOpen(false)
  }

  return (
    <div
      className="rys-app-backdrop relative flex h-screen w-screen overflow-hidden text-foreground select-none"
      onMouseDown={(e) => {
        if (e.button !== 0 || e.clientY > 52) return
        const target = e.target as HTMLElement | null
        if (
          target?.closest(
            'button, a, input, textarea, select, [role="button"], [role="separator"], .rys-window-resize-edge'
          )
        ) {
          return
        }
        void handleWindowAction('drag')
      }}
      onDoubleClick={(e) => {
        if (e.clientY > 52) return
        const target = e.target as HTMLElement | null
        if (
          target?.closest(
            'button, a, input, textarea, select, [role="button"], [role="separator"], .rys-window-resize-edge'
          )
        ) {
          return
        }
        void handleWindowAction('maximize')
      }}
    >
      {/* Bordas e cantos da janela com cursores de redimensionamento imediatos no hover */}
      <div
        aria-hidden="true"
        className="rys-window-resize-edge rys-edge-n fixed top-0 left-3 right-3 h-1.5 z-50"
      />
      <div
        aria-hidden="true"
        className="rys-window-resize-edge rys-edge-s fixed bottom-0 left-3 right-3 h-1.5 z-50"
      />
      <div
        aria-hidden="true"
        className="rys-window-resize-edge rys-edge-w fixed left-0 top-3 bottom-3 w-1.5 z-50"
      />
      <div
        aria-hidden="true"
        className="rys-window-resize-edge rys-edge-e fixed right-0 top-3 bottom-3 w-1.5 z-50"
      />
      <div
        aria-hidden="true"
        className="rys-window-resize-edge rys-edge-nw fixed top-0 left-0 w-3 h-3 z-50"
      />
      <div
        aria-hidden="true"
        className="rys-window-resize-edge rys-edge-ne fixed top-0 right-0 w-3 h-3 z-50"
      />
      <div
        aria-hidden="true"
        className="rys-window-resize-edge rys-edge-sw fixed bottom-0 left-0 w-3 h-3 z-50"
      />
      <div
        aria-hidden="true"
        className="rys-window-resize-edge rys-edge-se fixed bottom-0 right-0 w-3 h-3 z-50"
      />

      {/* Column 1: Left Sidebar (Retractable smoothly with Liquid Glass) */}
      {!focusMode && vaultState && (
        <>
          <AppleSidebar
            vaultPath={vaultState.vaultPath}
            folders={orderedFolders}
            notes={vaultState.notes}
            activeFilter={activeFilter}
            isDark={isDark}
            accentColor={accentColor}
            collapsed={sidebarCollapsed}
            width={sidebarWidth}
            isResizing={activeResizer === 'col1'}
            updateInfo={updateInfo}
            isCheckingUpdate={isCheckingUpdate}
            isUpdating={isUpdating}
            onToggleCollapse={handleToggleSidebarCollapse}
            onSelectFilter={(filter) => void handleSelectSidebarFilter(filter)}
            onCreateFolder={(f) => void handleCreateFolder(f)}
            onDeleteFolder={(f) => void handleDeleteFolder(f)}
            onReorderFolders={handleReorderFolders}
            onMoveNoteToFolder={(rel, folder) => void handleMoveNoteToFolder(rel, folder)}
            onTrashNote={(rel) => void handleTrashNote(rel)}
            onToggleTheme={() => setIsDark((d) => !d)}
            onChangeAccentColor={setAccentColor}
            onChangeVaultPath={() => {
              setVaultPathDraft(vaultState.vaultPath)
              setIsVaultModalOpen(true)
            }}
            onOpenVersionModal={() => setIsVersionModalOpen(true)}
            onCheckOrPerformUpdate={() => void handleCheckOrPerformUpdate()}
          />

          {/* Linha divisória ajustável entre Coluna 1 (min 150px, <150px oculta) e Coluna 2 */}
          {!sidebarCollapsed && (
            <div
              role="separator"
              aria-orientation="vertical"
              title="Arraste para redimensionar (menos de 150px oculta a barra lateral)"
              onMouseDown={(e) => {
                e.preventDefault()
                setActiveResizer('col1')
              }}
              style={{ cursor: 'ew-resize' }}
              className="rys-column-resizer group relative z-40 -mx-1.5 w-3 shrink-0 cursor-ew-resize flex items-center justify-center select-none"
            >
              <div
                style={{ cursor: 'ew-resize' }}
                className={`h-full w-[2px] cursor-ew-resize transition-colors ${
                  activeResizer === 'col1'
                    ? 'bg-primary'
                    : 'bg-transparent group-hover:bg-primary/60'
                }`}
              />
            </div>
          )}
        </>
      )}

      {/* Column 2: Middle Note List (min 200px) */}
      {!focusMode && vaultState && (
        <>
          <AppleNoteList
            notes={filteredNotes}
            selectedNotePath={selectedNotePath}
            activeFilter={activeFilter}
            searchQuery={searchQuery}
            searchInputRef={searchInputRef}
            sidebarCollapsed={sidebarCollapsed}
            width={noteListWidth}
            onToggleSidebar={handleToggleSidebarCollapse}
            onSearchChange={setSearchQuery}
            onSelectNote={async (relativePath) => {
              if (relativePath === selectedNotePath) return
              await flushPendingSave(true)
              setSelectedNotePath(relativePath)
            }}
            onCreateNote={() => void handleCreateNote()}
            onTogglePin={(rel) => void handleTogglePin(rel)}
            onTrashNote={(rel) => void handleTrashNote(rel)}
            onRestoreNote={(rel) => void handleRestoreNote(rel)}
            onOpenVersionModal={() => setIsVersionModalOpen(true)}
          />

          {/* Linha divisória ajustável entre Coluna 2 (min 200px) e Coluna 3 (min 250px) */}
          <div
            role="separator"
            aria-orientation="vertical"
            title="Arraste para redimensionar a lista de notas"
            onMouseDown={(e) => {
              e.preventDefault()
              setActiveResizer('col2')
            }}
            style={{ cursor: 'ew-resize' }}
            className="rys-column-resizer group relative z-40 -mx-1.5 w-3 shrink-0 cursor-ew-resize flex items-center justify-center select-none"
          >
            <div
              style={{ cursor: 'ew-resize' }}
              className={`h-full w-[2px] cursor-ew-resize transition-colors ${
                activeResizer === 'col2'
                  ? 'bg-primary'
                  : 'bg-transparent group-hover:bg-primary/60'
              }`}
            />
          </div>
        </>
      )}

      {/* Column 3: Main Orca ADE Rich Markdown Editor (min 250px) */}
      <main className="flex-1 flex flex-col min-w-[250px] h-full overflow-hidden bg-editor-surface">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <div className="w-7 h-7 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              <span className="text-sm">Carregando cofre Rys MD...</span>
            </div>
          </div>
        ) : error ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="max-w-md rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center">
              <p className="text-sm font-medium text-red-400 mb-3">{error}</p>
              <button
                type="button"
                onClick={() => void loadVault(false)}
                className="cursor-pointer px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition"
              >
                Tentar novamente
              </button>
            </div>
          </div>
        ) : selectedNote && vaultState ? (
          <>
            <NoteHeaderBar
              note={selectedNote}
              editorMode={editorMode}
              saveStatus={saveStatus}
              focusMode={focusMode}
              isTocOpen={isTocOpen}
              onToggleFocusMode={() => setFocusMode((v) => !v)}
              onToggleToc={() => setIsTocOpen((v) => !v)}
              onChangeEditorMode={setEditorMode}
              onTogglePin={() => void handleTogglePin(selectedNote.relativePath)}
              onTrashNote={() => void handleTrashNote(selectedNote.relativePath)}
              onRestoreNote={() => void handleRestoreNote(selectedNote.relativePath)}
              onRevealInFolder={() =>
                void vaultClient.revealInFolder({
                  vaultPath: vaultState.vaultPath,
                  relativePath: selectedNote.relativePath
                })
              }
              onOpenVersionModal={() => setIsVersionModalOpen(true)}
            />
            <div className="flex-1 min-h-0 overflow-hidden select-text">
              <RichMarkdownEditor
                key={selectedNote.id}
                noteId={selectedNote.id}
                content={selectedNote.content}
                createdAt={selectedNote.createdAt}
                vaultPath={vaultState.vaultPath}
                mode={editorMode}
                isDark={isDark}
                readOnly={selectedNote.trashed}
                isTocOpen={isTocOpen}
                onToggleToc={() => setIsTocOpen((v) => !v)}
                onContentChange={handleContentChange}
                onForceSave={(md) => void handleForceSave(md)}
              />
            </div>
          </>
        ) : (
          <div className="flex-1 h-full" />
        )}
      </main>

      {/* Version Changelog & Repository Modal */}
      <VersionChangelogModal
        isOpen={isVersionModalOpen}
        updateInfo={updateInfo}
        isCheckingUpdate={isCheckingUpdate}
        isUpdating={isUpdating}
        onClose={() => setIsVersionModalOpen(false)}
        onCheckUpdate={() => void handleCheckUpdate()}
        onPerformUpdate={() => void handlePerformUpdate()}
      />

      {/* Vault Directory Switcher Modal */}
      {isVaultModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="rys-glass-popover w-full max-w-lg rounded-2xl border border-border p-5 shadow-2xl text-foreground">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold">Pasta do Cofre (RYS MD)</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsVaultModalOpen(false)}
                className="cursor-pointer p-1 rounded-lg hover:bg-accent"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs mb-4 leading-relaxed text-muted-foreground">
              Todas as suas notas são gravadas como arquivos <code>.md</code> reais no Ubuntu. Informe o caminho da pasta desejada:
            </p>
            <form onSubmit={handleConfirmVaultPath} className="space-y-4">
              <input
                type="text"
                value={vaultPathDraft}
                onChange={(e) => setVaultPathDraft(e.target.value)}
                placeholder="/home/simao/Documentos/RYS MD"
                className="w-full px-3 py-2 rounded-lg text-xs border border-border bg-background text-foreground outline-hidden focus:border-primary"
              />
              <div className="flex items-center justify-between gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setVaultPathDraft('')}
                  className="cursor-pointer text-xs text-muted-foreground hover:text-primary transition whitespace-nowrap"
                >
                  Restaurar padrão (~/Documentos/RYS MD)
                </button>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsVaultModalOpen(false)}
                    className="cursor-pointer px-3 py-1.5 rounded-lg text-xs hover:bg-accent transition whitespace-nowrap shrink-0"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="cursor-pointer inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-primary hover:opacity-90 text-primary-foreground text-xs font-semibold transition whitespace-nowrap shrink-0"
                  >
                    <Sparkles className="w-3.5 h-3.5 shrink-0" />
                    <span>Salvar Cofre</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
