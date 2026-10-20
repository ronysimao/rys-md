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

  async openMarkdownFile(params: {
    vaultPath?: string
  } = {}): Promise<{
    cancelled?: boolean
    importedRelativePath?: string
    fileName?: string
    vaultPath?: string
    copied?: boolean
    state?: VaultState
  }> {
    return invokeOrFetch('open_markdown_file', '/api/vault/open-markdown-file', params)
  },

  async exportPdf(params: {
    defaultFileName: string
    title: string
    html: string
  }): Promise<{ ok: boolean; savedPath?: string; cancelled?: boolean }> {
    try {
      return await invokeOrFetch('export_pdf', '/api/vault/export-pdf', params)
    } catch {
      window.print()
      return { ok: true }
    }
  },

  async openOsEmojiPicker(): Promise<void> {
    try {
      await invokeOrFetch('open_os_emoji', '/api/vault/open-os-emoji', {})
    } catch {
      // ignore if unsupported in browser
    }
  },

  async openExternalUrl(url: string): Promise<void> {
    try {
      await invokeOrFetch('open_external_url', '/api/vault/open-external-url', { url })
    } catch {
      window.open(url, '_blank', 'noopener,noreferrer')
    }
  },

  async checkUpdate(currentVersion: string): Promise<{
    hasUpdate: boolean
    latestVersion: string
    releaseUrl: string
    downloadUrl?: string
  }> {
    try {
      return await invokeOrFetch('check_update', '/api/vault/check-update', {
        currentVersion
      })
    } catch {
      // Fallback to direct GitHub API fetch (OS-aware binary asset resolution)
      try {
        const ua =
          typeof navigator !== 'undefined' ? navigator.userAgent || '' : ''
        const isWin = /Windows/i.test(ua)
        const isMac = /Macintosh|Mac OS X/i.test(ua)

        const pickOsAsset = (
          assets?: Array<{ name?: string; browser_download_url?: string }>
        ) => {
          if (!assets || assets.length === 0) return undefined
          if (isWin) {
            return (
              assets.find((a) =>
                a.name?.endsWith('Windows_x64_Portable.exe')
              ) || assets.find((a) => a.name?.endsWith('.exe'))
            )
          }
          if (isMac) {
            return (
              assets.find(
                (a) => a.name === 'Rys-MD_macOS_Universal.app.tar.gz'
              ) || assets.find((a) => a.name?.endsWith('.app.tar.gz'))
            )
          }
          return assets.find((a) => a.name?.endsWith('.deb'))
        }

        const res = await fetch(
          'https://api.github.com/repos/ronysimao/rys-md/releases?per_page=5',
          { headers: { Accept: 'application/vnd.github+json' } }
        )
        if (!res.ok) {
          return {
            hasUpdate: false,
            latestVersion: currentVersion,
            releaseUrl: 'https://github.com/ronysimao/rys-md/releases'
          }
        }
        const releases = (await res.json()) as Array<{
          tag_name?: string
          html_url?: string
          assets?: Array<{ name?: string; browser_download_url?: string }>
        }>

        // Pick the newest release that already has the compiled binary for this OS
        const matchingRelease =
          releases.find((r) => Boolean(pickOsAsset(r.assets))) || releases[0]

        if (!matchingRelease) {
          return {
            hasUpdate: false,
            latestVersion: currentVersion,
            releaseUrl: 'https://github.com/ronysimao/rys-md/releases'
          }
        }

        const osAsset = pickOsAsset(matchingRelease.assets)
        const latestVersion = (
          matchingRelease.tag_name || currentVersion
        ).replace(/^v/i, '')
        const hasUpdate =
          Boolean(osAsset?.browser_download_url) &&
          isNewerSemver(latestVersion, currentVersion)

        return {
          hasUpdate,
          latestVersion,
          releaseUrl:
            matchingRelease.html_url ||
            'https://github.com/ronysimao/rys-md/releases',
          downloadUrl: osAsset?.browser_download_url
        }
      } catch {
        return {
          hasUpdate: false,
          latestVersion: currentVersion,
          releaseUrl: 'https://github.com/ronysimao/rys-md/releases'
        }
      }
    }
  },

  async performUpdate(params: {
    downloadUrl?: string
    latestVersion?: string
  }): Promise<{ ok: boolean; message?: string }> {
    return invokeOrFetch('perform_update', '/api/vault/perform-update', params)
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

export function isNewerSemver(candidate: string, current: string): boolean {
  const parse = (v: string) =>
    v
      .replace(/^v/i, '')
      .split(/[.-]/)
      .map((n) => Number.parseInt(n, 10) || 0)
  const a = parse(candidate)
  const b = parse(current)
  for (let i = 0; i < 3; i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0)
    if (diff > 0) return true
    if (diff < 0) return false
  }
  return false
}
