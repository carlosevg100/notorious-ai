import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://fbgqzouxbagmmlzibyhl.supabase.co'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZiZ3F6b3V4YmFnbW1semlieWhsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjQ3NjE1MSwiZXhwIjoyMDg4MDUyMTUxfQ.p_SD9mQxanP0VHQqpm0NCqbRiuHk1MPGr-1dAAZqp2s'

export async function GET() {
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
    
    // Test if column already exists
    const { error } = await admin
      .from('documents')
      .select('doc_source')
      .limit(1)
    
    if (!error) {
      return NextResponse.json({ status: 'ok', message: 'Column doc_source already exists' })
    }
    
    return NextResponse.json({ 
      status: 'missing', 
      message: 'Column doc_source does not exist. Run this SQL in Supabase dashboard: ALTER TABLE documents ADD COLUMN IF NOT EXISTS doc_source TEXT DEFAULT \'parte_autora\';',
      sql: "ALTER TABLE documents ADD COLUMN IF NOT EXISTS doc_source TEXT DEFAULT 'parte_autora';"
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
