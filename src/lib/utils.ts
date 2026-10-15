import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatAppleNotesDate(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()

  if (isToday) {
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }

  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays < 7) {
    return date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')
  }

  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit'
  })
}

export function formatFullDateTime(timestamp: number): string {
  const date = new Date(timestamp)
  const datePart = date.toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
  const timePart = date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit'
  })
  return `${datePart} às ${timePart}`
}

export function getTemporalGroupLabel(timestamp: number): string {
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const startOfYesterday = startOfToday - 86_400_000
  const startOf7Days = startOfToday - 7 * 86_400_000
  const startOf30Days = startOfToday - 30 * 86_400_000

  if (timestamp >= startOfToday) return 'Hoje'
  if (timestamp >= startOfYesterday) return 'Ontem'
  if (timestamp >= startOf7Days) return '7 Dias Anteriores'
  if (timestamp >= startOf30Days) return '30 Dias Anteriores'

  const d = new Date(timestamp)
  return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

export function countWordsAndChars(markdown: string): { words: number; chars: number } {
  const stripped = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#>*_`~\-[\]()]/g, ' ')
    .trim()
  const words = stripped ? stripped.split(/\s+/).filter(Boolean).length : 0
  return {
    words,
    chars: markdown.length
  }
}
