import React from 'react'
import type { Editor } from '@tiptap/react'
import { TextSelection } from '@tiptap/pm/state'
import {
  ChevronRight,
  Code2,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Heading5,
  ImageIcon,
  List,
  ListOrdered,
  ListTodo,
  Minus,
  Pilcrow,
  Quote,
  Sigma,
  Table2,
  Workflow
} from 'lucide-react'

export type ToggleHeadingVariant =
  | 'heading-1'
  | 'heading-2'
  | 'heading-3'
  | 'heading-4'
  | 'heading-5'

export type SlashMenuState = {
  query: string
  from: number
  to: number
  left: number
  top: number
}

export type SlashCommandId =
  | 'text'
  | 'toggle-text'
  | 'heading-1'
  | 'toggle-h1'
  | 'heading-2'
  | 'toggle-h2'
  | 'heading-3'
  | 'toggle-h3'
  | 'heading-4'
  | 'toggle-h4'
  | 'heading-5'
  | 'toggle-h5'
  | 'task-list'
  | 'bullet-list'
  | 'ordered-list'
  | 'blockquote'
  | 'code-block'
  | 'divider'
  | 'image'
  | 'table'
  | 'mermaid'
  | 'inline-math'
  | 'math-block'
  | 'emoji'

export type SlashCommandIcon =
  | { kind: 'component'; component: React.ComponentType<{ className?: string }> }
  | { kind: 'text'; value: string }

export type SlashCommandGroup =
  | 'Títulos'
  | 'Títulos Retráteis'
  | 'Blocos Básicos'
  | 'Avançado'
  | 'Mídia'

export type SlashCommand = {
  id: SlashCommandId
  label: string
  aliases: string[]
  icon: SlashCommandIcon
  group: SlashCommandGroup
  description: string
  run: (editor: Editor) => void
}

export function icon(component: React.ComponentType<{ className?: string }>): SlashCommandIcon {
  return { kind: 'component', component }
}

export function textIcon(value: string): SlashCommandIcon {
  return { kind: 'text', value }
}

export function insertCodeBlock(editor: Editor, language: string, text: string): void {
  editor.commands.command(({ state, dispatch }) => {
    const codeBlockType = state.schema.nodes.codeBlock
    if (!codeBlockType) return false
    const node = codeBlockType.create({ language }, text ? state.schema.text(text) : undefined)
    const tr = state.tr.replaceSelectionWith(node).scrollIntoView()
    const cursor = tr.selection.from + 1
    tr.setSelection(TextSelection.create(tr.doc, cursor, cursor))
    dispatch?.(tr)
    return true
  })
}

export function insertToggle(editor: Editor, variant?: ToggleHeadingVariant): void {
  const insertAt = editor.state.selection.from

  editor
    .chain()
    .focus()
    .insertContentAt(insertAt, {
      type: 'details',
      attrs: {
        open: true,
        ...(variant ? { variant } : {})
      },
      content: [
        {
          type: 'detailsSummary'
        },
        {
          type: 'detailsContent',
          content: [{ type: 'paragraph' }]
        }
      ]
    })
    .setTextSelection(insertAt + 1)
    .run()
}

