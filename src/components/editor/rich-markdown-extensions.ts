import {
  decodeHtmlEntities,
  type AnyExtension,
  type Editor,
  type MarkdownToken
} from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import { Code } from '@tiptap/extension-code'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { Table } from '@tiptap/extension-table'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import { TableRow } from '@tiptap/extension-table-row'
import { BlockMath, InlineMath } from '@tiptap/extension-mathematics'
import { Details, DetailsContent, DetailsSummary } from '@tiptap/extension-details'
import { Markdown } from '@tiptap/markdown'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { TextSelection } from '@tiptap/pm/state'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { createLowlight, common } from 'lowlight'
import { RichMarkdownCodeBlock } from './RichMarkdownCodeBlock'
import type { ToggleHeadingVariant } from './rich-markdown-slash-commands'
import { vaultClient } from '@/lib/vault-client'

const lowlight = createLowlight(common)

const TOGGLE_HEADING_VARIANTS: readonly ToggleHeadingVariant[] = [
  'heading-1',
  'heading-2',
  'heading-3',
  'heading-4',
  'heading-5'
]

function parseToggleHeadingVariant(value: unknown): ToggleHeadingVariant | null {
  return typeof value === 'string' &&
    TOGGLE_HEADING_VARIANTS.includes(value as ToggleHeadingVariant)
    ? (value as ToggleHeadingVariant)
    : null
}

type DetailsHtmlToken = MarkdownToken & {
  attributes?: Record<string, unknown>
  bodyTokens?: MarkdownToken[]
  summaryTokens?: MarkdownToken[]
}

function escapeDetailsHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function parseDetailsAttributes(rawAttributes: string): Record<string, unknown> {
  const variantMatch = rawAttributes.match(
    /\sdata-orca-toggle\s*=\s*(?:"(heading-[1-5])"|'(heading-[1-5])'|(heading-[1-5]))(?:\s|$)/i
  )
  return {
    open: /\sopen(?:\s|=|$)/i.test(rawAttributes),
    variant: parseToggleHeadingVariant(
      (variantMatch?.[1] ?? variantMatch?.[2] ?? variantMatch?.[3])?.toLowerCase()
    )
  }
}

function renderDetailsAttributes(attrs: Record<string, unknown> | undefined): string {
  const attributes = ['class="orca-details"']
  const variant = parseToggleHeadingVariant(attrs?.variant)
  if (variant) {
    attributes.push(`data-orca-toggle="${variant}"`)
  }
  if (attrs?.open === true) {
    attributes.push('open')
  }
  return attributes.join(' ')
}

function detailsBodyHtmlToMarkdown(body: string): string {
  return body
    .replace(/<p\b[^>]*>/gi, '')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .trim()
}

function matchDetailsHtmlBlock(content: string): {
  raw: string
  openingAttributes: string
  inner: string
} | null {
  const openingMatch = content.match(/^<details\b[^>]*>/i)
  if (!openingMatch) return null

  const detailsTagPattern = /<\/?details\b[^>]*>/gi
  let depth = 0

  for (;;) {
    const tagMatch = detailsTagPattern.exec(content)
    if (!tagMatch) return null
    const tag = tagMatch[0]
    const isClosingTag = /^<\/details\b/i.test(tag)
    if (isClosingTag) {
      depth -= 1
      if (depth === 0) {
        const closingEnd = tagMatch.index + tag.length
        return {
          raw: content.slice(0, closingEnd),
          openingAttributes: openingMatch[0].replace(/^<details\b/i, '').replace(/>$/u, ''),
          inner: content.slice(openingMatch[0].length, tagMatch.index)
        }
      }
    } else {
      depth += 1
    }
  }
}

function extractDetailsSummaryHtml(inner: string): {
  content: string
  rawLength: number
} | null {
  const match = inner.match(/^\s*<summary\b[^>]*>([\s\S]*?)<\/summary>/i)
  if (!match) return null
  return {
    content: match[1] ?? '',
    rawLength: match[0].length
  }
}

function moveDetailsSummarySelectionToContent(editor: Editor): boolean {
  const { state, view } = editor
  const { selection } = state
  const { $from, empty } = selection

  if (!empty || $from.parent.type.name !== 'detailsSummary') {
    return false
  }

  const detailsDepth = $from.depth - 1
  if (detailsDepth < 1) return false

  const detailsNode = $from.node(detailsDepth)
  if (detailsNode.type.name !== 'details' || detailsNode.attrs.open === false) {
    return false
  }

  const detailsContent = detailsNode.child(1)
  if (detailsContent?.type.name !== 'detailsContent') {
    return false
  }

  const detailsStart = $from.before(detailsDepth)
  const detailsContentStart = detailsStart + 1 + detailsNode.child(0).nodeSize
  const firstBodyNode = detailsContent.firstChild
  if (!firstBodyNode?.isTextblock) return false

  const targetPos = detailsContentStart + 2
  const tr = state.tr.setSelection(TextSelection.near(state.doc.resolve(targetPos), 1))
  tr.scrollIntoView()
  view.dispatch(tr)
  return true
}

