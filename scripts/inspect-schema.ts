import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://fbgqzouxbagmmlzibyhl.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZiZ3F6b3V4YmFnbW1semlieWhsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjQ3NjE1MSwiZXhwIjoyMDg4MDUyMTUxfQ.p_SD9mQxanP0VHQqpm0NCqbRiuHk1MPGr-1dAAZqp2s'
)

async function main() {
  // Check documents table - try insert with V4 fields to see which ones work
  console.log('\n=== Testing documents table V4 columns ===')
  const testFields = ['storage_path', 'processing_status', 'extracted_data', 'extracted_text', 'file_size_bytes', 'processing_error', 'processing_started_at', 'processing_completed_at']
  
  for (const field of testFields) {
    const testData: any = { name: '__test__', file_path: 'test', project_id: '00000000-0000-0000-0000-000000000000', firm_id: '00000000-0000-0000-0000-000000000000' }
    testData[field] = 'test'
    const { error } = await supabase.from('documents').insert(testData)
    const exists = !error || !error.message.includes(`'${field}'`)
    console.log(exists ? '✓' : '✗', field, error ? `(${error.message.split('.')[0].trim()})` : '')
  }
  
  console.log('\n=== Testing projects table V4 columns ===')
  const projFields = ['numero_processo', 'tipo', 'fase', 'vara', 'comarca']
  for (const field of projFields) {
    const testData: any = { name: '__test__', firm_id: '00000000-0000-0000-0000-000000000000' }
    testData[field] = 'test'
    const { error } = await supabase.from('projects').insert(testData)
    const exists = !error || !error.message.includes(`'${field}'`)
    console.log(exists ? '✓' : '✗', field, error ? `(${error.message.split('.')[0].trim()})` : '')
  }
  
  console.log('\n=== Testing clients table V4 columns ===')
  const clientFields = ['cnpj']
  for (const field of clientFields) {
    const testData: any = { name: '__test__', firm_id: '00000000-0000-0000-0000-000000000000' }
    testData[field] = 'test'
    const { error } = await supabase.from('clients').insert(testData)
    const exists = !error || !error.message.includes(`'${field}'`)
    console.log(exists ? '✓' : '✗', field, error ? `(${error.message.split('.')[0].trim()})` : '')
  }
}

main()
