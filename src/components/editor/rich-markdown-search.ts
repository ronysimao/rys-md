import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

export type TextMatchOptions = {
  matchCase?: boolean
  wholeWord?: boolean
}

export type RichMarkdownSearchMatch = {
  from: number
  to: number
}

type RichMarkdownSearchState = {
  activeIndex: number
  decorations: DecorationSet
  query: string
}

type RichMarkdownSearchMeta = {
  activeIndex: number
  matches: RichMarkdownSearchMatch[]
  query: string
}

export const richMarkdownSearchPluginKey = new PluginKey<RichMarkdownSearchState>(
  'richMarkdownSearch'
)

function isWordChar(ch: string | undefined): boolean {
  if (!ch) return false
  return /[\p{L}\p{N}_]/u.test(ch)
}

export function findPlainTextMatchRanges(
  text: string,
  query: string,
  options?: TextMatchOptions
): { from: number; to: number }[] {
  if (!query || query.length > 2000 || !text) {
    return []
  }

  const matchCase = Boolean(options?.matchCase)
  const wholeWord = Boolean(options?.wholeWord)
  const haystack = matchCase ? text : text.toLowerCase()
  const needle = matchCase ? query : query.toLowerCase()
  if (!needle) return []

  const results: { from: number; to: number }[] = []
  let searchFrom = 0

  while (searchFrom <= haystack.length - needle.length) {
    const idx = haystack.indexOf(needle, searchFrom)
    if (idx === -1) break
    const end = idx + needle.length

    if (wholeWord) {
      const before = idx > 0 ? text[idx - 1] : undefined
      const after = end < text.length ? text[end] : undefined
      if (isWordChar(before) || isWordChar(after)) {
        searchFrom = idx + 1
        continue
      }
    }

    results.push({ from: idx, to: end })
    searchFrom = idx + Math.max(1, needle.length)
  }

  return results
}

type BlockTextRun = {
  text: string
  segments: { textFrom: number; textTo: number; pmFrom: number; pmTo: number }[]
}

export function findRichMarkdownSearchMatches(
  doc: ProseMirrorNode,
  query: string,
  options?: TextMatchOptions
): RichMarkdownSearchMatch[] {
  if (!query || query.length > 2000) {
    return []
  }

  const runs: BlockTextRun[] = []

  // Walk textblocks and contiguous inline text nodes (exactly like Orca's visible text map)
  doc.descendants((node, pos) => {
    if (!node.isTextblock) {
      return true
    }

    let text = ''
    const segments: BlockTextRun['segments'] = []

    node.descendants((child, childOffset) => {
      if (child.isText && child.text) {
        const pmFrom = pos + 1 + childOffset
        const pmTo = pmFrom + child.text.length
        const textFrom = text.length
        text += child.text
        const textTo = text.length
        segments.push({ textFrom, textTo, pmFrom, pmTo })
      } else if (child.isLeaf && !child.isText) {
        // Separator for hardBreak or inline leaf atoms so matches don't cross non-text atoms
        text += '\n'
      }
      return true
    })

    if (text.length > 0 && segments.length > 0) {
      runs.push({ text, segments })
    }
    return false
  })

  const matches: RichMarkdownSearchMatch[] = []

  for (const run of runs) {
    const ranges = findPlainTextMatchRanges(run.text, query, options)
    for (const range of ranges) {
      let pmFrom = -1
      let pmTo = -1
      let valid = true

      for (const seg of run.segments) {
        if (seg.textTo <= range.from) continue
        if (seg.textFrom >= range.to) break

        if (range.from >= seg.textFrom && range.from < seg.textTo) {
          pmFrom = seg.pmFrom + (range.from - seg.textFrom)
        }
        if (range.to > seg.textFrom && range.to <= seg.textTo) {
          pmTo = seg.pmFrom + (range.to - seg.textFrom)
        }
      }

      // Ensure match didn't cross a non-text leaf separator (\n)
      const matchedSubstring = run.text.slice(range.from, range.to)
      if (matchedSubstring.includes('\n') && !query.includes('\n')) {
        valid = false
      }

      if (valid && pmFrom >= 0 && pmTo > pmFrom) {
        matches.push({ from: pmFrom, to: pmTo })
      }
    }
  }

  return matches
}

export function createRichMarkdownSearchPlugin(): Plugin<RichMarkdownSearchState> {
  return new Plugin<RichMarkdownSearchState>({
    key: richMarkdownSearchPluginKey,
    state: {
      init: () => ({
        activeIndex: -1,
        decorations: DecorationSet.empty,
        query: ''
      }),
      apply: (tr, pluginState) => {
        const meta = tr.getMeta(richMarkdownSearchPluginKey) as
          | RichMarkdownSearchMeta
          | undefined
        const query = meta ? meta.query : pluginState.query
        const activeIndex = meta ? meta.activeIndex : pluginState.activeIndex

        if (!query) {
          return {
            activeIndex: -1,
            decorations: DecorationSet.empty,
            query: ''
          }
        }

        if (meta) {
          return {
            activeIndex,
            decorations: buildSearchDecorationsFromMatches(
              tr.doc,
              meta.matches,
              activeIndex
            ),
            query
          }
        }

        if (tr.docChanged) {
          return {
            activeIndex: pluginState.activeIndex,
            decorations: pluginState.decorations.map(tr.mapping, tr.doc),
            query: pluginState.query
          }
        }

        return pluginState
      }
    },
    props: {
      decorations(state) {
        return (
          richMarkdownSearchPluginKey.getState(state)?.decorations ??
          DecorationSet.empty
        )
      }
    }
  })
}

function buildSearchDecorationsFromMatches(
  doc: ProseMirrorNode,
  matches: RichMarkdownSearchMatch[],
  activeIndex: number
): DecorationSet {
  if (matches.length === 0) {
    return DecorationSet.empty
  }

  const decorations = matches.map((match, index) =>
    Decoration.inline(match.from, match.to, {
      class: 'rich-markdown-search-match',
      'data-active': index === activeIndex ? 'true' : undefined
    })
  )

  return DecorationSet.create(doc, decorations)
}
