'use client'
import { createBrowserClient } from '@supabase/ssr'

const SUPABASE_URL = 'https://fbgqzouxbagmmlzibyhl.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZiZ3F6b3V4YmFnbW1semlieWhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0NzYxNTEsImV4cCI6MjA4ODA1MjE1MX0.o4SCzzeLf2IkXIhMyGRq9DuzOZWbg4w-uxdCTTHaY_E'

export function createSupabaseBrowserClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)
}
