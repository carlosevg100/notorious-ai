import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://fbgqzouxbagmmlzibyhl.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZiZ3F6b3V4YmFnbW1semlieWhsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjQ3NjE1MSwiZXhwIjoyMDg4MDUyMTUxfQ.p_SD9mQxanP0VHQqpm0NCqbRiuHk1MPGr-1dAAZqp2s'
)

const FIRM_ID = '1f430c10-550a-4267-9193-e03c831fc394'

async function main() {
  // Check if TechInova already exists
  const { data: existing } = await supabase
    .from('clients')
    .select('id, name')
    .eq('firm_id', FIRM_ID)
    .eq('name', 'TechInova Ltda')
    .single()
  
  let clientId = existing?.id
  
  if (!clientId) {
    const { data: client, error } = await supabase
      .from('clients')
      .insert({ firm_id: FIRM_ID, name: 'TechInova Ltda', cnpj: '12.345.678/0001-90', email: 'juridico@techinova.com.br', type: 'empresa' })
      .select()
      .single()
    
    if (error) { console.error('Client error:', error.message); return }
    clientId = client.id
    console.log('✓ Created client:', client.name, client.id)
  } else {
    console.log('✓ Client already exists:', existing.name, clientId)
  }
  
  // Check if demo project already exists
  const { data: existingProject } = await supabase
    .from('projects')
    .select('id, name')
    .eq('client_id', clientId)
    .single()
  
  if (!existingProject) {
    const { data: project, error: pErr } = await supabase
      .from('projects')
      .insert({
        firm_id: FIRM_ID,
        client_id: clientId,
        name: 'Ação de Cobrança — Contrato SaaS',
        numero_processo: '0001234-56.2024.8.26.0100',
        tipo: 'contencioso',
        fase: 'analise',
        vara: '5ª Vara Cível',
        comarca: 'São Paulo',
        status: 'ativo'
      })
      .select()
      .single()
    
    if (pErr) { console.error('Project error:', pErr.message); return }
    console.log('✓ Created project:', project.name, project.id)
  } else {
    console.log('✓ Project already exists:', existingProject.name, existingProject.id)
  }
  
  console.log('\nDemo seed complete!')
}

main()
