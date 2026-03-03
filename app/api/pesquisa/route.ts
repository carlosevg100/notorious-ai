import { NextResponse } from 'next/server'
import OpenAI from 'openai'

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q') || ''
  if (!query.trim()) return NextResponse.json({ results: [], source: 'empty' })

  // 1. Try TST real API (jurisprudencia-backend2)
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    const res = await fetch(
      `https://jurisprudencia-backend2.tst.jus.br/rest/pesquisa-textual/1/8?a=${Math.random()}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Referer': 'https://jurisprudencia.tst.jus.br/',
          'Origin': 'https://jurisprudencia.tst.jus.br',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        body: JSON.stringify({
          ou: '',
          e: query,
          termoExato: '',
          naoContem: '',
          ementa: '',
          dispositivo: '',
          numeracaoUnica: null,
        }),
        signal: controller.signal,
      }
    )
    clearTimeout(timeout)
    if (res.ok) {
      const data = await res.json()
      const registros = data?.registros || []
      if (registros.length > 0) {
        const results = registros.slice(0, 8).map((item: any) => {
          const r = item?.registro || item
          const ementa = stripHtml(r.ementaHtml || r.ementa || r.txtEmentaHighlight || '')
          return {
            tribunal: r.orgao?.sigla || 'TST',
            orgao_julgador: r.orgaoJudicante?.descricao || '',
            numero_processo: r.numFormatado || `${r.codFase}-${r.numProc}-${String(r.anoProc).slice(2)}.${r.anoProc}.5.${r.numProcInt}`,
            data: r.dtaJulgamento ? new Date(r.dtaJulgamento).toLocaleDateString('pt-BR') : '',
            data_publicacao: r.dtaPublicacao ? new Date(r.dtaPublicacao).toLocaleDateString('pt-BR') : '',
            relator: r.nomRelator ? r.nomRelator.split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ') : '',
            ementa: ementa,
            link: r.id ? `https://jurisprudencia-backend2.tst.jus.br/rest/documentos/${r.id}` : '',
            source: 'TST',
          }
        }).filter((r: any) => r.ementa.length > 20)
        if (results.length > 0) {
          return NextResponse.json({ results, source: 'TST', total: data.totalRegistros })
        }
      }
    }
  } catch (_) {
    // fallthrough
  }

  // 2. Try STF API with browser headers
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    const stfRes = await fetch(
      `https://jurisprudencia.stf.jus.br/api/search?query=${encodeURIComponent(query)}&pageSize=5`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Referer': 'https://jurisprudencia.stf.jus.br/',
          'Origin': 'https://jurisprudencia.stf.jus.br',
        },
        signal: controller.signal,
      }
    )
    clearTimeout(timeout)
    if (stfRes.ok) {
      const data = await stfRes.json()
      const hits = data?.result?.hits?.hits || data?.hits?.hits || []
      if (hits.length > 0) {
        const results = hits.map((hit: any) => {
          const src = hit._source || hit
          return {
            tribunal: 'STF',
            orgao_julgador: src.orgaoJulgador || src.classe || '',
            numero_processo: src.numeroProcesso || src.numero || hit._id || '',
            data: src.dataJulgamento ? new Date(src.dataJulgamento).toLocaleDateString('pt-BR') : '',
            data_publicacao: src.dataPublicacao ? new Date(src.dataPublicacao).toLocaleDateString('pt-BR') : '',
            relator: src.relator || src.nomeRelator || '',
            ementa: stripHtml(src.ementa || src.texto || ''),
            link: src.url || '',
            source: 'STF',
          }
        }).filter((r: any) => r.ementa.length > 20)
        if (results.length > 0) {
          return NextResponse.json({ results, source: 'STF' })
        }
      }
    }
  } catch (_) {
    // fallthrough
  }

  // 3. No real results — return error (NO fake AI results)
  return NextResponse.json({
    results: [],
    source: 'unavailable',
    error: 'Não foi possível conectar às bases de jurisprudência (TST/STF) no momento. Tente novamente em instantes.',
  })
}
