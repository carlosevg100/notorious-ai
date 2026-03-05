'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import type { Peca } from '@/lib/types'
import { formatDate } from '@/lib/utils'
import { FileText, X } from 'lucide-react'

export default function PecasPage() {
  const { firmId } = useAuth()
  const [pecas, setPecas] = useState<(Peca & { project_name?: string })[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Peca | null>(null)

  useEffect(() => {
    supabase
      .from('pecas')
      .select('*, projects(name)')
      .eq('firm_id', firmId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setPecas((data || []).map((p: Record<string, unknown>) => ({
          ...p as unknown as Peca,
          project_name: p.projects ? (p.projects as { name: string }).name : undefined,
        })))
        setLoading(false)
      })
  }, [firmId])

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="spinner" /></div>
  }

  const tipoLabel: Record<string, string> = {
    contestacao: 'Contestação', recurso: 'Recurso', peticao: 'Petição', parecer: 'Parecer',
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Peças Geradas</h1>

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-3xl max-h-[80vh] flex flex-col rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
            <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid var(--border-color)' }}>
              <h2 className="text-lg font-semibold">{tipoLabel[selected.tipo] || selected.tipo} — v{selected.versao}</h2>
              <button onClick={() => setSelected(null)}><X size={20} style={{ color: 'var(--text-muted)' }} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 whitespace-pre-wrap text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>
              {selected.conteudo}
            </div>
          </div>
        </div>
      )}

      {pecas.length === 0 ? (
        <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
          <FileText size={48} className="mx-auto mb-3 opacity-40" />
          <p>Nenhuma peça gerada ainda.</p>
          <p className="text-sm mt-1">Acesse um processo e use a aba Peças para gerar.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pecas.map(peca => (
            <button
              key={peca.id}
              onClick={() => setSelected(peca)}
              className="w-full text-left p-4 rounded-xl transition-all hover:scale-[1.005]"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{tipoLabel[peca.tipo] || peca.tipo}</h3>
                  <div className="flex gap-3 mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    <span>{peca.project_name || '—'}</span>
                    <span>v{peca.versao}</span>
                    <span>{formatDate(peca.created_at)}</span>
                  </div>
                </div>
                <span className="text-xs px-2 py-1 rounded" style={{ background: 'var(--bg-secondary)', color: 'var(--color-gold)' }}>
                  {peca.modelo_ia}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
