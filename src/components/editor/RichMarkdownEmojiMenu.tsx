import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Search, Smile, Sparkles, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { vaultClient } from '@/lib/vault-client'

export type EmojiMenuPosition = {
  left: number
  top: number
}

type RichMarkdownEmojiMenuProps = {
  emojiMenu: EmojiMenuPosition
  isDark: boolean
  onSelect: (emoji: string) => void
  onClose: () => void
}

interface EmojiItem {
  emoji: string
  name: string
  keywords: string[]
  category: EmojiCategory
}

type EmojiCategory =
  | 'Rostos & Emoções'
  | 'Gestos & Pessoas'
  | 'Símbolos & Check'
  | 'Objetos & Tech'
  | 'Natureza & Clima'
  | 'Comida & Café'

const EMOJI_CATEGORIES: EmojiCategory[] = [
  'Rostos & Emoções',
  'Gestos & Pessoas',
  'Símbolos & Check',
  'Objetos & Tech',
  'Natureza & Clima',
  'Comida & Café'
]

const NATIVE_EMOJI_CATALOG: EmojiItem[] = [
  // Rostos & Emoções
  { emoji: '😀', name: ' Rosto Sorridente', keywords: ['smile', 'sorriso', 'feliz', 'happy', 'grin'], category: 'Rostos & Emoções' },
  { emoji: '😄', name: 'Sorriso Aberto', keywords: ['smile', 'happy', 'alegre', 'feliz'], category: 'Rostos & Emoções' },
  { emoji: '😁', name: 'Radiante', keywords: ['beam', 'grin', 'sorriso'], category: 'Rostos & Emoções' },
  { emoji: '😂', name: 'Chorando de Rir', keywords: ['joy', 'lol', 'rir', 'engraçado'], category: 'Rostos & Emoções' },
  { emoji: '🤣', name: 'Rolando de Rir', keywords: ['rofl', 'rir', 'haha'], category: 'Rostos & Emoções' },
  { emoji: '😊', name: 'Sorriso Meigo', keywords: ['blush', 'feliz', 'timido'], category: 'Rostos & Emoções' },
  { emoji: '😇', name: 'Anjinho', keywords: ['angel', 'anjo', 'inocente'], category: 'Rostos & Emoções' },
  { emoji: '🙂', name: 'Sorriso Leve', keywords: ['slight smile', 'ok', 'bom'], category: 'Rostos & Emoções' },
  { emoji: '😉', name: 'Piscadinha', keywords: ['wink', 'piscar'], category: 'Rostos & Emoções' },
  { emoji: '😍', name: 'Apaixonado', keywords: ['love', 'amor', 'coracao', 'heart eyes'], category: 'Rostos & Emoções' },
  { emoji: '🥰', name: 'Carinhoso', keywords: ['love', 'carinho', 'hearts'], category: 'Rostos & Emoções' },
  { emoji: '🤩', name: 'Fascinado', keywords: ['star', 'estrela', 'uau', 'wow'], category: 'Rostos & Emoções' },
  { emoji: '😎', name: 'De Óculos Escuros', keywords: ['cool', 'legal', 'estilo', 'sunglasses'], category: 'Rostos & Emoções' },
  { emoji: '🤓', name: 'Nerd / Estudioso', keywords: ['nerd', 'geek', 'oculos'], category: 'Rostos & Emoções' },
  { emoji: '🤔', name: 'Pensativo', keywords: ['think', 'pensando', 'duvida', 'hmm'], category: 'Rostos & Emoções' },
  { emoji: '🫡', name: 'Continência / Respeito', keywords: ['salute', 'sim senhor', 'ok'], category: 'Rostos & Emoções' },
  { emoji: '🥳', name: 'Festejando', keywords: ['party', 'festa', 'celebrar', 'parabens'], category: 'Rostos & Emoções' },
  { emoji: '🤯', name: 'Mente Explodindo', keywords: ['mind blown', 'choque', 'incrivel'], category: 'Rostos & Emoções' },
  { emoji: '😅', name: 'Suando Frio', keywords: ['sweat', 'ufa', 'alivio'], category: 'Rostos & Emoções' },
  { emoji: '😮', name: 'Surpreso', keywords: ['wow', 'surpresa', 'oh'], category: 'Rostos & Emoções' },
  { emoji: '😴', name: 'Dormindo', keywords: ['sleep', 'sono', 'zzz'], category: 'Rostos & Emoções' },
  { emoji: '😢', name: 'Triste', keywords: ['sad', 'choro', 'cry', 'triste'], category: 'Rostos & Emoções' },
  { emoji: '😭', name: 'Chorando Muito', keywords: ['sob', 'cry', 'chorar'], category: 'Rostos & Emoções' },
  { emoji: '😡', name: 'Bravo', keywords: ['angry', 'raiva', 'mad'], category: 'Rostos & Emoções' },

  // Gestos & Pessoas
  { emoji: '👍', name: 'Joinha / Positivo', keywords: ['thumbs up', 'ok', 'like', 'bom', 'sim'], category: 'Gestos & Pessoas' },
  { emoji: '👎', name: 'Negativo', keywords: ['thumbs down', 'dislike', 'nao'], category: 'Gestos & Pessoas' },
  { emoji: '👏', name: 'Aplausos', keywords: ['clap', 'palmas', 'parabens', 'bravo'], category: 'Gestos & Pessoas' },
  { emoji: '🙌', name: 'Mãos para o Alto', keywords: ['hooray', 'viva', 'sucesso'], category: 'Gestos & Pessoas' },
  { emoji: '🤝', name: 'Aperto de Mãos', keywords: ['handshake', 'acordo', 'parceria', 'deal'], category: 'Gestos & Pessoas' },
  { emoji: '🙏', name: 'Obrigado / Por Favor', keywords: ['pray', 'thanks', 'obrigado', 'gratidao'], category: 'Gestos & Pessoas' },
  { emoji: '💪', name: 'Força', keywords: ['muscle', 'forca', 'strong', 'foco'], category: 'Gestos & Pessoas' },
  { emoji: '👋', name: 'Acenando / Olá', keywords: ['wave', 'oi', 'ola', 'hello', 'tchau'], category: 'Gestos & Pessoas' },
  { emoji: '👌', name: 'Perfeito', keywords: ['ok', 'perfeito', 'perfect'], category: 'Gestos & Pessoas' },
  { emoji: '✌️', name: 'Paz e Amor', keywords: ['peace', 'paz', 'vitoria'], category: 'Gestos & Pessoas' },
  { emoji: '🤞', name: 'Dedos Cruzados', keywords: ['luck', 'sorte', 'esperanca'], category: 'Gestos & Pessoas' },
  { emoji: '👀', name: 'Olhos / Atenção', keywords: ['eyes', 'olhos', 'ver', 'look'], category: 'Gestos & Pessoas' },
  { emoji: '🧠', name: 'Cérebro / Inteligência', keywords: ['brain', 'cerebro', 'ideia', 'mente'], category: 'Gestos & Pessoas' },
  { emoji: '🎯', name: 'Alvo / Meta', keywords: ['target', 'alvo', 'foco', 'meta', 'goal'], category: 'Gestos & Pessoas' },
  { emoji: '🏆', name: 'Troféu / Campeão', keywords: ['trophy', 'trofeu', 'vencedor', 'win'], category: 'Gestos & Pessoas' },
  { emoji: '🚀', name: 'Foguete / Lançamento', keywords: ['rocket', 'foguete', 'launch', 'rapido'], category: 'Gestos & Pessoas' },

  // Símbolos & Check
  { emoji: '✨', name: 'Brilhos / Magia', keywords: ['sparkles', 'brilho', 'novo', 'magic'], category: 'Símbolos & Check' },
  { emoji: '🔥', name: 'Fogo / Em Alta', keywords: ['fire', 'fogo', 'hot', 'quente', 'top'], category: 'Símbolos & Check' },
  { emoji: '⚡', name: 'Raio / Rápido', keywords: ['zap', 'raio', 'energia', 'fast'], category: 'Símbolos & Check' },
  { emoji: '✅', name: 'Concluído / Check Verde', keywords: ['check', 'done', 'ok', 'sucesso', 'feito'], category: 'Símbolos & Check' },
  { emoji: '☑️', name: 'Caixa Marcada', keywords: ['checkbox', 'check', 'marcado'], category: 'Símbolos & Check' },
  { emoji: '❌', name: 'Erro / Cancelar', keywords: ['cross', 'error', 'erro', 'nao', 'x'], category: 'Símbolos & Check' },
  { emoji: '⚠️', name: 'Aviso / Atenção', keywords: ['warning', 'aviso', 'alerta', 'cuidado'], category: 'Símbolos & Check' },
  { emoji: '❗', name: 'Importante', keywords: ['exclamation', 'importante', 'alerta'], category: 'Símbolos & Check' },
  { emoji: '❓', name: 'Dúvida / Pergunta', keywords: ['question', 'duvida', 'pergunta'], category: 'Símbolos & Check' },
  { emoji: '💡', name: 'Ideia / Dica', keywords: ['bulb', 'ideia', 'lampada', 'tip', 'dica'], category: 'Símbolos & Check' },
  { emoji: '📌', name: 'Alfinete / Fixar', keywords: ['pin', 'fixar', 'alfinete', 'importante'], category: 'Símbolos & Check' },
  { emoji: '❤️', name: 'Coração Vermelho', keywords: ['heart', 'coracao', 'amor', 'love'], category: 'Símbolos & Check' },
  { emoji: '💙', name: 'Coração Azul', keywords: ['blue heart', 'azul', 'coracao'], category: 'Símbolos & Check' },
  { emoji: '💛', name: 'Coração Amarelo', keywords: ['yellow heart', 'amarelo', 'coracao'], category: 'Símbolos & Check' },
  { emoji: '⭐', name: 'Estrela', keywords: ['star', 'estrela', 'favorito'], category: 'Símbolos & Check' },
  { emoji: '🌟', name: 'Estrela Brilhante', keywords: ['glowing star', 'estrela', 'destaque'], category: 'Símbolos & Check' },
  { emoji: '💯', name: 'Cem Por Cento', keywords: ['100', 'perfeito', 'total'], category: 'Símbolos & Check' },
  { emoji: '🎉', name: 'Confete / Comemoração', keywords: ['tada', 'festa', 'celebracao', 'parabens'], category: 'Símbolos & Check' },
  { emoji: '🚩', name: 'Bandeira / Marco', keywords: ['flag', 'bandeira', 'marco'], category: 'Símbolos & Check' },
  { emoji: '🔗', name: 'Link / Conexão', keywords: ['link', 'url', 'conexao'], category: 'Símbolos & Check' },

  // Objetos & Tech
  { emoji: '💻', name: 'Notebook / Código', keywords: ['laptop', 'pc', 'computador', 'code', 'dev'], category: 'Objetos & Tech' },
  { emoji: '🖥️', name: 'Monitor Desktop', keywords: ['desktop', 'monitor', 'tela'], category: 'Objetos & Tech' },
  { emoji: '⌨️', name: 'Teclado', keywords: ['keyboard', 'teclado', 'digitar'], category: 'Objetos & Tech' },
  { emoji: '📱', name: 'Smartphone / Mobile', keywords: ['phone', 'celular', 'mobile', 'app'], category: 'Objetos & Tech' },
  { emoji: '📝', name: 'Nota / Rascunho', keywords: ['memo', 'note', 'nota', 'escrever'], category: 'Objetos & Tech' },
  { emoji: '📄', name: 'Documento / Página', keywords: ['page', 'doc', 'documento', 'arquivo'], category: 'Objetos & Tech' },
  { emoji: '📁', name: 'Pasta de Arquivos', keywords: ['folder', 'pasta', 'diretorio'], category: 'Objetos & Tech' },
  { emoji: '📂', name: 'Pasta Aberta', keywords: ['open folder', 'pasta'], category: 'Objetos & Tech' },
  { emoji: '📚', name: 'Livros / Documentação', keywords: ['books', 'livros', 'docs', 'estudo'], category: 'Objetos & Tech' },
  { emoji: '📖', name: 'Livro Aberto', keywords: ['book', 'livro', 'leitura'], category: 'Objetos & Tech' },
  { emoji: '📊', name: 'Gráfico de Barras', keywords: ['chart', 'grafico', 'dados', 'stats'], category: 'Objetos & Tech' },
  { emoji: '📈', name: 'Gráfico Crescente', keywords: ['growth', 'crescimento', 'subindo'], category: 'Objetos & Tech' },
  { emoji: '📅', name: 'Calendário / Data', keywords: ['calendar', 'calendario', 'data', 'agenda'], category: 'Objetos & Tech' },
  { emoji: '⏰', name: 'Relógio / Prazo', keywords: ['alarm', 'clock', 'relogio', 'tempo', 'hora'], category: 'Objetos & Tech' },
  { emoji: '🔒', name: 'Cadeado Fechado', keywords: ['lock', 'seguranca', 'privado', 'senha'], category: 'Objetos & Tech' },
  { emoji: '🔑', name: 'Chave / Acesso', keywords: ['key', 'chave', 'token'], category: 'Objetos & Tech' },
  { emoji: '🛠️', name: 'Ferramentas / Config', keywords: ['tools', 'ferramentas', 'build', 'config'], category: 'Objetos & Tech' },
  { emoji: '⚙️', name: 'Engrenagem / Sistema', keywords: ['gear', 'settings', 'configuracao'], category: 'Objetos & Tech' },
  { emoji: '🧪', name: 'Tubo de Ensaio / Teste', keywords: ['test', 'teste', 'lab', 'experimento'], category: 'Objetos & Tech' },
  { emoji: '🐞', name: 'Bug / Inseto', keywords: ['bug', 'erro', 'debug'], category: 'Objetos & Tech' },

  // Natureza & Clima
  { emoji: '🌞', name: 'Sol', keywords: ['sun', 'sol', 'dia', 'claro'], category: 'Natureza & Clima' },
  { emoji: '🌙', name: 'Lua', keywords: ['moon', 'lua', 'noite', 'escuro'], category: 'Natureza & Clima' },
  { emoji: '🌈', name: 'Arco-íris', keywords: ['rainbow', 'arco-iris', 'cores'], category: 'Natureza & Clima' },
  { emoji: '🌊', name: 'Onda / Fluidez', keywords: ['wave', 'onda', 'mar', 'agua'], category: 'Natureza & Clima' },
  { emoji: '🌱', name: 'Broto / Crescimento', keywords: ['seedling', 'planta', 'inicio', 'novo'], category: 'Natureza & Clima' },
  { emoji: '🌲', name: 'Árvore', keywords: ['tree', 'arvore', 'natureza'], category: 'Natureza & Clima' },
  { emoji: '🍀', name: 'Trevo de 4 Folhas', keywords: ['clover', 'sorte', 'trevo'], category: 'Natureza & Clima' },
  { emoji: '🦀', name: 'Caranguejo (Rust)', keywords: ['crab', 'rust', 'ferris'], category: 'Natureza & Clima' },
  { emoji: '🐧', name: 'Pinguim (Linux)', keywords: ['penguin', 'linux', 'tux', 'ubuntu'], category: 'Natureza & Clima' },
  { emoji: '🦊', name: 'Raposa', keywords: ['fox', 'raposa'], category: 'Natureza & Clima' },
  { emoji: '🐱', name: 'Gato', keywords: ['cat', 'gato'], category: 'Natureza & Clima' },
  { emoji: '🐶', name: 'Cachorro', keywords: ['dog', 'cachorro'], category: 'Natureza & Clima' },

  // Comida & Café
  { emoji: '☕', name: 'Café', keywords: ['coffee', 'cafe', 'energia', 'dev'], category: 'Comida & Café' },
  { emoji: '🍵', name: 'Chá Verde', keywords: ['tea', 'cha'], category: 'Comida & Café' },
  { emoji: '🍕', name: 'Pizza', keywords: ['pizza', 'comida'], category: 'Comida & Café' },
  { emoji: '🍔', name: 'Hambúrguer', keywords: ['burger', 'lanche'], category: 'Comida & Café' },
  { emoji: '🍎', name: 'Maçã Vermelha', keywords: ['apple', 'maca', 'fruta'], category: 'Comida & Café' },
  { emoji: '🍰', name: 'Bolo / Aniversário', keywords: ['cake', 'bolo', 'doce'], category: 'Comida & Café' },
  { emoji: '🍺', name: 'Cerveja / Brinde', keywords: ['beer', 'cerveja', 'happy hour'], category: 'Comida & Café' },
  { emoji: '🥂', name: 'Taças Brindando', keywords: ['cheers', 'brinde', 'celebrar'], category: 'Comida & Café' }
]

