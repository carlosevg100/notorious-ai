'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from './supabase'
import type { Session, User } from '@supabase/supabase-js'

interface AuthContextValue {
  user: User | null
  session: Session | null
  firmId: string
  role: string
  userName: string | null
  loading: boolean
  error: string | null
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

async function fetchUserRecord(userId: string) {
  const { data } = await supabase
    .from('users')
    .select('firm_id, role, name, is_active')
    .eq('id', userId)
    .single()
  return data
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [firmId, setFirmId] = useState<string>('')
  const [role, setRole] = useState<string>('advogado')
  const [userName, setUserName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function handleSession(session: Session | null) {
    setSession(session)
    setUser(session?.user ?? null)
    setError(null)

    if (!session?.user) {
      setFirmId('')
      setRole('advogado')
      setUserName(null)
      setLoading(false)
      return
    }

    const userRecord = await fetchUserRecord(session.user.id)

    if (!userRecord || !userRecord.firm_id) {
      setError('Acesso não configurado. Contacte o administrador do seu escritório.')
      await supabase.auth.signOut()
      setLoading(false)
      return
    }

    if (userRecord.is_active === false) {
      setError('Conta suspensa. Contacte o administrador.')
      await supabase.auth.signOut()
      setLoading(false)
      return
    }

    setFirmId(userRecord.firm_id)
    setRole(userRecord.role || 'advogado')
    if (userRecord.name) setUserName(userRecord.name)
    setLoading(false)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleSession(session)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      handleSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setFirmId('')
    setRole('advogado')
    setUserName(null)
  }

  return (
    <AuthContext.Provider value={{ user, session, firmId, role, userName, loading, error, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
