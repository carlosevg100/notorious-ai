import { createBrowserClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://fbgqzouxbagmmlzibyhl.supabase.co'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZiZ3F6b3V4YmFnbW1semlieWhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0NzYxNTEsImV4cCI6MjA4ODA1MjE1MX0.o4SCzzeLf2IkXIhMyGRq9DuzOZWbg4w-uxdCTTHaY_E'

// Browser client — stores session in cookies (compatible with middleware)
export const supabase = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Server-side admin client (bypasses RLS)
export function createAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  return createClient(SUPABASE_URL, serviceKey)
}

export { SUPABASE_URL, SUPABASE_ANON_KEY }
