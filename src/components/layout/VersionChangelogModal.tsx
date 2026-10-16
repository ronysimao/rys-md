import React from 'react'
import {
  CheckCircle2,
  ExternalLink,
  GitBranch,
  RefreshCw,
  Sparkles,
  X
} from 'lucide-react'
import {
  APP_REPO_URL,
  APP_SITE_URL,
  APP_VERSION,
  VERSION_CHANGELOG
} from '@/lib/version-changelog'
import { vaultClient } from '@/lib/vault-client'

interface VersionChangelogModalProps {
  isOpen: boolean
  updateInfo: {
    hasUpdate: boolean
    latestVersion: string
    releaseUrl: string
    downloadUrl?: string
  } | null
  isCheckingUpdate: boolean
  isUpdating: boolean
  onClose: () => void
  onCheckUpdate: () => void
  onPerformUpdate: () => void
}

export function VersionChangelogModal({
  isOpen,
  updateInfo,
  isCheckingUpdate,
  isUpdating,
  onClose,
  onCheckUpdate,
  onPerformUpdate
}: VersionChangelogModalProps): React.JSX.Element | null {
  if (!isOpen) return null

  const openExternal = (url: string) => {
    void vaultClient.openExternalUrl(url)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 select-none"
      onClick={onClose}
    >
      <div
        className="rys-glass-popover w-full max-w-xl rounded-2xl border border-border p-5 shadow-2xl text-foreground flex flex-col max-h-[82vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/60 pb-3.5 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Sparkles className="size-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold">Rys MD</h3>
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary font-mono">
                  v{APP_VERSION}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Notas da versão e histórico de atualizações
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            title="Fechar"
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Status de Atualização */}
        <div className="my-3 flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-accent/35 px-3.5 py-2.5 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {updateInfo?.hasUpdate ? (
              <>
                <Sparkles className="size-4 text-primary shrink-0 animate-pulse" />
                <div className="text-xs truncate">
                  <span className="font-semibold text-foreground">
                    Nova versão v{updateInfo.latestVersion} disponível!
                  </span>
                </div>
              </>
            ) : (
              <>
                <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                <span className="text-xs text-muted-foreground truncate">
                  Você está usando a versão instalada <strong className="text-foreground">v{APP_VERSION}</strong>
                </span>
              </>
            )}
          </div>

          {updateInfo?.hasUpdate ? (
            <button
              type="button"
              disabled={isUpdating}
              onClick={onPerformUpdate}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 transition cursor-pointer shrink-0 disabled:opacity-50"
            >
              <RefreshCw className={`size-3.5 ${isUpdating ? 'animate-spin' : ''}`} />
              <span>{isUpdating ? 'Atualizando...' : 'Atualizar e Reiniciar'}</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={isCheckingUpdate}
              onClick={onCheckUpdate}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background/70 px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition cursor-pointer shrink-0 disabled:opacity-50"
            >
              <RefreshCw className={`size-3 ${isCheckingUpdate ? 'animate-spin' : ''}`} />
              <span>{isCheckingUpdate ? 'Verificando...' : 'Verificar atualização'}</span>
            </button>
          )}
        </div>

        {/* Lista de Versões (Changelog) */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-4 scrollbar-sleek select-text">
          {VERSION_CHANGELOG.map((release, idx) => (
            <div
              key={release.version}
              className="rounded-xl border border-border/60 bg-background/40 p-3.5 space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-primary/15 px-2 py-0.5 text-xs font-bold text-primary font-mono">
                    v{release.version}
                  </span>
                  {idx === 0 && (
                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-500">
                      Atual
                    </span>
                  )}
                  <span className="text-xs font-semibold text-foreground">
                    {release.title}
                  </span>
                </div>
                <span className="text-[11px] text-muted-foreground shrink-0">
                  {release.date}
                </span>
              </div>

              <ul className="space-y-1.5 pl-4 text-xs text-muted-foreground list-disc">
                {release.highlights.map((item) => (
                  <li key={item} className="leading-relaxed text-foreground/90">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Rodapé com Link Direto para o Repositório GitHub e Site */}
        <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => openExternal(APP_REPO_URL)}
              title={APP_REPO_URL}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-accent/50 px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-accent transition-colors cursor-pointer"
            >
              <GitBranch className="size-3.5 text-primary" />
              <span>Repositório no GitHub</span>
              <ExternalLink className="size-3 text-muted-foreground" />
            </button>
            <button
              type="button"
              onClick={() => openExternal(APP_SITE_URL)}
              title={APP_SITE_URL}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
            >
              <span>md.rysdev.com</span>
              <ExternalLink className="size-3" />
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 transition cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
