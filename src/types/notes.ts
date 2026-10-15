export interface NoteItem {
  id: string
  relativePath: string
  folder: string
  title: string
  preview: string
  content: string
  tags: string[]
  pinned: boolean
  trashed: boolean
  createdAt: number
  updatedAt: number
}

export interface VaultState {
  vaultPath: string
  folders: string[]
  notes: NoteItem[]
}

export type SidebarFilter =
  | { kind: 'all' }
  | { kind: 'pinned' }
  | { kind: 'trash' }
  | { kind: 'folder'; folderPath: string }
  | { kind: 'tag'; tag: string }

export type EditorMode = 'rich' | 'source'

export type AccentColor = 'blue' | 'yellow'
