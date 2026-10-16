import { marked } from 'marked'
import { vaultClient } from '@/lib/vault-client'

const EXPORT_A4_CSS = `
  @page {
    size: A4 portrait;
    margin: 18mm 16mm;
  }

  * {
    box-sizing: border-box;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  html,
  body {
    margin: 0;
    padding: 0;
    background: #ffffff;
    color: #0f172a;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif;
    line-height: 1.68;
    font-size: 11pt;
  }

  .markdown-export-shell {
    max-width: 100%;
    margin: 0 auto;
    padding: 0;
  }

  .markdown-export-content > :first-child {
    margin-top: 0;
  }

  h1, h2, h3, h4, h5, h6 {
    color: #0f172a;
    font-weight: 700;
    line-height: 1.25;
    margin-top: 1.4em;
    margin-bottom: 0.45em;
    page-break-after: avoid;
    break-after: avoid-page;
    page-break-inside: avoid;
    break-inside: avoid;
  }

  h1 {
    font-size: 20pt;
    letter-spacing: -0.02em;
    border-bottom: 1px solid #e2e8f0;
    padding-bottom: 0.25em;
  }
  h2 { font-size: 15pt; }
  h3 { font-size: 12.5pt; }
  h4 { font-size: 11pt; }
  h5 { font-size: 10pt; color: #475569; }
  h6 { font-size: 9.5pt; color: #64748b; }

  p, ul, ol, blockquote, table, pre, details, hr {
    margin: 0.75em 0;
  }

  p, li {
    orphans: 3;
    widows: 3;
  }

  ul, ol {
    padding-left: 1.5em;
  }

  ul { list-style: disc; }
  ol { list-style: decimal; }
  li + li { margin-top: 0.22em; }

  ul[data-type='taskList'] {
    padding-left: 0;
    list-style: none;
  }

  ul[data-type='taskList'] > li {
    display: flex;
    align-items: flex-start;
    gap: 0.55em;
    page-break-inside: avoid;
    break-inside: avoid;
  }

  ul[data-type='taskList'] > li > label {
    display: inline-flex;
    align-items: center;
    margin-top: 0.18em;
  }

  ul[data-type='taskList'] > li[data-checked='true'] > div {
    text-decoration: line-through;
    color: #64748b;
  }

  blockquote {
    padding: 0.55em 1em;
    border-left: 3px solid #0a84ff;
    background: #f8fafc;
    border-radius: 0 6px 6px 0;
    color: #334155;
    page-break-inside: avoid;
    break-inside: avoid;
  }

  code {
    padding: 0.14em 0.36em;
    border-radius: 4px;
    background: #f1f5f9;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 0.9em;
  }

  pre,
  .rich-markdown-code-block-wrapper {
    padding: 0.85em 1em;
    overflow-x: auto;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    background: #f8fafc;
    page-break-inside: avoid;
    break-inside: avoid;
  }

  .rich-markdown-code-block-wrapper pre {
    margin: 0;
    padding: 0;
    border: none;
    background: transparent;
  }

  pre code {
    padding: 0;
    background: transparent;
    white-space: pre-wrap;
    word-break: break-word;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    table-layout: auto;
    page-break-inside: auto;
    break-inside: auto;
  }

  thead {
    display: table-header-group;
  }

  tr {
    page-break-inside: avoid;
    break-inside: avoid;
  }

  th, td {
    padding: 0.5em 0.75em;
    border: 1px solid #cbd5e1;
    text-align: left;
    vertical-align: top;
    overflow-wrap: break-word;
  }

  th {
    background: #f1f5f9;
    font-weight: 600;
  }

  hr {
    border: 0;
    border-top: 1px solid #cbd5e1;
    page-break-after: avoid;
    break-after: avoid;
  }

  a {
    color: #0284c7;
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  img,
  svg,
  .mermaid-preview,
  .tiptap-mathematics-render {
    max-width: 100%;
    height: auto;
    page-break-inside: avoid;
    break-inside: avoid;
  }

  img {
    display: block;
    border-radius: 8px;
    margin: 0.5em 0;
  }

  details,
  .orca-details {
    margin: 0.75em 0;
    padding-left: 0.9em;
    border-left: 2px solid #cbd5e1;
    page-break-inside: avoid;
    break-inside: avoid;
  }

  summary {
    font-weight: 600;
    cursor: default;
  }

  /* Syntax highlighting tokens for exported PDF */
  .hljs-keyword { color: #cf222e; }
  .hljs-string { color: #0a3069; }
  .hljs-number { color: #0550ae; }
  .hljs-comment { color: #6e7781; font-style: italic; }
  .hljs-function, .hljs-title { color: #8250df; }
  .hljs-built_in, .hljs-type, .hljs-attr, .hljs-property { color: #0550ae; }
  .hljs-variable, .hljs-params { color: #953800; }
`

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

