import { supabase, supabaseAdmin } from './supabase'

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signUp(email: string, password: string, name: string, firmName: string) {
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) throw error
  if (!data.user) throw new Error('No user returned')
  
  // Create firm
  const { data: firm, error: firmErr } = await supabaseAdmin
    .from('firms')
    .insert({ name: firmName })
    .select()
    .single()
  if (firmErr) throw firmErr
  
  // Create user profile
  const { error: userErr } = await supabaseAdmin
    .from('users')
    .insert({ id: data.user.id, firm_id: firm.id, email, name, role: 'admin' })
  if (userErr) throw userErr
  
  return { user: data.user, firm }
}

export async function signOut() {
  await supabase.auth.signOut()
}

export async function getUser() {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function getUserProfile(userId: string) {
  const { data } = await supabaseAdmin
    .from('users')
    .select('*, firms(*)')
    .eq('id', userId)
    .single()
  return data
}
