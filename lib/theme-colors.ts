/**
 * Litigator AI — Design Token System
 * Shared color palette for dark and light modes.
 * Usage: const C = getColors(theme)  — call inside React components.
 */

export interface ThemeColors {
  bg0: string; bg1: string; bg2: string; bg3: string
  border1: string; border2: string; border3: string
  text1: string; text2: string; text3: string; text4: string
  amber: string; amberBg: string; amberBorder: string
  red: string;   redBg: string;   redBorder: string
  yellow: string; yellowBg: string; yellowBorder: string
  blue: string;  blueBg: string;  blueBorder: string
  green: string; greenBg: string; greenBorder: string
  stages: {
    analise: string; contestacao: string
    recurso: string; execucao: string; encerrado: string
  }
}

export const darkColors: ThemeColors = {
  bg0: '#0b1829', bg1: '#112240', bg2: '#1a3358', bg3: '#234470',
  border1: 'rgba(100, 150, 220, 0.22)', border2: 'rgba(100, 150, 220, 0.32)', border3: 'rgba(100, 150, 220, 0.45)',
  text1: '#edf2f9', text2: '#9bb0cc', text3: '#6888aa', text4: '#3a5a7a',

  amber: '#c9a84c', amberBg: 'rgba(201, 168, 76, 0.12)', amberBorder: 'rgba(201, 168, 76, 0.30)',
  red:   '#EF4444', redBg:   'rgba(239, 68, 68, 0.12)', redBorder:   'rgba(239, 68, 68, 0.30)',
  yellow: '#F59E0B', yellowBg: 'rgba(245, 158, 11, 0.12)', yellowBorder: 'rgba(245, 158, 11, 0.30)',
  blue:  '#4da6ff', blueBg:  'rgba(77, 166, 255, 0.12)', blueBorder:  'rgba(77, 166, 255, 0.30)',
  green: '#10B981', greenBg: 'rgba(16, 185, 129, 0.12)', greenBorder: 'rgba(16, 185, 129, 0.30)',

  stages: {
    analise: '#60A5FA', contestacao: '#F59E0B',
    recurso: '#F87171', execucao: '#34D399', encerrado: '#4B5563',
  },
}

export const lightColors: ThemeColors = {
  // Backgrounds — crisp white → warm grays
  bg0: '#FAFAFA', bg1: '#F5F5F7', bg2: '#EBEBEF', bg3: '#E0E0E5',

  // Borders — subtle, layered
  border1: '#E0E0E5', border2: '#D0D0D8', border3: '#C0C0CA',

  // Typography — near-black to soft muted
  text1: '#0A0A0C', text2: '#4A4A5A', text3: '#8A8A9A', text4: '#B0B0C0',

  // Amber — slightly darker for light bg contrast
  amber: '#C4840A',
  amberBg: 'rgba(196, 132, 10, 0.08)',
  amberBorder: 'rgba(196, 132, 10, 0.22)',

  // Semantics — same hue, adjusted for light backgrounds
  red:   '#DC2626', redBg:   'rgba(220, 38, 38, 0.08)',   redBorder:   'rgba(220, 38, 38, 0.22)',
  yellow: '#D97706', yellowBg: 'rgba(217, 119, 6, 0.08)', yellowBorder: 'rgba(217, 119, 6, 0.22)',
  blue:  '#2563EB', blueBg:  'rgba(37, 99, 235, 0.08)',  blueBorder:  'rgba(37, 99, 235, 0.22)',
  green: '#16A34A', greenBg: 'rgba(22, 163, 74, 0.08)',  greenBorder: 'rgba(22, 163, 74, 0.22)',

  // Stage colors — vivid enough on white backgrounds
  stages: {
    analise:     '#3B82F6',
    contestacao: '#D97706',
    recurso:     '#EF4444',
    execucao:    '#16A34A',
    encerrado:   '#6B7280',
  },
}

export function getColors(theme: string): ThemeColors {
  return theme === 'light' ? lightColors : darkColors
}
