import React, { useState } from 'react'
import type { Editor } from '@tiptap/react'
import {
  ChevronRight,
  Code,
  Code2,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Heading5,
  ImageIcon,
  Link as LinkIcon,
  List,
  ListOrdered,
  ListTodo,
  Minus,
  MoreHorizontal,
  Pilcrow,
  Quote,
  Sigma,
  Table2,
  Workflow
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { insertCodeBlock, insertToggle } from './rich-markdown-slash-commands'

type RichMarkdownToolbarProps = {
  editor: Editor | null
  onToggleLink: () => void
  onImagePick: () => void
}

function ToolbarBtn({
  active = false,
  label,
  onClick,
  children
}: {
  active?: boolean
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        'rich-markdown-toolbar-button cursor-pointer transition-colors',
        active && 'is-active'
      )}
    >
      {children}
    </button>
  )
}

function Separator() {
  return <div className="rich-markdown-toolbar-separator" />
}

export function RichMarkdownToolbar({
  editor,
  onToggleLink,
  onImagePick
}: RichMarkdownToolbarProps): React.JSX.Element {
  const [moreOpen, setMoreOpen] = useState(false)

  return (
    <div className="rich-markdown-editor-toolbar relative flex-wrap">
      <ToolbarBtn
        active={Boolean(editor?.isActive('paragraph'))}
        label="Texto normal"
        onClick={() => editor?.chain().focus().setParagraph().run()}
      >
        <Pilcrow className="size-3.5" />
      </ToolbarBtn>
      <ToolbarBtn
        active={Boolean(editor?.isActive('heading', { level: 1 }))}
        label="Título 1 (H1)"
        onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
      >
        <Heading1 className="size-3.5" />
      </ToolbarBtn>
      <ToolbarBtn
        active={Boolean(editor?.isActive('heading', { level: 2 }))}
        label="Título 2 (H2)"
        onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 className="size-3.5" />
      </ToolbarBtn>
      <ToolbarBtn
        active={Boolean(editor?.isActive('heading', { level: 3 }))}
        label="Título 3 (H3)"
        onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        <Heading3 className="size-3.5" />
      </ToolbarBtn>

      <Separator />

      <ToolbarBtn
        active={Boolean(editor?.isActive('bold'))}
        label="Negrito (Ctrl+B)"
        onClick={() => editor?.chain().focus().toggleBold().run()}
      >
        <span className="font-bold">B</span>
      </ToolbarBtn>
      <ToolbarBtn
        active={Boolean(editor?.isActive('italic'))}
        label="Itálico (Ctrl+I)"
        onClick={() => editor?.chain().focus().toggleItalic().run()}
      >
        <span className="italic font-serif">I</span>
      </ToolbarBtn>
      <ToolbarBtn
        active={Boolean(editor?.isActive('strike'))}
        label="Tachado (Ctrl+Shift+X)"
        onClick={() => editor?.chain().focus().toggleStrike().run()}
      >
        <span className="line-through">S</span>
      </ToolbarBtn>
      <ToolbarBtn
        active={Boolean(editor?.isActive('code'))}
        label="Código Inline (Ctrl+E)"
        onClick={() => editor?.chain().focus().toggleCode().run()}
      >
        <Code className="size-3.5" />
      </ToolbarBtn>

      <Separator />

      <ToolbarBtn
        active={Boolean(editor?.isActive('bulletList'))}
        label="Lista com marcadores"
        onClick={() => editor?.chain().focus().toggleBulletList().run()}
      >
        <List className="size-3.5" />
      </ToolbarBtn>
      <ToolbarBtn
        active={Boolean(editor?.isActive('orderedList'))}
        label="Lista numerada"
        onClick={() => editor?.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="size-3.5" />
      </ToolbarBtn>
      <ToolbarBtn
        active={Boolean(editor?.isActive('taskList'))}
        label="Checklist (- [ ])"
        onClick={() => editor?.chain().focus().toggleTaskList().run()}
      >
        <ListTodo className="size-3.5" />
      </ToolbarBtn>

      <Separator />

      <ToolbarBtn
        active={Boolean(editor?.isActive('blockquote'))}
        label="Citação"
        onClick={() => editor?.chain().focus().toggleBlockquote().run()}
      >
        <Quote className="size-3.5" />
      </ToolbarBtn>
      <ToolbarBtn
        active={Boolean(editor?.isActive('codeBlock'))}
        label="Bloco de Código"
        onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
      >
        <Code2 className="size-3.5" />
      </ToolbarBtn>
      <ToolbarBtn
        active={Boolean(editor?.isActive('table'))}
        label="Inserir Tabela 3x3"
        onClick={() =>
          editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
        }
      >
        <Table2 className="size-3.5" />
      </ToolbarBtn>
      <ToolbarBtn
        active={false}
        label="Seção Retrátil (Toggle)"
        onClick={() => editor && insertToggle(editor)}
      >
        <ChevronRight className="size-3.5" />
      </ToolbarBtn>
      <ToolbarBtn
        active={false}
        label="Diagrama Mermaid"
        onClick={() =>
          editor && insertCodeBlock(editor, 'mermaid', 'graph TD\n  A[Início] --> B[Fim]')
        }
      >
        <Workflow className="size-3.5" />
      </ToolbarBtn>
      <ToolbarBtn
        active={Boolean(editor?.isActive('link'))}
        label="Inserir/Editar Link (Ctrl+K)"
        onClick={onToggleLink}
      >
        <LinkIcon className="size-3.5" />
      </ToolbarBtn>
      <ToolbarBtn active={false} label="Inserir Imagem" onClick={onImagePick}>
        <ImageIcon className="size-3.5" />
      </ToolbarBtn>

      {/* Mais blocos */}
      <div className="relative">
        <ToolbarBtn
          active={moreOpen}
          label="Mais blocos (H4, H5, Matemática, Divisor)"
          onClick={() => setMoreOpen((v) => !v)}
        >
          <MoreHorizontal className="size-3.5" />
        </ToolbarBtn>
        {moreOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setMoreOpen(false)}
            />
            <div className="absolute left-0 top-full mt-1 z-50 w-52 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-xl">
              <div className="px-2 py-1 text-[11px] font-semibold text-muted-foreground">
                Mais Blocos
              </div>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs hover:bg-accent cursor-pointer"
                onClick={() => {
                  editor?.chain().focus().toggleHeading({ level: 4 }).run()
                  setMoreOpen(false)
                }}
              >
                <Heading4 className="size-3.5" /> Título 4 (H4)
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs hover:bg-accent cursor-pointer"
                onClick={() => {
                  editor?.chain().focus().toggleHeading({ level: 5 }).run()
                  setMoreOpen(false)
                }}
              >
                <Heading5 className="size-3.5" /> Título 5 (H5)
              </button>
              <div className="my-1 h-px bg-border" />
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs hover:bg-accent cursor-pointer"
                onClick={() => {
                  editor?.chain().focus().setHorizontalRule().run()
                  setMoreOpen(false)
                }}
              >
                <Minus className="size-3.5" /> Divisor Horizontal
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs hover:bg-accent cursor-pointer"
                onClick={() => {
                  editor?.commands.insertInlineMath({ latex: 'E = mc^2' })
                  setMoreOpen(false)
                }}
              >
                <Sigma className="size-3.5" /> Equação Inline ($...$)
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs hover:bg-accent cursor-pointer"
                onClick={() => {
                  editor?.commands.insertBlockMath({ latex: '\\int_a^b f(x) dx' })
                  setMoreOpen(false)
                }}
              >
                <Sigma className="size-3.5" /> Bloco Matemático ($$...$$)
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