export const slashCommands: SlashCommand[] = [
  {
    id: 'heading-1',
    label: 'Título 1',
    aliases: ['h1', 'heading 1', 'title', 'titulo 1'],
    icon: icon(Heading1),
    group: 'Títulos',
    description: 'Cabeçalho de seção grande.',
    run: (editor) => editor.chain().focus().setHeading({ level: 1 }).run()
  },
  {
    id: 'heading-2',
    label: 'Título 2',
    aliases: ['h2', 'heading 2', 'titulo 2'],
    icon: icon(Heading2),
    group: 'Títulos',
    description: 'Cabeçalho de seção médio.',
    run: (editor) => editor.chain().focus().setHeading({ level: 2 }).run()
  },
  {
    id: 'heading-3',
    label: 'Título 3',
    aliases: ['h3', 'heading 3', 'titulo 3'],
    icon: icon(Heading3),
    group: 'Títulos',
    description: 'Cabeçalho de seção pequeno.',
    run: (editor) => editor.chain().focus().setHeading({ level: 3 }).run()
  },
  {
    id: 'heading-4',
    label: 'Título 4',
    aliases: ['h4', 'heading 4', 'titulo 4'],
    icon: icon(Heading4),
    group: 'Títulos',
    description: 'Subtítulo de nível 4.',
    run: (editor) => editor.chain().focus().setHeading({ level: 4 }).run()
  },
  {
    id: 'heading-5',
    label: 'Título 5',
    aliases: ['h5', 'heading 5', 'titulo 5'],
    icon: icon(Heading5),
    group: 'Títulos',
    description: 'Subtítulo compacto de nível 5.',
    run: (editor) => editor.chain().focus().setHeading({ level: 5 }).run()
  },
  {
    id: 'toggle-h1',
    label: 'Toggle H1',
    aliases: ['toggle-h1', 'toggle heading', 'details heading'],
    icon: icon(ChevronRight),
    group: 'Títulos Retráteis',
    description: 'Seção retrátil com cabeçalho H1.',
    run: (editor) => insertToggle(editor, 'heading-1')
  },
  {
    id: 'toggle-h2',
    label: 'Toggle H2',
    aliases: ['toggle-h2'],
    icon: icon(ChevronRight),
    group: 'Títulos Retráteis',
    description: 'Seção retrátil com cabeçalho H2.',
    run: (editor) => insertToggle(editor, 'heading-2')
  },
  {
    id: 'toggle-h3',
    label: 'Toggle H3',
    aliases: ['toggle-h3'],
    icon: icon(ChevronRight),
    group: 'Títulos Retráteis',
    description: 'Seção retrátil com cabeçalho H3.',
    run: (editor) => insertToggle(editor, 'heading-3')
  },
  {
    id: 'task-list',
    label: 'Check List',
    aliases: ['todo', 'task', 'checkbox', 'checklist', 'tarefas'],
    icon: icon(ListTodo),
    group: 'Blocos Básicos',
    description: 'Criar lista de tarefas com checkboxes.',
    run: (editor) => editor.chain().focus().toggleTaskList().run()
  },
  {
    id: 'bullet-list',
    label: 'Lista com Marcadores',
    aliases: ['bullet', 'ul', 'list', 'lista'],
    icon: icon(List),
    group: 'Blocos Básicos',
    description: 'Criar lista não ordenada.',
    run: (editor) => editor.chain().focus().toggleBulletList().run()
  },
  {
    id: 'ordered-list',
    label: 'Lista Numerada',
    aliases: ['ordered', 'ol', 'numbered', 'numerada'],
    icon: icon(ListOrdered),
    group: 'Blocos Básicos',
    description: 'Criar lista numerada.',
    run: (editor) => editor.chain().focus().toggleOrderedList().run()
  },
  {
    id: 'toggle-text',
    label: 'Bloco Retrátil (Toggle)',
    aliases: ['toggle', 'details', 'collapse', 'toggle-text', 'retratil'],
    icon: icon(ChevronRight),
    group: 'Blocos Básicos',
    description: 'Criar seção de texto retrátil.',
    run: (editor) => insertToggle(editor)
  },
  {
    id: 'blockquote',
    label: 'Citação (Quote)',
    aliases: ['quote', 'blockquote', 'citacao'],
    icon: icon(Quote),
    group: 'Blocos Básicos',
    description: 'Inserir bloco de citação.',
    run: (editor) => editor.chain().focus().toggleBlockquote().run()
  },
  {
    id: 'code-block',
    label: 'Bloco de Código',
    aliases: ['code', 'snippet', 'codigo'],
    icon: icon(Code2),
    group: 'Blocos Básicos',
    description: 'Inserir bloco de código com syntax highlight.',
    run: (editor) => editor.chain().focus().toggleCodeBlock().run()
  },
  {
    id: 'divider',
    label: 'Divisor Horizontal',
    aliases: ['divider', 'rule', 'hr', 'linha'],
    icon: icon(Minus),
    group: 'Blocos Básicos',
    description: 'Inserir linha divisória.',
    run: (editor) => editor.chain().focus().setHorizontalRule().run()
  },
  {
    id: 'text',
    label: 'Parágrafo',
    aliases: ['paragraph', 'plain', 'texto'],
    icon: icon(Pilcrow),
    group: 'Blocos Básicos',
    description: 'Converter para texto normal.',
    run: (editor) => editor.chain().focus().setParagraph().run()
  },
  {
    id: 'table',
    label: 'Tabela 3x3',
    aliases: ['table', 'grid', 'columns', 'rows', 'tabela'],
    icon: icon(Table2),
    group: 'Avançado',
    description: 'Inserir tabela Markdown 3x3.',
    run: (editor) =>
      editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
  },
  {
    id: 'mermaid',
    label: 'Diagrama Mermaid',
    aliases: ['mermaid', 'diagram', 'flowchart', 'chart', 'graph', 'diagrama'],
    icon: icon(Workflow),
    group: 'Avançado',
    description: 'Inserir diagrama Mermaid renderizado ao vivo.',
    run: (editor) => insertCodeBlock(editor, 'mermaid', 'graph TD\n  A[Início] --> B[Fim]')
  },
  {
    id: 'inline-math',
    label: 'Fórmula Matemática (Inline)',
    aliases: ['math', 'latex', 'equation', 'formula'],
    icon: icon(Sigma),
    group: 'Avançado',
    description: 'Inserir equação LaTeX inline.',
    run: (editor) => {
      editor.commands.insertInlineMath({ latex: 'E = mc^2' })
    }
  },
  {
    id: 'math-block',
    label: 'Bloco Matemático (KaTeX)',
    aliases: ['display math', 'latex block', 'equation block', 'math-block'],
    icon: icon(Sigma),
    group: 'Avançado',
    description: 'Inserir bloco de equação LaTeX em destaque.',
    run: (editor) => {
      editor.commands.insertBlockMath({ latex: '\\sum_{i=1}^{n} x_i' })
    }
  },
  {
    id: 'image',
    label: 'Imagem',
    aliases: ['image', 'img', 'imagem', 'foto'],
    icon: icon(ImageIcon),
    group: 'Mídia',
    description: 'Inserir uma imagem do seu computador.',
    run: (editor) => editor.chain().focus().run()
  }
]

