"use client";
import { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { User } from '@supabase/supabase-js'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const SUPA_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'

interface UserProfile {
  id: string; firm_id: string; email: string; name: string; role: string;
  firms: { id: string; name: string }
}
interface AuthContextType {
  user: User | null; profile: UserProfile | null; loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType)

// Singleton supabase for browser
let _browserClient: ReturnType<typeof createClient> | null = null
function getBrowserSupabase() {
  if (!_browserClient) _browserClient = createClient(SUPA_URL, SUPA_KEY)
  return _browserClient
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  async function fetchProfile() {
    try {
      const res = await fetch('/api/auth/me')
      if (res.ok) { const data = await res.json(); setProfile(data.profile) }
    } catch (e) {}
  }

  useEffect(() => {
    const supabase = getBrowserSupabase()
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile().finally(() => setLoading(false))
      else setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile()
      else { setProfile(null); setLoading(false) }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function signIn(email: string, password: string) {
    const { error } = await getBrowserSupabase().auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  async function signOut() {
    await getBrowserSupabase().auth.signOut()
    setUser(null); setProfile(null)
  }

  async function refreshProfile() { await fetchProfile() }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
