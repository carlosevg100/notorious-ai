// Apply contracts schema to Supabase
// Run: npx tsx scripts/apply-contracts-schema.ts

import * as fs from 'fs'
import * as path from 'path'

const SUPABASE_URL = 'https://fbgqzouxbagmmlzibyhl.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZiZ3F6b3V4YmFnbW1semlieWhsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjQ3NjE1MSwiZXhwIjoyMDg4MDUyMTUxfQ.p_SD9mQxanP0VHQqpm0NCqbRiuHk1MPGr-1dAAZqp2s'

const headers = {
  'apikey': SERVICE_KEY,
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json'
}

const sqlFile = path.join(__dirname, '..', 'supabase', 'migrations', '002_contracts.sql')
const sql = fs.readFileSync(sqlFile, 'utf-8')

async function tryRpcExecSql(sqlText: string) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ sql: sqlText })
    })
    const body = await res.text()
    return { ok: res.ok, status: res.status, body }
  } catch (e: any) {
    return { ok: false, status: 0, body: e.message }
  }
}

async function checkTableExists(tableName: string) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${tableName}?limit=1`, {
      headers: { ...headers, 'Prefer': 'count=exact' }
    })
    return res.ok || res.status === 406
  } catch {
    return false
  }
}

async function main() {
  console.log('\n📋 Applying contracts schema to Supabase\n')

  // Try approach 1: RPC exec_sql
  console.log('Approach 1: Trying RPC exec_sql...')
  const rpcResult = await tryRpcExecSql(sql)
  if (rpcResult.ok) {
    console.log('✅ Schema applied via RPC exec_sql!')
    return
  }
  console.log(`  ✗ RPC failed (${rpcResult.status}): ${rpcResult.body.substring(0, 100)}`)

  // Try approach 2: check if tables already exist
  console.log('\nApproach 2: Checking if tables already exist...')
  const tables = ['contracts', 'contract_extractions', 'contract_alerts', 'contract_versions']
  const results = await Promise.all(tables.map(async t => ({ table: t, exists: await checkTableExists(t) })))

  const allExist = results.every(r => r.exists)
  results.forEach(r => console.log(`  ${r.exists ? '✅' : '✗'} ${r.table}`))

  if (allExist) {
    console.log('\n✅ All tables already exist! Schema is already applied.')
    return
  }

  // Print SQL for manual application
  console.log('\n' + '═'.repeat(70))
  console.log('⚠️  Could not apply schema automatically.')
  console.log('Please apply the following SQL in Supabase Dashboard SQL Editor:')
  console.log('   https://supabase.com/dashboard/project/fbgqzouxbagmmlzibyhl/sql/new')
  console.log('═'.repeat(70))
  console.log('\n-- === PASTE THIS SQL IN SUPABASE SQL EDITOR === --\n')
  console.log(sql)
  console.log('\n-- === END OF SQL === --\n')
}

main().catch(err => {
  console.error('\n❌ Error:', err.message)
  process.exit(1)
})
