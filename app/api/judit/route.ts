import { NextRequest, NextResponse } from 'next/server'
import { fetchProcessByCNJ, fetchProcessMovements } from '@/lib/judit'

export async function GET(request: NextRequest) {
  const cnj = request.nextUrl.searchParams.get('cnj')
  const type = request.nextUrl.searchParams.get('type') || 'process'

  if (!cnj) return NextResponse.json({ error: 'cnj param required' }, { status: 400 })

  if (type === 'movements') {
    const movements = await fetchProcessMovements(cnj)
    return NextResponse.json({ movements })
  }

  const process = await fetchProcessByCNJ(cnj)
  if (!process) return NextResponse.json({ error: 'Process not found' }, { status: 404 })
  return NextResponse.json(process)
}
