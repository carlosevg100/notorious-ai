/**
 * Migration 010: Multi-tenant Phase 1
 * Uses Supabase JS admin client + PostgREST to apply schema changes.
 * For DDL operations, we use individual table creation calls.
 * For SQL functions/triggers, we'll create a helper exec function first.
 */

const SUPABASE_URL = 'https://fbgqzouxbagmmlzibyhl.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZiZ3F6b3V4YmFnbW1semlieWhsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjQ3NjE1MSwiZXhwIjoyMDg4MDUyMTUxfQ.p_SD9mQxanP0VHQqpm0NCqbRiuHk1MPGr-1dAAZqp2s'

const headers = {
  'apikey': SERVICE_KEY,
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=minimal',
}

// SQL statements to apply in order. We'll break them into individual RPC calls.
// Since we can't run DDL directly, we'll check if tables/columns exist via REST
// and create what's missing.

async function api(path: string, opts: RequestInit = {}) {
  const r = await fetch(`${SUPABASE_URL}${path}`, { headers, ...opts })
  const text = await r.text()
  return { ok: r.ok, status: r.status, body: text }
}

async function rpc(fn: string, args: Record<string, unknown> = {}) {
  return api(`/rest/v1/rpc/${fn}`, { method: 'POST', body: JSON.stringify(args) })
}

async function checkColumn(table: string, column: string): Promise<boolean> {
  const r = await api(`/rest/v1/${table}?select=${column}&limit=0`)
  return r.ok // If column exists, returns 200
}

async function checkTable(table: string): Promise<boolean> {
  const r = await api(`/rest/v1/${table}?select=*&limit=0`)
  return r.ok
}

async function main() {
  console.log('Migration 010: Multi-tenant Phase 1\n')

  // Step 1: Check current state
  console.log('Checking current state...')
  const hasIsActive = await checkColumn('users', 'is_active')
  const hasInvitedBy = await checkColumn('users', 'invited_by')
  const hasFirmSettings = await checkTable('firm_settings')
  const hasFirmInvitations = await checkTable('firm_invitations')
  const hasPlatformAdmins = await checkTable('platform_admins')
  const hasCnpj = await checkColumn('firms', 'cnpj')

  console.log(`  users.is_active: ${hasIsActive}`)
  console.log(`  users.invited_by: ${hasInvitedBy}`)
  console.log(`  firms.cnpj: ${hasCnpj}`)
  console.log(`  firm_settings: ${hasFirmSettings}`)
  console.log(`  firm_invitations: ${hasFirmInvitations}`)
  console.log(`  platform_admins: ${hasPlatformAdmins}`)

  // Step 2: Try to create exec_sql helper function via RPC
  // First check if it already exists
  const execTest = await rpc('exec_sql', { sql: 'SELECT 1' })
  if (!execTest.ok) {
    console.log('\n⚠️  exec_sql function not available. Attempting alternative approach...')

    // Try using the Supabase Management API or pg-meta
    // Since we can't run DDL via PostgREST, we need to provide the migration SQL
    // for manual execution in the Supabase Dashboard SQL Editor.

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('MIGRATION NEEDS TO BE RUN VIA SUPABASE DASHBOARD')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('\nThe migration SQL file is at:')
    console.log('  supabase/migrations/010_multitenant_phase1.sql')
    console.log('\nTo apply:')
    console.log('1. Go to https://supabase.com/dashboard/project/fbgqzouxbagmmlzibyhl/sql/new')
    console.log('2. Paste the SQL from the migration file')
    console.log('3. Click "Run"')
    console.log('\nAlternatively, set up Supabase CLI with:')
    console.log('  supabase link --project-ref fbgqzouxbagmmlzibyhl')
    console.log('  supabase db push')

    // Even though we can't run DDL, let's verify what we CAN do
    // and at least update the is_active column for existing users if the migration
    // has been partially applied
    if (hasIsActive) {
      console.log('\n✅ Migration appears to have been already applied (is_active column exists)')
    }

    // Exit with success - the SQL file is ready for manual application
    process.exit(0)
  }

  // If exec_sql IS available, run the full migration
  console.log('\n✅ exec_sql available. Running migration...')

  const migrationSQL = require('fs').readFileSync(
    require('path').join(__dirname, '../supabase/migrations/010_multitenant_phase1.sql'),
    'utf-8'
  )

  const result = await rpc('exec_sql', { sql: migrationSQL })
  if (result.ok) {
    console.log('✅ Migration applied successfully!')
  } else {
    console.log('❌ Migration failed:', result.body)
    process.exit(1)
  }
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
