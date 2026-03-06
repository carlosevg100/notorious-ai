/**
 * migrate-storage-paths.ts
 *
 * Migrates existing storage objects from:
 *   documents/{project_id}/{filename}  (OLD — broken for RLS)
 * to:
 *   {firm_id}/{project_id}/{filename}  (NEW — RLS-compatible)
 *
 * Also updates the storage_path column in public.documents.
 *
 * Safe to run multiple times (idempotent).
 *
 * Usage:
 *   npx ts-node --project tsconfig.scripts.json scripts/migrate-storage-paths.ts
 *   OR: npx tsx scripts/migrate-storage-paths.ts
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://fbgqzouxbagmmlzibyhl.supabase.co'
const SERVICE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZiZ3F6b3V4YmFnbW1semlieWhsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjQ3NjE1MSwiZXhwIjoyMDg4MDUyMTUxfQ.p_SD9mQxanP0VHQqpm0NCqbRiuHk1MPGr-1dAAZqp2s'

const BUCKET = 'documents'

async function main() {
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

  console.log('🔍 Fetching documents with old-format storage paths...')

  // Fetch all documents whose storage_path starts with "documents/" (old format)
  const { data: docs, error: fetchErr } = await supabase
    .from('documents')
    .select('id, name, storage_path, firm_id, project_id')
    .like('storage_path', 'documents/%')
    .order('created_at', { ascending: true })

  if (fetchErr) {
    console.error('❌ Failed to fetch documents:', fetchErr.message)
    process.exit(1)
  }

  if (!docs || docs.length === 0) {
    console.log('✅ No documents with old-format paths found. Nothing to migrate.')
    return
  }

  console.log(`📦 Found ${docs.length} document(s) to migrate.`)

  let migrated = 0
  let failed = 0

  for (const doc of docs) {
    const oldPath = doc.storage_path as string
    const firmId = doc.firm_id as string
    const projectId = doc.project_id as string

    if (!firmId || !projectId) {
      console.warn(`⚠️  Skipping doc ${doc.id} — missing firm_id or project_id`)
      failed++
      continue
    }

    // Old path: documents/{project_id}/{timestamp}_{filename}
    // Extract just the filename part (everything after the 2nd slash)
    const parts = oldPath.split('/')
    // parts[0] = 'documents', parts[1] = project_id, parts[2..] = filename
    const filenamePart = parts.slice(2).join('/')
    const newPath = `${firmId}/${projectId}/${filenamePart}`

    if (oldPath === newPath) {
      console.log(`  ✅ Already correct: ${doc.name}`)
      migrated++
      continue
    }

    console.log(`  🔄 Migrating: ${doc.name}`)
    console.log(`     OLD: ${oldPath}`)
    console.log(`     NEW: ${newPath}`)

    // Step 1: Download from old path
    const { data: fileData, error: downloadErr } = await supabase.storage
      .from(BUCKET)
      .download(oldPath)

    if (downloadErr || !fileData) {
      console.error(`  ❌ Download failed for ${doc.name}: ${downloadErr?.message}`)
      failed++
      continue
    }

    // Step 2: Upload to new path
    const buffer = await fileData.arrayBuffer()
    const { error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(newPath, buffer, {
        contentType: 'application/pdf',
        upsert: true,
      })

    if (uploadErr) {
      console.error(`  ❌ Upload failed for ${doc.name}: ${uploadErr.message}`)
      failed++
      continue
    }

    // Step 3: Update DB record
    const { error: updateErr } = await supabase
      .from('documents')
      .update({ storage_path: newPath })
      .eq('id', doc.id)

    if (updateErr) {
      console.error(`  ❌ DB update failed for ${doc.name}: ${updateErr.message}`)
      // Cleanup: remove newly uploaded file to avoid orphan
      await supabase.storage.from(BUCKET).remove([newPath])
      failed++
      continue
    }

    // Step 4: Remove old file from storage
    const { error: removeErr } = await supabase.storage.from(BUCKET).remove([oldPath])
    if (removeErr) {
      // Non-fatal — DB is already updated, old file will just be an orphan
      console.warn(`  ⚠️  Old file not removed (non-fatal): ${removeErr.message}`)
    }

    console.log(`  ✅ Migrated: ${doc.name}`)
    migrated++
  }

  console.log(`\n📊 Migration complete: ${migrated} migrated, ${failed} failed`)

  if (failed > 0) {
    console.error('❌ Some documents failed to migrate. Review logs above.')
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
