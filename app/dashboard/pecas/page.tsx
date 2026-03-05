'use client'

import { useEffect, useState, useMemo } from 'react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import type { Peca } from '@/lib/types'
import { formatDate } from '@/lib/utils'
import { FileText, X, Search } from 'lucide-react'
import Link from 'next/link'

const TIPO_LABELS: Record<string, string> = {
  contestacao: 'Contestação', recurso: 'Recurso', peticao: 'Petição', parecer: 'Parecer',
}

interface PecaWithMeta extends Peca {
  project_name?: string
}

export default function PecasPage() {
  const { firmId } = useAuth()
  const [pecas, setPecas] = useState<PecaWithMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<PecaWithMeta | null>(null)
  const [search, setSearch] = useState('')
  const [tipoFilter, setTipoFilter] = useState('all')

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

  const filteredPecas = useMemo(() => {
    return pecas.filter(p => {
      if (tipoFilter !== 'all' && p.tipo !== tipoFilter) return false
      if (search) {
        const s = search.toLowerCase()
        const label = (TIPO_LABELS[p.tipo] || p.tipo).toLowerCase()
        if (!label.includes(s) && !(p.project_name || '').toLowerCase().includes(s) && !p.conteudo.toLowerCase().includes(s)) return false
      }
      return true
    })
  }, [pecas, tipoFilter, search])

  // Stats per tipo
  const tipoCounts = pecas.reduce((acc, p) => {
    acc[p.tipo] = (acc[p.tipo] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  if (loading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '240px' }}><div className="spinner" /></div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Peças Geradas</h1>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
          {pecas.length} peça{pecas.length !== 1 ? 's' : ''} gerada{pecas.length !== 1 ? 's' : ''} por IA
        </p>
      </div>

      {/* Stats by tipo — toggleable filter chips */}
      {pecas.length > 0 && (
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {Object.entries(TIPO_LABELS).map(([key, label]) => {
            const count = tipoCounts[key] || 0
            if (count === 0) return null
            const isActive = tipoFilter === key
            return (
              <button
                key={key}
                onClick={() => setTipoFilter(isActive ? 'all' : key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '8px 14px', borderRadius: '6px',
                  background: isActive ? 'var(--accent-subtle)' : 'var(--bg-card)',
                  border: `1px solid ${isActive ? 'var(--accent-border)' : 'var(--border)'}`,
                  color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                  fontSize: '13px', fontWeight: 500, cursor: 'pointer',
                  transition: 'all 150ms ease',
                }}
              >
                {label}
                <span className="font-mono" style={{ fontWeight: 700, fontSize: '14px' }}>{count}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: '320px' }}>
          <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            placeholder="Buscar peça ou processo..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%', height: '36px', paddingLeft: '32px', paddingRight: '12px',
              borderRadius: '6px', background: 'var(--bg-input)', border: '1px solid var(--border)',
              color: 'var(--text-primary)', fontSize: '13px', outline: 'none',
            }}
          />
        </div>
        {tipoFilter !== 'all' && (
          <button
            onClick={() => setTipoFilter('all')}
            style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              padding: '6px 10px', borderRadius: '4px', fontSize: '12px',
              background: 'var(--accent-subtle)', color: 'var(--accent)',
              border: '1px solid var(--accent-border)', cursor: 'pointer',
            }}
          >
            {TIPO_LABELS[tipoFilter]} <X size={12} />
          </button>
        )}
      </div>

      {/* Detail Modal */}
      {selected && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.6)',
        }}>
          <div style={{
            width: '100%', maxWidth: '720px', maxHeight: '80vh',
            display: 'flex', flexDirection: 'column',
            borderRadius: '12px', overflow: 'hidden',
            background: 'var(--bg-card)', border: '1px solid var(--border)',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 20px', borderBottom: '1px solid var(--border)',
            }}>
              <div>
                <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  {TIPO_LABELS[selected.tipo] || selected.tipo}
                </h2>
                <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                  <span className="font-mono" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>v{selected.versao}</span>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{selected.project_name}</span>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{formatDate(selected.created_at)}</span>
                  <span className="font-mono" style={{ fontSize: '12px', color: 'var(--accent)' }}>{selected.modelo_ia}</span>
                </div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
                <X size={20} />
              </button>
            </div>
            <div style={{
              flex: 1, overflowY: 'auto', padding: '24px',
              whiteSpace: 'pre-wrap', fontSize: '14px', lineHeight: 1.7,
              color: 'var(--text-primary)',
            }}>
              {selected.conteudo}
            </div>
          </div>
        </div>
      )}

      {/* List */}
      {filteredPecas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
          <FileText size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
          <p style={{ fontSize: '14px' }}>
            {pecas.length === 0 ? 'Nenhuma peça gerada ainda.' : 'Nenhuma peça corresponde aos filtros.'}
          </p>
          {pecas.length === 0 && (
            <p style={{ fontSize: '13px', marginTop: '4px' }}>Acesse um processo e use a aba Peças para gerar.</p>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filteredPecas.map(peca => (
            <button
              key={peca.id}
              onClick={() => setSelected(peca)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                width: '100%', textAlign: 'left',
                padding: '16px 20px', borderRadius: '8px',
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                cursor: 'pointer', transition: 'border-color 150ms ease',
                color: 'inherit',
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent-border)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>
                    {TIPO_LABELS[peca.tipo] || peca.tipo}
                  </h3>
                  <span className="font-mono" style={{
                    padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 600,
                    background: 'var(--accent-subtle)', color: 'var(--accent)',
                    border: '1px solid var(--accent-border)',
                  }}>
                    v{peca.versao}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '12px', marginTop: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
                  <Link
                    href={`/dashboard/projects/${peca.project_id}`}
                    onClick={e => e.stopPropagation()}
                    style={{ color: 'var(--accent)', textDecoration: 'none' }}
                  >
                    {peca.project_name || '—'}
                  </Link>
                  <span>{formatDate(peca.created_at)}</span>
                </div>
              </div>
              <span className="font-mono" style={{
                padding: '4px 10px', borderRadius: '4px', fontSize: '11px',
                background: 'var(--bg-input)', color: 'var(--accent)',
                border: '1px solid var(--accent-border)', flexShrink: 0,
              }}>
                {peca.modelo_ia}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
