import { Client } from 'pg'
import * as fs from 'fs'
import * as path from 'path'

const PROJECT_REF = 'fbgqzouxbagmmlzibyhl'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZiZ3F6b3V4YmFnbW1semlieWhsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjQ3NjE1MSwiZXhwIjoyMDg4MDUyMTUxfQ.p_SD9mQxanP0VHQqpm0NCqbRiuHk1MPGr-1dAAZqp2s'

const SQL = fs.readFileSync(
  path.join(__dirname, '../supabase/migrations/004_litigancia.sql'),
  'utf8'
)

async function main() {
  console.log('Applying 004_litigancia.sql migration...\n')

  const client = new Client({
    host: `db.${PROJECT_REF}.supabase.co`,
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: SERVICE_KEY,
    ssl: { rejectUnauthorized: false },
  })

  try {
    await client.connect()
    console.log('Connected to postgres!')
    await client.query(SQL)
    console.log('✓ Migration applied successfully!')
  } catch (err: any) {
    console.error('Direct connection failed:', err.message)
    console.log('\nTrying pooler connection...')

    const pooler = new Client({
      host: `aws-0-us-east-1.pooler.supabase.com`,
      port: 5432,
      database: 'postgres',
      user: `postgres.${PROJECT_REF}`,
      password: SERVICE_KEY,
      ssl: { rejectUnauthorized: false },
    })

    try {
      await pooler.connect()
      console.log('Connected via pooler!')
      await pooler.query(SQL)
      console.log('✓ Migration applied successfully!')
      await pooler.end()
    } catch (err2: any) {
      console.error('Pooler also failed:', err2.message)
      console.log('\n========================================')
      console.log('AUTO-APPLY FAILED — Run this SQL manually:')
      console.log('https://supabase.com/dashboard/project/fbgqzouxbagmmlzibyhl/sql/new')
      console.log('========================================\n')
      console.log(SQL)
    }
  } finally {
    try { await client.end() } catch {}
  }
}

main().catch(err => {
  console.error('Fatal:', err.message)
  process.exit(0)
})
