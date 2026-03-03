/**
 * Seed demo clients and link existing projects/contracts to them
 * Run: npx tsx scripts/seed-clients.ts
 */
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://fbgqzouxbagmmlzibyhl.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZiZ3F6b3V4YmFnbW1semlieWhsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjQ3NjE1MSwiZXhwIjoyMDg4MDUyMTUxfQ.p_SD9mQxanP0VHQqpm0NCqbRiuHk1MPGr-1dAAZqp2s'
)

const FIRM_ID = '1f430c10-550a-4267-9193-e03c831fc394'

const CLIENTS = [
  {
    name: 'Petrobras S.A.',
    type: 'pessoa_juridica',
    document: '33.000.167/0001-01',
    email: 'juridico@petrobras.com.br',
    firm_id: FIRM_ID,
  },
  {
    name: 'João Silva',
    type: 'pessoa_fisica',
    document: '123.456.789-00',
    email: 'joao.silva@email.com',
    firm_id: FIRM_ID,
  },
  {
    name: 'DEF Participações S.A.',
    type: 'pessoa_juridica',
    document: '12.345.678/0001-90',
    email: 'contato@defpart.com.br',
    firm_id: FIRM_ID,
  },
]

async function main() {
  console.log('Seeding demo clients...\n')

  const insertedClients: Record<string, string> = {}

  for (const client of CLIENTS) {
    // Idempotent: check if exists first
    const { data: existing } = await supabase
      .from('clients')
      .select('id, name')
      .eq('firm_id', FIRM_ID)
      .ilike('name', client.name)
      .single()

    if (existing) {
      console.log(`  ↩ Client already exists: ${client.name} (${existing.id})`)
      insertedClients[client.name] = existing.id
      continue
    }

    const { data, error } = await supabase
      .from('clients')
      .insert(client)
      .select('id, name')
      .single()

    if (error) {
      console.error(`  ✗ Failed to insert ${client.name}:`, error.message)
      continue
    }

    console.log(`  ✓ Created: ${data.name} (${data.id})`)
    insertedClients[client.name] = data.id
  }

  console.log('\nLinking existing projects...')

  // Link "Rescisao Indireta - Joao Silva" to João Silva
  const joaoId = insertedClients['João Silva']
  if (joaoId) {
    const { data: updated, error } = await supabase
      .from('projects')
      .update({ client_id: joaoId })
      .ilike('name', '%Rescisao%')
      .eq('firm_id', FIRM_ID)
      .select('id, name')

    if (error) console.error('  ✗ Link Rescisao:', error.message)
    else if (updated?.length) console.log(`  ✓ Linked ${updated.length} project(s) to João Silva`)
    else console.log('  ℹ No project matching "Rescisao" found')
  }

  // Link "Fusao Empresa X + Y" to DEF Participações
  const defId = insertedClients['DEF Participações S.A.']
  if (defId) {
    const { data: updated, error } = await supabase
      .from('projects')
      .update({ client_id: defId })
      .ilike('name', '%Fusao%')
      .eq('firm_id', FIRM_ID)
      .select('id, name')

    if (error) console.error('  ✗ Link Fusao:', error.message)
    else if (updated?.length) console.log(`  ✓ Linked ${updated.length} project(s) to DEF Participações`)
    else console.log('  ℹ No project matching "Fusao" found')
  }

  console.log('\nLinking existing contracts...')

  // Link "Acordo de Honorarios - Caso Petrobras" to Petrobras
  const petrobrasId = insertedClients['Petrobras S.A.']
  if (petrobrasId) {
    const { data: updated, error } = await supabase
      .from('contracts')
      .update({ client_id: petrobrasId })
      .ilike('name', '%Honorarios%')
      .eq('firm_id', FIRM_ID)
      .select('id, name')

    if (error) console.error('  ✗ Link Honorarios:', error.message)
    else if (updated?.length) console.log(`  ✓ Linked ${updated.length} contract(s) to Petrobras`)
    else console.log('  ℹ No contract matching "Honorarios" found')
  }

  // Link "Alteracao Contrato Social - DEF Participacoes" to DEF
  if (defId) {
    const { data: updated, error } = await supabase
      .from('contracts')
      .update({ client_id: defId })
      .ilike('name', '%DEF%')
      .eq('firm_id', FIRM_ID)
      .select('id, name')

    if (error) console.error('  ✗ Link DEF contract:', error.message)
    else if (updated?.length) console.log(`  ✓ Linked ${updated.length} contract(s) to DEF Participações`)
    else console.log('  ℹ No contract matching "DEF" found')
  }

  console.log('\n✓ Seed complete!')
}

main().catch(err => {
  console.error('Fatal error:', err.message)
  process.exit(1)
})
