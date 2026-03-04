const FERIADOS_NACIONAIS = [
  '01-01', '04-21', '05-01', '09-07', '10-12', '11-02', '11-15', '11-20', '12-25'
]

function isFeriadoNacional(date: Date): boolean {
  const mmdd = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  return FERIADOS_NACIONAIS.includes(mmdd)
}

function isDiaUtil(date: Date): boolean {
  const dow = date.getDay()
  return dow !== 0 && dow !== 6 && !isFeriadoNacional(date)
}

export function diasUteisRestantes(dataPrazo: Date | string): number {
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const prazo = new Date(dataPrazo)
  prazo.setHours(0, 0, 0, 0)

  if (prazo < hoje) return -1 // vencido

  let count = 0
  const cursor = new Date(hoje)
  while (cursor <= prazo) {
    if (isDiaUtil(cursor)) count++
    cursor.setDate(cursor.getDate() + 1)
  }
  return count
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('pt-BR')
}
