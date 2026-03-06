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
  bg0: '#08080A', bg1: '#0F0F12', bg2: '#141418', bg3: '#1A1A20',
  border1: '#1F1F26', border2: '#252530', border3: '#2D2D3A',
  text1: '#F4F4F6', text2: '#A0A0B0', text3: '#606070', text4: '#303040',

  amber: '#F0A500', amberBg: '#F0A50015', amberBorder: '#F0A50030',
  red:   '#EF4444', redBg:   '#EF444415', redBorder:   '#EF444430',
  yellow: '#F59E0B', yellowBg: '#F59E0B15', yellowBorder: '#F59E0B30',
  blue:  '#3B82F6', blueBg:  '#3B82F615', blueBorder:  '#3B82F630',
  green: '#10B981', greenBg: '#10B98115', greenBorder: '#10B98130',

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
