import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q') || '';
  if (!q) return NextResponse.json({ results: [] });
  try {
    const url = `https://scon.stj.jus.br/SCON/pesquisa.jsp?livre=${encodeURIComponent(q)}&tipo_visualizacao=RESUMO&b=ACOR&thesaurus=JURIDICO&p=true`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'text/html,application/xhtml+xml' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return NextResponse.json({ results: [] });
    const html = await res.text();
    const results: any[] = [];
    const blocks = html.split('<div class="documento"');
    for (let i = 1; i < Math.min(blocks.length, 9); i++) {
      const block = blocks[i];
      const proc = block.match(/Processo[:\s]+([A-Z]+\s[\d\.\/-]+)/i)?.[1]?.trim() || '';
      const relator = block.match(/Relator[:\s]+([^<\n]+)/i)?.[1]?.replace(/<[^>]+>/g,'').trim() || '';
      const data = block.match(/Data[^:]*:[:\s]+([\d\/]+)/i)?.[1]?.trim() || '';
      const ementa = block.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').substring(0, 500).trim();
      if (proc || ementa.length > 30) {
        results.push({ tribunal: 'STJ', numero_processo: proc, data, relator, ementa, source: 'STJ' });
      }
    }
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [] });
  }
}
