/**
 * Security helper — extracts firm_id exclusively from the authenticated Supabase JWT.
 * Never accepts firm_id from request body, query string, or URL params.
 *
 * Fixes IDOR vulnerability: previously any authenticated user could pass any firm_id
 * in the request body and access another firm's data.
 */
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const SUPABASE_URL = 'https://fbgqzouxbagmmlzibyhl.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

function getAdmin() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
}

export interface AuthenticatedContext {
  firm_id: string
  user_id: string
  role: string
}

/**
 * Extracts and validates the caller's firm_id from the JWT Bearer token.
 * Throws a NextResponse with appropriate status on failure.
 */
export async function getAuthenticatedFirmId(
  req: NextRequest
): Promise<AuthenticatedContext | NextResponse> {
  const supabaseAdmin = getAdmin()

  const authHeader = req.headers.get('Authorization')
  const token = authHeader?.replace('Bearer ', '').trim()

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('users')
    .select('firm_id, role')
    .eq('id', user.id)
    .single()

  if (profileError || !profile?.firm_id) {
    return NextResponse.json({ error: 'Forbidden — no firm association' }, { status: 403 })
  }

  return {
    firm_id: profile.firm_id,
    user_id: user.id,
    role: profile.role ?? 'member',
  }
}

/**
 * Type guard — returns true if value is a NextResponse (i.e., auth failed).
 */
export function isAuthError(v: AuthenticatedContext | NextResponse): v is NextResponse {
  return v instanceof NextResponse
}