async function urlToDataUrl(src: string): Promise<string> {
  try {
    const response = await fetch(src)
    if (!response.ok) return src
    const blob = await response.blob()
    return await new Promise<string>((resolve) => {
      const reader = new FileReader()
      reader.onload = () =>
        resolve(typeof reader.result === 'string' ? reader.result : src)
      reader.onerror = () => resolve(src)
      reader.readAsDataURL(blob)
    })
  } catch {
    return src
  }
}

async function extractCleanHtmlFromEditorDom(): Promise<string | null> {
  const editorDom = document.querySelector<HTMLElement>(
    '.rich-markdown-editor.ProseMirror'
  )
  if (!editorDom) return null

  const clone = editorDom.cloneNode(true) as HTMLElement

  // Remove interactive-only editor chrome
  clone
    .querySelectorAll(
      '.rich-markdown-code-block-lang, .code-block-copy-btn, .orca-details > button, [data-orca-selection-ui]'
    )
    .forEach((node) => node.remove())

  // Ensure all collapsible toggle sections are expanded for PDF export
  clone.querySelectorAll('details').forEach((details) => {
    details.setAttribute('open', '')
  })

  // Inline local/blob images as data URLs so standalone PDF renderer displays them
  const images = Array.from(clone.querySelectorAll('img'))
  await Promise.all(
    images.map(async (img) => {
      const src = img.getAttribute('src') ?? ''
      if (
        src.startsWith('blob:') ||
        src.startsWith('/api/vault/asset') ||
        src.startsWith('http://127.0.0.1') ||
        src.startsWith('http://localhost')
      ) {
        const inlined = await urlToDataUrl(src)
        img.setAttribute('src', inlined)
      }
    })
  )

  return clone.innerHTML
}

export function buildMarkdownExportHtml(params: {
  title: string
  bodyHtml: string
}): string {
  const { title, bodyHtml } = params
  return `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>${EXPORT_A4_CSS}</style>
  </head>
  <body>
    <main class="markdown-export-shell">
      <article class="markdown-export-content">${bodyHtml}</article>
    </main>
  </body>
</html>`
}

export function sanitizePdfFileName(noteTitle: string): string {
  const cleaned = noteTitle
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const base = cleaned || 'Nota'
  return base.toLowerCase().endsWith('.pdf') ? base : `${base}.pdf`
}

export async function exportActiveNoteToPdf(params: {
  title: string
  markdownContent: string
}): Promise<{ ok: boolean; savedPath?: string; cancelled?: boolean }> {
  const { title, markdownContent } = params
  const defaultFileName = sanitizePdfFileName(title)

  let bodyHtml = await extractCleanHtmlFromEditorDom()
  if (!bodyHtml) {
    const bodyWithoutFrontmatter = markdownContent.replace(
      /^---\r?\n[\s\S]*?\r?\n---\r?\n+/,
      ''
    )
    bodyHtml = await marked.parse(bodyWithoutFrontmatter, { gfm: true })
  }

  const fullHtml = buildMarkdownExportHtml({
    title: title || 'Nota',
    bodyHtml
  })

  return vaultClient.exportPdf({
    defaultFileName,
    title: title || 'Nota',
    html: fullHtml
  })
}