function handleDetailsBackspace(editor: Editor): boolean {
  const { state, view } = editor
  const { selection, schema } = state
  const { $from, empty } = selection
  if (!empty || $from.parentOffset !== 0) return false

  // Case 1: Cursor at start of detailsSummary
  if ($from.parent.type.name === 'detailsSummary') {
    const detailsDepth = $from.depth - 1
    if (detailsDepth < 1) return false
    const detailsNode = $from.node(detailsDepth)
    if (detailsNode.type.name !== 'details') return false

    const detailsStart = $from.before(detailsDepth)
    const detailsEnd = $from.after(detailsDepth)
    const summaryNode = detailsNode.child(0)
    const contentNode = detailsNode.childCount > 1 ? detailsNode.child(1) : null

    const summaryEmpty = summaryNode.textContent.trim().length === 0
    const contentEmpty = !contentNode || contentNode.textContent.trim().length === 0

    if (summaryEmpty && contentEmpty) {
      const p = schema.nodes.paragraph.create()
      const tr = state.tr.replaceWith(detailsStart, detailsEnd, p)
      tr.setSelection(TextSelection.near(tr.doc.resolve(detailsStart + 1)))
      tr.scrollIntoView()
      view.dispatch(tr)
      return true
    }

    // Unwrap details into normal blocks preserving content
    const replacementNodes = [
      schema.nodes.paragraph.create(null, summaryNode.content)
    ]
    if (contentNode && !contentEmpty) {
      contentNode.forEach((child) => {
        replacementNodes.push(child)
      })
    }
    const tr = state.tr.replaceWith(detailsStart, detailsEnd, replacementNodes)
    tr.setSelection(TextSelection.near(tr.doc.resolve(detailsStart + 1)))
    tr.scrollIntoView()
    view.dispatch(tr)
    return true
  }

  // Case 2: Cursor at start of the first child inside detailsContent
  if (
    $from.depth >= 2 &&
    $from.node($from.depth - 1).type.name === 'detailsContent' &&
    $from.index($from.depth - 1) === 0
  ) {
    const detailsDepth = $from.depth - 2
    if (detailsDepth < 1) return false
    const detailsNode = $from.node(detailsDepth)
    if (detailsNode.type.name !== 'details') return false

    const detailsStart = $from.before(detailsDepth)
    const detailsEnd = $from.after(detailsDepth)
    const summaryNode = detailsNode.child(0)
    const contentNode = detailsNode.child(1)

    const summaryEmpty = summaryNode.textContent.trim().length === 0
    const contentEmpty = contentNode.textContent.trim().length === 0

    if (summaryEmpty && contentEmpty) {
      const p = schema.nodes.paragraph.create()
      const tr = state.tr.replaceWith(detailsStart, detailsEnd, p)
      tr.setSelection(TextSelection.near(tr.doc.resolve(detailsStart + 1)))
      tr.scrollIntoView()
      view.dispatch(tr)
      return true
    }

    // Move cursor to the end of detailsSummary
    const summaryEndPos = detailsStart + 1 + summaryNode.nodeSize - 1
    const tr = state.tr.setSelection(
      TextSelection.near(state.doc.resolve(summaryEndPos), -1)
    )
    tr.scrollIntoView()
    view.dispatch(tr)
    return true
  }

  return false
}

