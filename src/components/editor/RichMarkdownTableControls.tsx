import React, { useEffect, useState } from 'react'
import type { Editor } from '@tiptap/react'
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Columns3,
  Rows3,
  Trash2
} from 'lucide-react'

export function RichMarkdownTableControls({
  editor
}: {
  editor: Editor | null
}): React.JSX.Element | null {
  const [inTable, setInTable] = useState(false)

  useEffect(() => {
    if (!editor) return
    const update = () => {
      setInTable(editor.isActive('table'))
    }
    update()
    editor.on('selectionUpdate', update)
    editor.on('transaction', update)
    return () => {
      editor.off('selectionUpdate', update)
      editor.off('transaction', update)
    }
  }, [editor])

  if (!editor || !inTable) return null

  return (
    <div className="rys-glass-popover sticky top-2 z-20 mx-8 mb-2 flex flex-wrap items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs shadow-lg">
      <span className="mr-1.5 font-semibold text-primary">Tabela:</span>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().addRowBefore().run()}
        className="flex items-center gap-1 rounded px-2 py-1 hover:bg-accent cursor-pointer"
        title="Inserir linha acima"
      >
        <ArrowUp className="size-3" /> +Linha Acima
      </button>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().addRowAfter().run()}
        className="flex items-center gap-1 rounded px-2 py-1 hover:bg-accent cursor-pointer"
        title="Inserir linha abaixo"
      >
        <ArrowDown className="size-3" /> +Linha Abaixo
      </button>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().addColumnBefore().run()}
        className="flex items-center gap-1 rounded px-2 py-1 hover:bg-accent cursor-pointer"
        title="Inserir coluna à esquerda"
      >
        <ArrowLeft className="size-3" /> +Col Esq
      </button>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().addColumnAfter().run()}
        className="flex items-center gap-1 rounded px-2 py-1 hover:bg-accent cursor-pointer"
        title="Inserir coluna à direita"
      >
        <ArrowRight className="size-3" /> +Col Dir
      </button>
      <div className="mx-1 h-4 w-px bg-border" />
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().deleteRow().run()}
        className="flex items-center gap-1 rounded px-2 py-1 text-red-400 hover:bg-red-500/10 cursor-pointer"
        title="Excluir linha atual"
      >
        <Rows3 className="size-3" /> -Linha
      </button>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().deleteColumn().run()}
        className="flex items-center gap-1 rounded px-2 py-1 text-red-400 hover:bg-red-500/10 cursor-pointer"
        title="Excluir coluna atual"
      >
        <Columns3 className="size-3" /> -Coluna
      </button>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().deleteTable().run()}
        className="flex items-center gap-1 rounded px-2 py-1 text-red-400 hover:bg-red-500/10 cursor-pointer"
        title="Excluir tabela inteira"
      >
        <Trash2 className="size-3" /> Excluir Tabela
      </button>
    </div>
  )
}