function detectOperatingSystem(): {
  name: 'Linux' | 'macOS' | 'Windows'
  emojiFontFamily: string
  shortcutHint: string
} {
  if (typeof navigator === 'undefined') {
    return {
      name: 'Linux',
      emojiFontFamily: '"Noto Color Emoji", sans-serif',
      shortcutHint: 'Ctrl + .'
    }
  }
  const ua = `${navigator.userAgent} ${navigator.platform || ''}`.toLowerCase()
  if (ua.includes('mac') || ua.includes('darwin')) {
    return {
      name: 'macOS',
      emojiFontFamily: '"Apple Color Emoji", sans-serif',
      shortcutHint: 'Cmd + Ctrl + Espaço'
    }
  }
  if (ua.includes('win')) {
    return {
      name: 'Windows',
      emojiFontFamily: '"Segoe UI Emoji", sans-serif',
      shortcutHint: 'Win + .'
    }
  }
  return {
    name: 'Linux',
    emojiFontFamily: '"Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", sans-serif',
    shortcutHint: 'Ctrl + .'
  }
}

export function RichMarkdownEmojiMenu({
  emojiMenu,
  isDark,
  onSelect,
  onClose
}: RichMarkdownEmojiMenuProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<EmojiCategory | 'Todos'>('Todos')
  const [selectedIndex, setSelectedIndex] = useState(0)

  const osInfo = useMemo(() => detectOperatingSystem(), [])

  const filteredEmojis = useMemo(() => {
    const q = query.trim().toLowerCase()
    return NATIVE_EMOJI_CATALOG.filter((item) => {
      if (activeCategory !== 'Todos' && item.category !== activeCategory) {
        return false
      }
      if (!q) return true
      const haystack = [item.name, item.category, ...item.keywords].join(' ').toLowerCase()
      return haystack.includes(q) || item.emoji.includes(q)
    })
  }, [query, activeCategory])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query, activeCategory])

  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      searchInputRef.current?.focus()
    })
    return () => window.cancelAnimationFrame(id)
  }, [])

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target
      if (target instanceof Node && containerRef.current?.contains(target)) {
        return
      }
      onClose()
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        onClose()
        return
      }
      if (filteredEmojis.length === 0) return

      const cols = 8
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        setSelectedIndex((i) => (i + 1) % filteredEmojis.length)
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        setSelectedIndex((i) => (i - 1 + filteredEmojis.length) % filteredEmojis.length)
      } else if (event.key === 'ArrowDown') {
        event.preventDefault()
        setSelectedIndex((i) => Math.min(filteredEmojis.length - 1, i + cols))
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        setSelectedIndex((i) => Math.max(0, i - cols))
      } else if (event.key === 'Enter') {
        event.preventDefault()
        const chosen = filteredEmojis[selectedIndex] ?? filteredEmojis[0]
        if (chosen) {
          onSelect(chosen.emoji)
        }
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown, true)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [filteredEmojis, selectedIndex, onClose, onSelect])

  const selectedItem = filteredEmojis[selectedIndex] ?? filteredEmojis[0] ?? null

  return (
    <div
      ref={containerRef}
      style={{ left: emojiMenu.left, top: emojiMenu.top }}
      className={cn(
        'rich-markdown-emoji-menu rys-glass-popover',
        isDark ? 'dark' : 'light'
      )}
      role="dialog"
      aria-label={`Seletor de Emojis (${osInfo.name})`}
    >
      {/* Cabeçalho com indicação do SO e busca */}
      <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <Smile className="size-3.5 text-primary" />
          <span>Emojis ({osInfo.name})</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              void vaultClient.openOsEmojiPicker()
            }}
            title={`Abrir seletor nativo do ${osInfo.name} (${osInfo.shortcutHint})`}
            className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-accent/50 px-2 py-0.5 text-[10.5px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
          >
            <Sparkles className="size-2.5 text-primary" />
            <span>SO ({osInfo.shortcutHint})</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            title="Fechar (Esc)"
            className="rounded-md p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Campo de busca */}
      <div className="flex items-center gap-2 border-b border-border/50 px-3 py-1.5">
        <Search className="size-3.5 text-muted-foreground shrink-0" />
        <input
          ref={searchInputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar emoji (ex: foguete, check, café)..."
          className="w-full bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
        />
      </div>

      {/* Abas de Categorias */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-border/50 px-2.5 py-1.5 scrollbar-sleek">
        <button
          type="button"
          onClick={() => setActiveCategory('Todos')}
          className={cn(
            'shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors cursor-pointer',
            activeCategory === 'Todos'
              ? 'bg-primary text-primary-foreground font-semibold'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground'
          )}
        >
          Todos
        </button>
        {EMOJI_CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setActiveCategory(cat)}
            className={cn(
              'shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors cursor-pointer',
              activeCategory === cat
                ? 'bg-primary text-primary-foreground font-semibold'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            )}
          >
            {cat.split(' ')[0]}
          </button>
        ))}
      </div>

      {/* Grade de Emojis com fonte nativa do Sistema Operacional */}
      <div className="max-h-[210px] overflow-y-auto p-2 scrollbar-sleek">
        {filteredEmojis.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            Nenhum emoji encontrado para &ldquo;{query}&rdquo;
          </div>
        ) : (
          <div className="grid grid-cols-8 gap-1">
            {filteredEmojis.map((item, idx) => (
              <button
                key={`${item.emoji}-${item.name}`}
                type="button"
                title={item.name.trim()}
                onMouseEnter={() => setSelectedIndex(idx)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onSelect(item.emoji)}
                style={{ fontFamily: osInfo.emojiFontFamily }}
                className={cn(
                  'flex size-8 items-center justify-center rounded-lg text-[20px] leading-none transition-transform cursor-pointer select-none',
                  idx === selectedIndex
                    ? 'bg-primary/20 ring-1 ring-primary scale-110'
                    : 'hover:bg-accent'
                )}
              >
                {item.emoji}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Rodapé de status do emoji selecionado */}
      <div className="flex items-center justify-between border-t border-border/50 px-3 py-1.5 text-[11px] text-muted-foreground">
        {selectedItem ? (
          <span className="flex items-center gap-1.5 truncate">
            <span
              style={{ fontFamily: osInfo.emojiFontFamily }}
              className="text-sm leading-none"
            >
              {selectedItem.emoji}
            </span>
            <span className="truncate font-medium text-foreground/90">
              {selectedItem.name.trim()}
            </span>
          </span>
        ) : (
          <span>Selecione um emoji</span>
        )}
        <span className="shrink-0 text-[10px] opacity-75">Enter p/ inserir</span>
      </div>
    </div>
  )
}
