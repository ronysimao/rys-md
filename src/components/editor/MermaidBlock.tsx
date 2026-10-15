import React, { useEffect, useId, useState } from 'react'
import type mermaidNamespace from 'mermaid'
import DOMPurify from 'dompurify'
import { getMermaidConfig, readMermaidThemeColors } from './mermaid-config'

type MermaidApi = typeof mermaidNamespace

let mermaidModulePromise: Promise<MermaidApi> | null = null
function loadMermaid(): Promise<MermaidApi> {
  if (!mermaidModulePromise) {
    mermaidModulePromise = import('mermaid').then((mod) => mod.default)
  }
  return mermaidModulePromise
}

export type RenderedMermaidDiagram = { svg: string; background?: string }

type MermaidBlockProps = {
  content: string
  isDark: boolean
  htmlLabels?: boolean
  className?: string
}

let renderQueue: Promise<void> = Promise.resolve()

function enqueueRender(fn: () => Promise<void>): void {
  const tail = renderQueue.then(fn, fn).then(() => {
    if (renderQueue === tail) {
      renderQueue = Promise.resolve()
    }
  })
  renderQueue = tail
}

export default function MermaidBlock({
  content,
  isDark,
  htmlLabels = false,
  className
}: MermaidBlockProps): React.JSX.Element {
  const id = useId().replace(/:/g, '_')
  const [rendered, setRendered] = useState<{
    content: string
    result: RenderedMermaidDiagram | { error: string }
  } | null>(null)

  const result = rendered?.result ?? null

  useEffect(() => {
    let cancelled = false

    const render = async (): Promise<void> => {
      try {
        const mermaid = await loadMermaid()
        if (cancelled) return
        const colors = readMermaidThemeColors(isDark)
        mermaid.initialize(getMermaidConfig(isDark, htmlLabels, colors))
        const { svg } = await mermaid.render(`mermaid-${id}`, content)
        if (!cancelled) {
          setRendered({
            content,
            result: {
              svg: DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true } }),
              background: colors.background
            }
          })
        }
      } catch (err) {
        if (!cancelled) {
          setRendered({
            content,
            result: {
              error: err instanceof Error ? err.message : 'Sintaxe Mermaid inválida'
            }
          })
          const errorEl = document.getElementById(`d${`mermaid-${id}`}`)
          errorEl?.remove()
        }
      }
    }

    enqueueRender(render)
    return () => {
      cancelled = true
    }
  }, [content, htmlLabels, isDark, id])

  const diagram =
    result && 'error' in result ? (
      <div className="mermaid-block">
        <div className="mermaid-error text-xs text-red-400 mb-2 font-mono">
          Erro no diagrama: {result.error}
        </div>
        <pre className="text-xs opacity-75">
          <code>{content}</code>
        </pre>
      </div>
    ) : (
      <div
        className="mermaid-block flex justify-center py-2 overflow-x-auto"
        dangerouslySetInnerHTML={result ? { __html: result.svg } : undefined}
      />
    )
  return className ? <div className={className}>{diagram}</div> : diagram
}
