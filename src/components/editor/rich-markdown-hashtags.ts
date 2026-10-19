import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

export type HashtagRange = {
  from: number
  to: number
  tag: string
}

export const richMarkdownHashtagPluginKey = new PluginKey<DecorationSet>(
  'richMarkdownHashtag'
)

/**
 * Matches `#<texto>` tags in plain text once they become a valid tag
 * (2..32 characters of letters, digits, accents, `_`, or `-`, preceded by start-of-string or whitespace).
 */
const HASHTAG_RE = /(?:^|\s)(#([a-zA-Z\u00C0-\u00FF0-9_-]{2,32}))(?=\s|[.,!?;:)\]]|$)/g

export function findPlainTextHashtagRanges(text: string): HashtagRange[] {
  if (!text) return []
  const ranges: HashtagRange[] = []
  HASHTAG_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = HASHTAG_RE.exec(text)) !== null) {
    const fullMatch = match[0]
    const hashToken = match[1]
    const tagBody = match[2]
    if (!hashToken || !tagBody) continue
    const leadingOffset = fullMatch.length - hashToken.length
    const from = match.index + leadingOffset
    const to = from + hashToken.length
    ranges.push({
      from,
      to,
      tag: tagBody.toLowerCase()
    })
  }
  return ranges
}

/**
 * Finds `#<texto>` hashtag ranges inside raw Markdown (for CodeMirror 6 Source mode),
 * skipping fenced code blocks and YAML frontmatter.
 */
export function findMarkdownSourceHashtagRanges(markdownText: string): HashtagRange[] {
  if (!markdownText) return []
  const ranges: HashtagRange[] = []
  const lines = markdownText.split('\n')

  let offset = 0
  let inFrontmatter = false
  let inFencedCode = false

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i]!
    const trimmed = rawLine.trim()

    if (i === 0 && trimmed === '---') {
      inFrontmatter = true
      offset += rawLine.length + 1
      continue
    }
    if (inFrontmatter) {
      if (trimmed === '---' || trimmed === '...') {
        inFrontmatter = false
      }
      offset += rawLine.length + 1
      continue
    }

    if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
      inFencedCode = !inFencedCode
      offset += rawLine.length + 1
      continue
    }

    if (!inFencedCode) {
      const lineRanges = findPlainTextHashtagRanges(rawLine)
      for (const r of lineRanges) {
        ranges.push({
          from: offset + r.from,
          to: offset + r.to,
          tag: r.tag
        })
      }
    }

    offset += rawLine.length + 1
  }

  return ranges
}

function buildProseMirrorHashtagDecorations(doc: ProseMirrorNode): DecorationSet {
  const decorations: Decoration[] = []

  doc.descendants((node, pos) => {
    if (node.type.name === 'codeBlock') {
      return false
    }
    if (!node.isText || !node.text) {
      return true
    }
    // Skip inline code marks
    if (node.marks.some((mark) => mark.type.name === 'code')) {
      return false
    }

    const ranges = findPlainTextHashtagRanges(node.text)
    for (const r of ranges) {
      const from = pos + r.from
      const to = pos + r.to
      if (to > from) {
        decorations.push(
          Decoration.inline(from, to, {
            class: 'rys-inline-tag',
            'data-tag': r.tag
          })
        )
      }
    }
    return false
  })

  return DecorationSet.create(doc, decorations)
}

export function createRichMarkdownHashtagPlugin(): Plugin<DecorationSet> {
  return new Plugin<DecorationSet>({
    key: richMarkdownHashtagPluginKey,
    state: {
      init: (_, state) => buildProseMirrorHashtagDecorations(state.doc),
      apply: (tr, oldSet) => {
        if (tr.docChanged) {
          return buildProseMirrorHashtagDecorations(tr.doc)
        }
        return oldSet
      }
    },
    props: {
      decorations(state) {
        return richMarkdownHashtagPluginKey.getState(state) ?? DecorationSet.empty
      }
    }
  })
}