export function filterRichMarkdownSlashCommands(
  commands: readonly SlashCommand[],
  rawQuery: string
): SlashCommand[] {
  const query = rawQuery.trim().toLowerCase()
  if (!query) return [...commands]
  return commands.filter((command) => {
    const haystack = [command.label, ...command.aliases, command.description]
      .join(' ')
      .toLowerCase()
    return haystack.includes(query)
  })
}

export function runSlashCommand(
  editor: Editor,
  slashMenu: { from: number; to: number },
  command: SlashCommand,
  onImageCommand?: () => void
): void {
  editor.chain().focus().deleteRange({ from: slashMenu.from, to: slashMenu.to }).run()
  if (command.id === 'image' && onImageCommand) {
    onImageCommand()
    return
  }
  command.run(editor)
}

export function syncSlashMenu(
  editor: Editor,
  root: HTMLDivElement | null,
  setSlashMenu: React.Dispatch<React.SetStateAction<SlashMenuState | null>>
): void {
  if (!root || editor.view.composing || !editor.isEditable) {
    setSlashMenu(null)
    return
  }

  const { state, view } = editor
  const { selection } = state
  if (!selection.empty) {
    setSlashMenu(null)
    return
  }

  const { $from } = selection
  if (!$from.parent.isTextblock || $from.parent.type.spec.code) {
    setSlashMenu(null)
    return
  }

  const blockTextBeforeCursor = $from.parent.textBetween(0, $from.parentOffset, '\0', '\0')
  const slashMatch = blockTextBeforeCursor.match(/^\s*\/([a-z0-9-]*)$/i)
  if (!slashMatch) {
    setSlashMenu(null)
    return
  }

  const slashOffset = blockTextBeforeCursor.lastIndexOf('/')
  const start = selection.from - ($from.parentOffset - slashOffset)
  const coords = view.coordsAtPos(selection.from)
  const rect = root.getBoundingClientRect()
  const menuHeight = 340
  const rawTop = coords.bottom - rect.top + 8
  const top =
    rawTop + menuHeight > rect.height - 12
      ? Math.max(48, coords.top - rect.top - menuHeight - 8)
      : rawTop

  setSlashMenu({
    query: slashMatch[1] ?? '',
    from: start,
    to: selection.from,
    left: Math.max(12, Math.min(coords.left - rect.left, rect.width - 310)),
    top
  })
}
