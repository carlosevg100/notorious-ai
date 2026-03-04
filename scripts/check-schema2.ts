import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://fbgqzouxbagmmlzibyhl.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZiZ3F6b3V4YmFnbW1semlieWhsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjQ3NjE1MSwiZXhwIjoyMDg4MDUyMTUxfQ.p_SD9mQxanP0VHQqpm0NCqbRiuHk1MPGr-1dAAZqp2s'
)

async function main() {
  // Get columns for clients table
  const { data: client } = await supabase.from('clients').select('*').limit(1)
  console.log('clients columns:', client?.[0] ? Object.keys(client[0]).join(', ') : 'no rows - checking insert')
  
  // Try a minimal insert to see what columns exist
  const { error } = await supabase.from('clients').insert({ name: '__test__' }).select()
  if (error) {
    console.log('clients insert error:', error.message)
  } else {
    // Clean up
    await supabase.from('clients').delete().eq('name', '__test__')
    console.log('clients table: name column OK')
  }

  // Check projects columns
  const { data: proj } = await supabase.from('projects').select('*').limit(1)
  if (proj?.[0]) console.log('projects columns:', Object.keys(proj[0]).join(', '))
  
  // Check documents columns  
  const { data: doc } = await supabase.from('documents').select('*').limit(1)
  if (doc?.[0]) console.log('documents columns:', Object.keys(doc[0]).join(', '))
}

main()
