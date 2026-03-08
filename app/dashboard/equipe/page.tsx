'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/theme-context'
import { getColors } from '@/lib/theme-colors'
import { formatDate } from '@/lib/utils'

interface TeamMember {
  id: string
  name: string
  email: string
  role: string
  is_active: boolean
  created_at: string
}

interface Invitation {
  id: string
  email: string
  role: string
  status: string
  created_at: string
  expires_at: string
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  advogado: 'Advogado(a)',
  estagiario: 'Estagiário(a)',
  consulta: 'Consulta',
}

const ROLE_OPTIONS = [
  { value: 'advogado', label: 'Advogado(a)' },
  { value: 'admin', label: 'Administrador' },
  { value: 'estagiario', label: 'Estagiário(a)' },
  { value: 'consulta', label: 'Somente Consulta' },
]

export default function EquipePage() {
  const { firmId, role, session, user } = useAuth()
  const { theme } = useTheme()
  const C = getColors(theme)

  const [members, setMembers] = useState<TeamMember[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(true)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('advogado')
  const [inviting, setInviting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const isAdmin = role === 'admin'

  async function handleDeactivate(userId: string) {
    if (!isAdmin) return
    const { error: updateError } = await supabase
      .from('users')
      .update({ is_active: false })
      .eq('id', userId)
      .eq('firm_id', firmId)

    if (updateError) {
      setError('Erro ao desativar membro: ' + updateError.message)
    } else {
      setSuccess('Membro desativado com sucesso')
      loadTeam()
    }
  }

  async function loadTeam() {
    if (!firmId) return
    setLoading(true)

    const { data: teamData } = await supabase
      .from('users')
      .select('id, name, email, role, is_active, created_at')
      .eq('firm_id', firmId)
      .order('created_at', { ascending: true })

    setMembers(teamData || [])

    if (isAdmin && session?.access_token) {
      try {
        const res = await fetch('/api/invitations', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (res.ok) {
          setInvitations(await res.json())
        }
      } catch {
        // Invitations table may not exist yet
      }
    }

    setLoading(false)
  }

  useEffect(() => { loadTeam() }, [firmId])

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!session?.access_token) return
    setInviting(true)
    setError('')
    setSuccess('')

    try {
      const res = await fetch('/api/invitations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Erro ao enviar convite')
      } else {
        setSuccess(`Convite enviado para ${inviteEmail}`)
        setInviteEmail('')
        setInviteRole('advogado')
        setShowInviteModal(false)
        loadTeam()
      }
    } catch {
      setError('Erro de conexão')
    } finally {
      setInviting(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: '38px',
    padding: '0 12px',
    borderRadius: '6px',
    background: C.bg1,
    border: `1px solid ${C.border2}`,
    color: C.text1,
    fontSize: '13px',
    outline: 'none',
    boxSizing: 'border-box' as const,
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: C.text1, margin: 0 }}>Equipe</h1>
          <p style={{ fontSize: '13px', color: C.text3, marginTop: '4px' }}>
            {members.length} membro{members.length !== 1 ? 's' : ''} no escritório
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowInviteModal(true)}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              background: C.amber,
              color: '#000',
              fontWeight: 600,
              fontSize: '13px',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            + Convidar Colaborador
          </button>
        )}
      </div>

      {/* Success / Error messages */}
      {success && (
        <div style={{ padding: '10px 14px', borderRadius: '6px', background: C.greenBg, border: `1px solid ${C.greenBorder}`, color: C.green, fontSize: '13px', marginBottom: '16px' }}>
          {success}
        </div>
      )}
      {error && (
        <div style={{ padding: '10px 14px', borderRadius: '6px', background: C.redBg, border: `1px solid ${C.redBorder}`, color: C.red, fontSize: '13px', marginBottom: '16px' }}>
          {error}
        </div>
      )}

      {/* Team Members Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: C.text3 }}>Carregando...</div>
      ) : (
        <div style={{
          borderRadius: '8px',
          border: `1px solid ${C.border1}`,
          overflow: 'hidden',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: C.bg1 }}>
                {[...['Nome', 'Email', 'Cargo', 'Status', 'Desde'], ...(isAdmin ? ['Ações'] : [])].map(h => (
                  <th key={h} style={{
                    padding: '10px 14px',
                    textAlign: 'left',
                    fontSize: '10px',
                    fontWeight: 600,
                    color: C.text3,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    fontFamily: 'var(--font-mono)',
                    borderBottom: `1px solid ${C.border1}`,
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {members.map(m => (
                <tr key={m.id} style={{ borderBottom: `1px solid ${C.border1}` }}>
                  <td style={{ padding: '12px 14px', fontSize: '13px', fontWeight: 500, color: C.text1 }}>
                    {m.name || '—'}
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: '13px', color: C.text2 }}>
                    {m.email}
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 600,
                      background: m.role === 'admin' ? C.amberBg : C.blueBg,
                      color: m.role === 'admin' ? C.amber : C.blue,
                      border: `1px solid ${m.role === 'admin' ? C.amberBorder : C.blueBorder}`,
                    }}>
                      {ROLE_LABELS[m.role] || m.role}
                    </span>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 500,
                      background: m.is_active !== false ? C.greenBg : C.redBg,
                      color: m.is_active !== false ? C.green : C.red,
                      border: `1px solid ${m.is_active !== false ? C.greenBorder : C.redBorder}`,
                    }}>
                      {m.is_active !== false ? 'Ativo' : 'Suspenso'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: '12px', color: C.text3, fontFamily: 'var(--font-mono)' }}>
                    {formatDate(m.created_at)}
                  </td>
                  {isAdmin && (
                    <td style={{ padding: '12px 14px' }}>
                      {m.id !== user?.id && m.is_active !== false && (
                        <button
                          onClick={() => handleDeactivate(m.id)}
                          style={{
                            padding: '4px 10px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 500,
                            background: 'transparent',
                            border: `1px solid ${C.redBorder}`,
                            color: C.red,
                            cursor: 'pointer',
                          }}
                        >
                          Desativar
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pending Invitations */}
      {isAdmin && invitations.length > 0 && (
        <div style={{ marginTop: '32px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: C.text1, marginBottom: '12px' }}>
            Convites Pendentes
          </h2>
          <div style={{
            borderRadius: '8px',
            border: `1px solid ${C.border1}`,
            overflow: 'hidden',
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: C.bg1 }}>
                  {['Email', 'Cargo', 'Status', 'Enviado em', 'Expira em'].map(h => (
                    <th key={h} style={{
                      padding: '10px 14px',
                      textAlign: 'left',
                      fontSize: '10px',
                      fontWeight: 600,
                      color: C.text3,
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      fontFamily: 'var(--font-mono)',
                      borderBottom: `1px solid ${C.border1}`,
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invitations.map(inv => (
                  <tr key={inv.id} style={{ borderBottom: `1px solid ${C.border1}` }}>
                    <td style={{ padding: '12px 14px', fontSize: '13px', color: C.text2 }}>{inv.email}</td>
                    <td style={{ padding: '12px 14px', fontSize: '12px', color: C.text2 }}>
                      {ROLE_LABELS[inv.role] || inv.role}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 500,
                        background: inv.status === 'pending' ? C.yellowBg : inv.status === 'accepted' ? C.greenBg : C.redBg,
                        color: inv.status === 'pending' ? C.yellow : inv.status === 'accepted' ? C.green : C.red,
                      }}>
                        {inv.status === 'pending' ? 'Pendente' : inv.status === 'accepted' ? 'Aceito' : inv.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: '12px', color: C.text3, fontFamily: 'var(--font-mono)' }}>
                      {formatDate(inv.created_at)}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: '12px', color: C.text3, fontFamily: 'var(--font-mono)' }}>
                      {formatDate(inv.expires_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div
          onClick={() => setShowInviteModal(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: '420px',
              padding: '24px',
              borderRadius: '10px',
              background: C.bg2,
              border: `1px solid ${C.border2}`,
            }}
          >
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: C.text1, margin: '0 0 16px' }}>
              Convidar Colaborador
            </h3>

            <form onSubmit={handleInvite} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: C.text2, marginBottom: '4px' }}>
                  Email
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  required
                  placeholder="colaborador@escritorio.com.br"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: C.text2, marginBottom: '4px' }}>
                  Cargo
                </label>
                <select
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value)}
                  style={{ ...inputStyle, appearance: 'auto' as never }}
                >
                  {ROLE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <p style={{ fontSize: '11px', color: C.text3, margin: 0 }}>
                O colaborador receberá um email com link para criar a conta.
                Limite: 3 convites/hora no plano gratuito.
              </p>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  style={{
                    padding: '8px 16px', borderRadius: '6px',
                    background: 'transparent', border: `1px solid ${C.border2}`,
                    color: C.text2, fontSize: '13px', cursor: 'pointer',
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={inviting}
                  style={{
                    padding: '8px 16px', borderRadius: '6px',
                    background: C.amber, color: '#000',
                    fontWeight: 600, fontSize: '13px',
                    border: 'none', cursor: inviting ? 'not-allowed' : 'pointer',
                    opacity: inviting ? 0.7 : 1,
                  }}
                >
                  {inviting ? 'Enviando...' : 'Enviar Convite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
