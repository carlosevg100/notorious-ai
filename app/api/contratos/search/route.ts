import { NextResponse } from 'next/server'
import { supabaseAdmin, createServerSupabase } from '@/lib/supabase'
import OpenAI from 'openai'

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'placeholder' })
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (!a?.length || !b?.length || a.length !== b.length) return 0
  const dot = a.reduce((sum, ai, i) => sum + ai * b[i], 0)
  const normA = Math.sqrt(a.reduce((sum, ai) => sum + ai * ai, 0))
  const normB = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0))
  if (normA === 0 || normB === 0) return 0
  return dot / (normA * normB)
}

export async function POST(request: Request) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabaseAdmin.from('users').select('firm_id').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const { query } = await request.json()
  if (!query?.trim()) return NextResponse.json([])

  // Generate query embedding
  let queryEmbedding: number[] = []
  try {
    const openai = getOpenAI()
    const res = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: query.substring(0, 8000)
    })
    queryEmbedding = res.data[0].embedding
  } catch (e) {}

  // Fetch all contracts with extractions
  const { data: contracts, error } = await supabaseAdmin
    .from('contracts')
    .select('*, contract_extractions(*)')
    .eq('firm_id', profile.firm_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!contracts?.length) return NextResponse.json([])

  const queryLower = query.toLowerCase()

  // Score each contract
  const scored = contracts.map(contract => {
    let score = 0

    // Text match on name
    if (contract.name?.toLowerCase().includes(queryLower)) score += 0.5

    // Text match on parties
    const partiesStr = JSON.stringify(contract.parties || '').toLowerCase()
    if (partiesStr.includes(queryLower)) score += 0.3

    // Text match on type/responsible_lawyer
    if (contract.contract_type?.toLowerCase().includes(queryLower)) score += 0.2
    if (contract.responsible_lawyer?.toLowerCase().includes(queryLower)) score += 0.1

    // Embedding similarity
    const extraction = contract.contract_extractions?.[0]
    const embeddingArr = extraction?.raw_extraction?.embedding
    if (queryEmbedding.length && Array.isArray(embeddingArr)) {
      const sim = cosineSimilarity(queryEmbedding, embeddingArr)
      score += sim * 0.8
    }

    return { ...contract, _score: score }
  })

  // Sort by score descending, return top 10
  const results = scored
    .sort((a, b) => b._score - a._score)
    .slice(0, 10)
    .map(({ _score, ...c }) => c)

  return NextResponse.json(results)
}
