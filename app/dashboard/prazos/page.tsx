'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { diasUteisRestantes, formatDate, prazoBadgeColor } from '@/lib/utils'
import type { Prazo } from '@/lib/types'
import Link from 'next/link'
import { CalendarClock } from 'lucide-react'

export default function PrazosPage() {
  const { firmId } = useAuth()
  const [prazos, setPrazos] = useState<(Prazo & { project_name?: string })[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('prazos')
      .select('*, projects(name)')
      .eq('firm_id', firmId)
      .order('data_prazo', { ascending: true })
      .then(({ data }) => {
        setPrazos((data || []).map((p: Record<string, unknown>) => ({
          ...p as unknown as Prazo,
          project_name: p.projects ? (p.projects as { name: string }).name : undefined,
          dias_uteis_restantes: diasUteisRestantes((p as unknown as Prazo).data_prazo),
        })))
        setLoading(false)
      })
  }, [firmId])

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="spinner" /></div>
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Prazos</h1>

      {prazos.length === 0 ? (
        <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
          <CalendarClock size={48} className="mx-auto mb-3 opacity-40" />
          <p>Nenhum prazo cadastrado.</p>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
                <th className="text-left py-3 px-4">Descrição</th>
                <th className="text-left py-3 px-4">Processo</th>
                <th className="text-left py-3 px-4">Data</th>
                <th className="text-left py-3 px-4">Tipo</th>
                <th className="text-left py-3 px-4">Dias Úteis</th>
                <th className="text-left py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {prazos.map(p => (
                <tr key={p.id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  <td className="py-3 px-4">{p.descricao}</td>
                  <td className="py-3 px-4">
                    <Link href={`/dashboard/projects/${p.project_id}`} className="hover:underline" style={{ color: 'var(--accent)' }}>
                      {p.project_name || '—'}
                    </Link>
                  </td>
                  <td className="py-3 px-4">{formatDate(p.data_prazo)}</td>
                  <td className="py-3 px-4 capitalize">{p.tipo}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium border ${prazoBadgeColor(p.dias_uteis_restantes ?? 0)}`}>
                      {(p.dias_uteis_restantes ?? 0) < 0 ? 'VENCIDO' : `${p.dias_uteis_restantes} d.u.`}
                    </span>
                  </td>
                  <td className="py-3 px-4 capitalize">{p.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
