import type { VaultState } from '@/types/notes'

const isTauriRuntime = (): boolean =>
  typeof window !== 'undefined' &&
  Boolean((window as unknown as Record<string, unknown>).__TAURI_INTERNALS__)

async function invokeOrFetch<T>(
  command: string,
  endpoint: string,
  payload: Record<string, unknown> = {}
): Promise<T> {
  if (isTauriRuntime()) {
    const { invoke } = await import('@tauri-apps/api/core')
    return invoke<T>(command, payload)
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  if (!res.ok) {
    const errText = await res.text()
    throw new Error(errText || `HTTP error ${res.status}`)
  }
  return res.json() as Promise<T>
}

export const vaultClient = {
  async scanVault(vaultPath?: string): Promise<VaultState> {
    return invokeOrFetch<VaultState>('scan_vault', '/api/vault/scan', { vaultPath })
  },

  async saveNote(params: {
    vaultPath?: string
    relativePath: string
    content: string
    autoRename?: boolean
  }): Promise<{ finalRelativePath: string; state: VaultState }> {
    return invokeOrFetch('save_note', '/api/vault/save-note', params)
  },

  async createNote(params: {
    vaultPath?: string
    folder?: string
    initialContent?: string
  }): Promise<{ createdRelativePath: string; state: VaultState }> {
    return invokeOrFetch('create_note', '/api/vault/create-note', params)
  },

  async togglePin(params: {
    vaultPath?: string
    relativePath: string
  }): Promise<{ state: VaultState }> {
    return invokeOrFetch('toggle_pin', '/api/vault/toggle-pin', params)
  },

  async trashNote(params: {
    vaultPath?: string
    relativePath: string
  }): Promise<{ state: VaultState }> {
    return invokeOrFetch('trash_note', '/api/vault/trash-note', params)
  },

  async restoreNote(params: {
    vaultPath?: string
    relativePath: string
  }): Promise<{ restoredRelativePath: string; state: VaultState }> {
    return invokeOrFetch('restore_note', '/api/vault/restore-note', params)
  },

  async moveNote(params: {
    vaultPath?: string
    relativePath: string
    targetFolder: string
  }): Promise<{ movedRelativePath: string; state: VaultState }> {
    return invokeOrFetch('move_note', '/api/vault/move-note', params)
  },

  async createFolder(params: {
    vaultPath?: string
    folderPath: string
  }): Promise<{ createdFolder: string; state: VaultState }> {
    return invokeOrFetch('create_folder', '/api/vault/create-folder', params)
  },

  async deleteFolder(params: {
    vaultPath?: string
    folderPath: string
  }): Promise<{ state: VaultState }> {
    return invokeOrFetch('delete_folder', '/api/vault/delete-folder', params)
  },

  async saveAsset(params: {
    vaultPath?: string
    fileName: string
    base64Data: string
  }): Promise<{ relativeAssetPath: string }> {
    return invokeOrFetch('save_asset', '/api/vault/save-asset', params)
  },

  async revealInFolder(params: {
    vaultPath?: string
    relativePath?: string
  }): Promise<void> {
    await invokeOrFetch('reveal_in_folder', '/api/vault/reveal-in-folder', params)
  },

  resolveAssetUrl(vaultPath: string, src: string): string {
    if (!src) return ''
    if (
      src.startsWith('http://') ||
      src.startsWith('https://') ||
      src.startsWith('data:') ||
      src.startsWith('blob:')
    ) {
      return src
    }
    return `/api/vault/asset?vaultPath=${encodeURIComponent(vaultPath)}&path=${encodeURIComponent(src)}`
  },

  async resolveAssetUrlAsync(vaultPath: string, src: string): Promise<string> {
    if (!src) return ''
    if (
      src.startsWith('http://') ||
      src.startsWith('https://') ||
      src.startsWith('data:') ||
      src.startsWith('blob:')
    ) {
      return src
    }
    if (isTauriRuntime()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core')
        const res = await invoke<{ dataUrl: string }>('read_asset_base64', {
          vaultPath,
          relativePath: src
        })
        return res.dataUrl
      } catch {
        return src
      }
    }
    return `/api/vault/asset?vaultPath=${encodeURIComponent(vaultPath)}&path=${encodeURIComponent(src)}`
  }
}