const OrcaDetails = Details.extend({
  priority: 1000,
  addAttributes() {
    return {
      ...this.parent?.(),
      variant: {
        default: null,
        parseHTML: (element) =>
          parseToggleHeadingVariant(element.getAttribute('data-orca-toggle')),
        renderHTML: ({ variant }) => {
          const parsed = parseToggleHeadingVariant(variant)
          return parsed ? { 'data-orca-toggle': parsed } : {}
        }
      }
    }
  },
  addKeyboardShortcuts() {
    const parentShortcuts = this.parent?.() ?? {}
    return {
      ...parentShortcuts,
      Enter: ({ editor }) =>
        moveDetailsSummarySelectionToContent(editor) ||
        parentShortcuts.Enter?.({ editor }) ||
        false,
      Backspace: ({ editor }) =>
        handleDetailsBackspace(editor) ||
        parentShortcuts.Backspace?.({ editor }) ||
        false
    }
  },
  markdownTokenizer: {
    name: 'details',
    level: 'block',
    start: (source: string) => source.search(/<details\b/i),
    tokenize(src, _tokens, lexer) {
      const detailsBlock = matchDetailsHtmlBlock(src)
      if (!detailsBlock) return undefined
      const summaryHtml = extractDetailsSummaryHtml(detailsBlock.inner)
      if (!summaryHtml) return undefined
      const summary = decodeHtmlEntities(summaryHtml.content.trim())
      const body = detailsBlock.inner.slice(summaryHtml.rawLength)
      return {
        type: 'details',
        raw: detailsBlock.raw,
        block: true,
        attributes: parseDetailsAttributes(detailsBlock.openingAttributes),
        summaryTokens: lexer.inlineTokens(summary),
        bodyTokens: lexer.blockTokens(detailsBodyHtmlToMarkdown(body))
      } as DetailsHtmlToken
    }
  },
  parseMarkdown: (token, helpers) => {
    const detailsToken = token as DetailsHtmlToken
    if (detailsToken.type !== 'details') return []
    const summary = helpers.createNode(
      'detailsSummary',
      {},
      helpers.parseInline(detailsToken.summaryTokens ?? [])
    )
    const body = helpers.parseChildren(detailsToken.bodyTokens ?? [])
    const content = helpers.createNode(
      'detailsContent',
      {},
      body.length > 0 ? body : [helpers.createNode('paragraph')]
    )
    return helpers.createNode('details', detailsToken.attributes ?? {}, [summary, content])
  },
  renderMarkdown: (node, helpers) => {
    const summary = node.content?.find((child) => child.type === 'detailsSummary')
    const content = node.content?.find((child) => child.type === 'detailsContent')
    const summaryText = escapeDetailsHtml(
      decodeHtmlEntities(helpers.renderChildren(summary?.content ?? [], ''))
    )
    const body = helpers.renderChildren(content?.content ?? [], '\n\n').trim()
    const attrs = renderDetailsAttributes(node.attrs)
    return `<details ${attrs}>\n<summary>${summaryText}</summary>\n\n${body}\n\n</details>`
  }
})

const OrcaDetailsSummary = DetailsSummary.extend({
  content: 'inline*'
})

const RichMarkdownCode = Code.extend({
  excludes: 'code bold italic strike underline'
})

export function createRichMarkdownExtensions(vaultPath: string): AnyExtension[] {
  return [
    StarterKit.configure({
      link: false,
      code: false,
      codeBlock: false
    }),
    RichMarkdownCode,
    CodeBlockLowlight.extend({
      addNodeView() {
        return ReactNodeViewRenderer(RichMarkdownCodeBlock)
      }
    }).configure({
      lowlight,
      defaultLanguage: null
    }),
    Link.configure({
      openOnClick: false,
      autolink: true,
      linkOnPaste: true
    }),
    Image.extend({
      addNodeView() {
        return ({ node, HTMLAttributes }) => {
          const dom = document.createElement('span')
          dom.style.display = 'inline-block'
          dom.style.lineHeight = '0'
          dom.style.maxWidth = '100%'

          const img = document.createElement('img')
          img.draggable = false
          for (const [key, value] of Object.entries(HTMLAttributes)) {
            if (key !== 'src' && value != null && value !== false) {
              img.setAttribute(key, String(value))
            }
          }
          const applySrc = (srcValue: string) => {
            img.src = vaultClient.resolveAssetUrl(vaultPath, srcValue)
            void vaultClient.resolveAssetUrlAsync(vaultPath, srcValue).then((resolved) => {
              if (resolved && img.src !== resolved) {
                img.src = resolved
              }
            })
          }
          const rawSrc = (node.attrs.src as string) || ''
          applySrc(rawSrc)
          dom.appendChild(img)

          return {
            dom,
            update: (updatedNode) => {
              if (updatedNode.type.name !== 'image') return false
              const nextSrc = (updatedNode.attrs.src as string) || ''
              applySrc(nextSrc)
              return true
            }
          }
        }
      }
    }).configure({
      allowBase64: true,
      inline: true
    }),
    TaskList,
    TaskItem.configure({
      nested: true
    }),
    OrcaDetails.configure({
      persist: true,
      HTMLAttributes: {
        class: 'orca-details'
      }
    }),
    OrcaDetailsSummary,
    DetailsContent,
    Table.configure({
      resizable: false
    }),
    TableRow,
    TableHeader,
    TableCell,
    InlineMath.configure({
      katexOptions: {
        throwOnError: false
      }
    }),
    BlockMath.configure({
      katexOptions: {
        displayMode: true,
        throwOnError: false
      }
    }),
    Markdown.configure({
      markedOptions: {
        gfm: true
      }
    }),
    Placeholder.configure({
      includeChildren: true,
      placeholder: ({ node }) => {
        if (node.type.name === 'detailsSummary') {
          return 'Título da seção retrátil...'
        }
        return 'Escreva em Markdown… Digite / para inserir blocos.'
      }
    })
  ]
}
