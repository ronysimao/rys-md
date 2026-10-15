import type mermaid from 'mermaid'

export type MermaidThemeColors = {
  background: string
  foreground: string
  primary: string
  secondary: string
  tertiary: string
  border: string
}

export function getMermaidConfig(
  isDark: boolean,
  htmlLabels = false,
  colors?: MermaidThemeColors
): Parameters<typeof mermaid.initialize>[0] {
  return {
    startOnLoad: false,
    securityLevel: 'strict',
    suppressErrorRendering: true,
    theme: isDark ? (colors ? 'base' : 'dark') : 'default',
    darkMode: isDark,
    ...(isDark && colors
      ? {
          themeVariables: {
            darkMode: true,
            background: colors.background,
            primaryColor: colors.primary,
            secondaryColor: colors.secondary,
            tertiaryColor: colors.tertiary,
            primaryTextColor: colors.foreground,
            secondaryTextColor: colors.foreground,
            tertiaryTextColor: colors.foreground,
            primaryBorderColor: colors.border,
            secondaryBorderColor: colors.border,
            tertiaryBorderColor: colors.border,
            lineColor: colors.foreground,
            textColor: colors.foreground,
            edgeLabelBackground: colors.background
          }
        }
      : {}),
    htmlLabels
  }
}

export function readMermaidThemeColors(isDark: boolean): MermaidThemeColors {
  return isDark
    ? {
        background: '#1e1e20',
        foreground: '#f4f4f5',
        primary: '#eab308',
        secondary: '#27272a',
        tertiary: '#3f3f46',
        border: '#eab308'
      }
    : {
        background: '#ffffff',
        foreground: '#18181b',
        primary: '#fef08a',
        secondary: '#f4f4f5',
        tertiary: '#e4e4e7',
        border: '#ca8a04'
      }
}
