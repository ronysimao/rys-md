import type { Node as ProseMirrorNode } from '@tiptap/pm/model'

export type TableOfContentsItem = {
  id: string
  level: 1 | 2 | 3 | 4 | 5
  text: string
  line?: number
  pos?: number
}

export type TableOfContentsTreeNode = TableOfContentsItem & {
  children: TableOfContentsTreeNode[]
}

export const TABLE_OF_CONTENTS_LEVELS = [1, 2, 3, 4, 5] as const

export function extractMarkdownTableOfContents(
  markdown: string
): TableOfContentsItem[] {
  const lines = markdown.split(/\r?\n/)
  const items: TableOfContentsItem[] = []
  let activeFence: '```' | '~~~' | null = null

  lines.forEach((rawLine, index) => {
    const trimmed = rawLine.trim()
    if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
      const marker = trimmed.slice(0, 3) as '```' | '~~~'
      if (activeFence === marker) {
        activeFence = null
      } else if (!activeFence) {
        activeFence = marker
      }
      return
    }
    if (activeFence) {
      return
    }

    const match = rawLine.match(/^\s{0,3}(#{1,5})[ \t]+(.+?)\s*$/)
    if (!match) {
      return
    }

    const hashes = match[1] ?? ''
    const rawHeadingText = match[2] ?? ''
    const level = hashes.length
    if (level < 1 || level > 5) {
      return
    }

    const text = normalizeHeadingText(rawHeadingText)
    if (!text) {
      return
    }

    items.push({
      id: `line-${index + 1}-${level}-${items.length}`,
      level: level as 1 | 2 | 3 | 4 | 5,
      text,
      line: index + 1
    })
  })

  return items
}

export function extractRichMarkdownTableOfContents(
  doc: ProseMirrorNode
): TableOfContentsItem[] {
  const items: TableOfContentsItem[] = []

  doc.descendants((node, pos) => {
    let level: number | null = null

    if (node.type.name === 'heading') {
      level = Number(node.attrs.level ?? 0)
    } else if (node.type.name === 'detailsSummary') {
      // Also support Toggle Headings (Toggle H1, Toggle H2, Toggle H3)
      doc.nodesBetween(Math.max(0, pos - 2), Math.min(doc.content.size, pos + 2), (parent) => {
        if (parent.type.name === 'details' && typeof parent.attrs.variant === 'string') {
          const m = parent.attrs.variant.match(/^heading-(\d)$/)
          if (m) level = Number(m[1])
        }
      })
    }

    if (!level || !Number.isInteger(level) || level < 1 || level > 5) {
      return
    }

    const text = normalizeHeadingText(node.textContent)
    if (!text) {
      return
    }

    items.push({
      id: `pos-${pos}-${level}-${items.length}`,
      level: level as 1 | 2 | 3 | 4 | 5,
      text,
      pos
    })
  })

  return items
}

export function buildTableOfContentsTree(
  items: readonly TableOfContentsItem[]
): TableOfContentsTreeNode[] {
  const roots: TableOfContentsTreeNode[] = []
  const stack: TableOfContentsTreeNode[] = []

  items.forEach((item) => {
    const node: TableOfContentsTreeNode = {
      ...item,
      children: []
    }

    while (stack.length > 0 && stack[stack.length - 1]!.level >= node.level) {
      stack.pop()
    }

    const parent = stack[stack.length - 1]
    if (parent) {
      parent.children.push(node)
    } else {
      roots.push(node)
    }

    stack.push(node)
  })

  return roots
}

export function collectBranchIdsByLevels(
  nodes: readonly TableOfContentsTreeNode[],
  collapsedLevels: ReadonlySet<TableOfContentsItem['level']>
): Set<string> {
  const collapsedIds = new Set<string>()

  const visit = (entries: readonly TableOfContentsTreeNode[]) => {
    entries.forEach((entry) => {
      if (entry.children.length > 0 && collapsedLevels.has(entry.level)) {
        collapsedIds.add(entry.id)
      }
      if (entry.children.length > 0) {
        visit(entry.children)
      }
    })
  }

  visit(nodes)
  return collapsedIds
}

export function getCollapsibleTableOfContentsLevels(
  nodes: readonly TableOfContentsTreeNode[]
): Set<TableOfContentsItem['level']> {
  const levels = new Set<TableOfContentsItem['level']>()

  const visit = (entries: readonly TableOfContentsTreeNode[]) => {
    entries.forEach((entry) => {
      if (entry.children.length > 0) {
        levels.add(entry.level)
        visit(entry.children)
      }
    })
  }

  visit(nodes)
  return levels
}

export function areAllLevelNodesCollapsed(
  nodes: readonly TableOfContentsTreeNode[],
  level: TableOfContentsItem['level'],
  collapsedIds: ReadonlySet<string>
): boolean {
  let sawMatchingBranch = false

  const visit = (entries: readonly TableOfContentsTreeNode[]): boolean => {
    for (const entry of entries) {
      if (entry.children.length > 0) {
        if (entry.level === level) {
          sawMatchingBranch = true
          if (!collapsedIds.has(entry.id)) {
            return false
          }
        }
        if (!visit(entry.children)) {
          return false
        }
      }
    }
    return true
  }

  return visit(nodes) && sawMatchingBranch
}

function normalizeHeadingText(value: string): string {
  return value
    .replace(/[ \t]+#+[ \t]*$/, '')
    .replace(/\s+/g, ' ')
    .trim()
}
