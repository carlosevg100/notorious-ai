const FERIADOS_NACIONAIS = [
  '01-01', '04-21', '05-01', '09-07', '10-12', '11-02', '11-15', '11-20', '12-25'
]

function isFeriadoNacional(date: Date): boolean {
  const mmdd = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  return FERIADOS_NACIONAIS.includes(mmdd)
}

export function isDiaUtil(date: Date): boolean {
  const dow = date.getDay()
  return dow !== 0 && dow !== 6 && !isFeriadoNacional(date)
}

export function diasUteisRestantes(dataPrazo: Date | string): number {
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const prazo = new Date(dataPrazo)
  prazo.setHours(0, 0, 0, 0)

  if (prazo < hoje) return -1

  let count = 0
  const cursor = new Date(hoje)
  while (cursor <= prazo) {
    if (isDiaUtil(cursor)) count++
    cursor.setDate(cursor.getDate() + 1)
  }
  return count
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ')
}

export function prazoBadgeColor(diasUteis: number): string {
  if (diasUteis < 0) return 'bg-red-900/50 text-red-300 border-red-700'
  if (diasUteis <= 3) return 'bg-red-900/30 text-red-400 border-red-800'
  if (diasUteis <= 7) return 'bg-amber-900/30 text-amber-400 border-amber-800'
  return 'bg-emerald-900/30 text-emerald-400 border-emerald-800'
}

export function statusColor(status: string): string {
  switch (status) {
    case 'pending': return 'text-zinc-400'
    case 'processing': return 'text-blue-400'
    case 'completed': return 'text-emerald-400'
    case 'error': return 'text-red-400'
    default: return 'text-zinc-400'
  }
}

export function statusLabel(status: string): string {
  switch (status) {
    case 'pending': return 'Pendente'
    case 'processing': return 'Processando...'
    case 'completed': return 'Concluído'
    case 'error': return 'Erro'
    default: return status
  }
}

export const FIRM_ID = '1f430c10-550a-4267-9193-e03c831fc394'
