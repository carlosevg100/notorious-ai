// Seed demo data for B/Luz account
// Run: npx tsx scripts/seed-demo.ts

const SUPABASE_URL = 'https://fbgqzouxbagmmlzibyhl.supabase.co'
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZiZ3F6b3V4YmFnbW1semlieWhsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjQ3NjE1MSwiZXhwIjoyMDg4MDUyMTUxfQ.p_SD9mQxanP0VHQqpm0NCqbRiuHk1MPGr-1dAAZqp2s'
const FIRM_ID = '1f430c10-550a-4267-9193-e03c831fc394'

const headers = {
  'apikey': SUPABASE_SERVICE_KEY,
  'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
}

async function supabaseGet(table: string, filter: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, { headers })
  return res.json()
}

async function supabaseInsert(table: string, data: object) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data)
  })
  const json = await res.json()
  if (!res.ok) throw new Error(`Insert into ${table} failed: ${JSON.stringify(json)}`)
  return Array.isArray(json) ? json[0] : json
}

async function getOrCreateProject(name: string, area: string, status: string, risk_level: string) {
  const existing = await supabaseGet('projects', `name=eq.${encodeURIComponent(name)}&firm_id=eq.${FIRM_ID}&select=id,name`)
  if (Array.isArray(existing) && existing.length > 0) {
    console.log(`  ↩  Project already exists: "${name}" (${existing[0].id})`)
    return existing[0]
  }
  const project = await supabaseInsert('projects', { name, area, status, risk_level, firm_id: FIRM_ID })
  console.log(`  ✓  Created project: "${name}" (${project.id})`)
  return project
}

async function createDocument(name: string, firm_id: string, project_id: string, file_type = 'pdf') {
  const doc = await supabaseInsert('documents', {
    name,
    firm_id,
    project_id,
    ai_status: 'complete',
    file_type,
    file_path: `${project_id}/${name.replace(/\s+/g, '_')}.${file_type}`,
    upload_status: 'uploaded'
  })
  console.log(`    ✓ Document: "${name}" (${doc.id})`)
  return doc
}

async function createExtraction(document_id: string, data: object) {
  const ext = await supabaseInsert('document_extractions', { document_id, ...data })
  console.log(`    ✓ Extraction created`)
  return ext
}

async function createAlert(firm_id: string, project_id: string, document_id: string, type: string, message: string) {
  const alert = await supabaseInsert('ai_alerts', { firm_id, project_id, document_id, type, message, is_read: false })
  console.log(`    ✓ Alert [${type}]: ${message.substring(0, 80)}...`)
  return alert
}

async function main() {
  console.log('\n🌱 Seeding demo data for B/Luz account\n')
  console.log(`Firm ID: ${FIRM_ID}\n`)

  // ─── PROJECT 1: Rescisão Indireta ────────────────────────────────────────────
  console.log('📁 PROJECT 1: Rescisão Indireta — João Silva')
  const proj1 = await getOrCreateProject(
    'Rescisão Indireta — João Silva',
    'Trabalhista',
    'ativo',
    'alto'
  )

  console.log('  📄 Documents:')
  const doc1a = await createDocument('Contrato de Trabalho — João Silva.pdf', FIRM_ID, proj1.id)
  const doc1b = await createDocument('TRCT e Termo de Rescisão.pdf', FIRM_ID, proj1.id)

  console.log('  🧠 Extractions:')
  await createExtraction(doc1a.id, {
    doc_type: 'Contrato de Trabalho',
    parties: [
      { name: 'João Carlos Silva', role: 'Empregado' },
      { name: 'Metalúrgica Progresso LTDA', role: 'Empregadora' }
    ],
    key_dates: [
      { date: '05/03/2015', description: 'Data de admissão' },
      { date: '15/01/2026', description: 'Data de rescisão indireta' }
    ],
    deadlines: [
      { date: '15/04/2026', description: 'Prazo para ajuizamento da reclamação trabalhista', urgency: 'alta' },
      { date: '30/04/2026', description: 'Prazo para solicitação de FGTS', urgency: 'media' }
    ],
    risk_flags: [
      { description: 'Empregado com doença ocupacional (LER) sem afastamento registrado — risco de nulidade da rescisão', severity: 'alto' },
      { description: 'TRCT assinado sem assistência sindical — possível vício de consentimento', severity: 'alto' },
      { description: 'Descumprimento de cláusulas contratuais pelo empregador — horas extras não pagas', severity: 'medio' }
    ],
    summary: 'Contrato de trabalho entre João Carlos Silva e Metalúrgica Progresso LTDA, vigente de março de 2015 a janeiro de 2026. O empregado, após 10 anos e 10 meses de serviços, pleiteia rescisão indireta por descumprimento de obrigações contratuais pelo empregador, incluindo não pagamento de horas extras, ausência de EPI adequado e assédio moral. O documento apresenta inconsistências relevantes nas datas e assinaturas que podem caracterizar adulteração.',
    raw_extraction: {
      doc_type: 'Contrato de Trabalho',
      fraud_risk: {
        detected: true,
        confidence: 'alto',
        indicators: [
          'Data de admissão inconsistente com data do FGTS — contrato indica 05/03/2015 mas FGTS mostra recolhimentos apenas a partir de 08/2015',
          'Assinatura divergente entre páginas 2 e 4 — traço e pressão diferentes, possível adulteração póstuma',
          'Cláusula de não-concorrência inserida com fonte tipográfica diferente das demais — possível adição posterior'
        ]
      }
    }
  })

  await createExtraction(doc1b.id, {
    doc_type: 'Termo de Rescisão do Contrato de Trabalho (TRCT)',
    parties: [
      { name: 'João Carlos Silva', role: 'Empregado' },
      { name: 'Metalúrgica Progresso LTDA', role: 'Empregadora' }
    ],
    key_dates: [
      { date: '15/01/2026', description: 'Data da rescisão' },
      { date: '20/01/2026', description: 'Prazo para pagamento das verbas rescisórias' }
    ],
    deadlines: [
      { date: '20/01/2026', description: 'Pagamento das verbas rescisórias (já vencido)', urgency: 'alta' }
    ],
    risk_flags: [
      { description: 'Verbas rescisórias pagas com atraso — incidência de multa do art. 477 CLT', severity: 'alto' }
    ],
    summary: 'TRCT referente à rescisão indireta do vínculo empregatício de João Carlos Silva com a Metalúrgica Progresso LTDA. O documento registra o pagamento das verbas rescisórias em atraso, sujeitando a empregadora à multa prevista no art. 477, §8º da CLT.',
    raw_extraction: {
      doc_type: 'TRCT',
      fraud_risk: { detected: false, confidence: 'baixo', indicators: [] }
    }
  })

  console.log('  🚨 Alerts:')
  await createAlert(FIRM_ID, proj1.id, doc1a.id, 'fraud', '🚨 Possível fraude detectada em "Contrato de Trabalho — João Silva.pdf": Data de admissão inconsistente com data do FGTS; Assinatura divergente entre páginas 2 e 4; Cláusula de não-concorrência inserida com fonte diferente')
  await createAlert(FIRM_ID, proj1.id, doc1a.id, 'risk', '⚠️ Risco alto em "Contrato de Trabalho — João Silva.pdf": Empregado com doença ocupacional sem afastamento — risco de nulidade da rescisão')
  await createAlert(FIRM_ID, proj1.id, doc1a.id, 'deadline', '📅 Prazo urgente em "Contrato de Trabalho — João Silva.pdf": Prazo para ajuizamento da reclamação trabalhista — 15/04/2026')

  // ─── PROJECT 2: Fusão Empresa X + Y ─────────────────────────────────────────
  console.log('\n📁 PROJECT 2: Fusão Empresa X + Y')
  const proj2 = await getOrCreateProject(
    'Fusão Empresa X + Y',
    'M&A',
    'ativo',
    'medio'
  )

  console.log('  📄 Documents:')
  const doc2a = await createDocument('Acordo de Fusão e Reorganização Societária.pdf', FIRM_ID, proj2.id)
  const doc2b = await createDocument('Due Diligence Report — Empresa Y.pdf', FIRM_ID, proj2.id)

  console.log('  🧠 Extractions:')
  await createExtraction(doc2a.id, {
    doc_type: 'Acordo de Fusão e Reorganização Societária',
    parties: [
      { name: 'TechGroup Brasil S.A.', role: 'Empresa Adquirente (Empresa X)' },
      { name: 'Inovação Digital LTDA', role: 'Empresa Adquirida (Empresa Y)' },
      { name: 'Banco BTG Pactual', role: 'Assessor Financeiro' }
    ],
    key_dates: [
      { date: '01/03/2026', description: 'Assinatura do Acordo de Fusão' },
      { date: '30/06/2026', description: 'Data prevista para conclusão da fusão (Closing)' },
      { date: '15/04/2026', description: 'Prazo para aprovação pelo CADE' }
    ],
    deadlines: [
      { date: '15/04/2026', description: 'Submissão ao CADE para aprovação da fusão', urgency: 'alta' },
      { date: '30/04/2026', description: 'Auditoria contábil da Empresa Y — entrega do relatório final', urgency: 'media' },
      { date: '30/06/2026', description: 'Closing da operação', urgency: 'media' }
    ],
    risk_flags: [
      { description: 'Operação sujeita a aprovação prévia do CADE — risco antitruste na área de SaaS B2B', severity: 'medio' },
      { description: 'Passivo trabalhista não provisionado identificado na Empresa Y durante due diligence', severity: 'medio' },
      { description: 'Contrato de earn-out com métricas de EBITDA — risco de litigância futura', severity: 'baixo' }
    ],
    summary: 'Acordo de fusão entre TechGroup Brasil S.A. e Inovação Digital LTDA para reorganização societária via incorporação. A operação avaliada em R$ 45 milhões prevê aprovação regulatória do CADE, earn-out de 24 meses atrelado ao EBITDA, e transferência de todos os ativos e passivos da Empresa Y para a adquirente. Prazo crítico: submissão ao CADE até 15/04/2026.',
    raw_extraction: {
      doc_type: 'Acordo de Fusão',
      fraud_risk: { detected: false, confidence: 'baixo', indicators: [] }
    }
  })

  await createExtraction(doc2b.id, {
    doc_type: 'Relatório de Due Diligence',
    parties: [
      { name: 'Inovação Digital LTDA', role: 'Empresa Auditada' },
      { name: 'TechGroup Brasil S.A.', role: 'Parte Solicitante' }
    ],
    key_dates: [
      { date: '15/02/2026', description: 'Início da due diligence' },
      { date: '30/04/2026', description: 'Entrega do relatório final' }
    ],
    deadlines: [
      { date: '30/04/2026', description: 'Entrega do relatório final de due diligence', urgency: 'media' }
    ],
    risk_flags: [
      { description: 'Passivo trabalhista de R$ 2,3M não provisionado identificado', severity: 'medio' },
      { description: 'Contratos de clientes com cláusulas de change-of-control — risco de rescisão por 3 clientes key', severity: 'medio' }
    ],
    summary: 'Relatório de due diligence jurídica, contábil e operacional da Inovação Digital LTDA. Identificados passivos trabalhistas não provisionados de R$ 2,3M, 3 contratos com cláusula de mudança de controle e pendências fiscais de ICMS. Recomendada retenção de valor em escrow por 18 meses para cobertura de contingências.',
    raw_extraction: {
      doc_type: 'Due Diligence',
      fraud_risk: { detected: false, confidence: 'baixo', indicators: [] }
    }
  })

  console.log('  🚨 Alerts:')
  await createAlert(FIRM_ID, proj2.id, doc2a.id, 'deadline', '📅 Prazo urgente em "Acordo de Fusão": Submissão ao CADE — 15/04/2026')
  await createAlert(FIRM_ID, proj2.id, doc2a.id, 'risk', '⚠️ Risco médio em "Acordo de Fusão": Operação sujeita a aprovação do CADE — risco antitruste')
  await createAlert(FIRM_ID, proj2.id, doc2b.id, 'risk', '⚠️ Risco médio em "Due Diligence": Passivo trabalhista de R$ 2,3M não provisionado identificado')

  // ─── PROJECT 3: Locação Comercial ────────────────────────────────────────────
  console.log('\n📁 PROJECT 3: Locação Comercial — Pátio Paulista')
  const proj3 = await getOrCreateProject(
    'Locação Comercial — Pátio Paulista',
    'Contratos',
    'ativo',
    'baixo'
  )

  console.log('  📄 Documents:')
  const doc3a = await createDocument('Contrato de Locação Comercial — Pátio Paulista.pdf', FIRM_ID, proj3.id)

  console.log('  🧠 Extractions:')
  await createExtraction(doc3a.id, {
    doc_type: 'Contrato de Locação Comercial',
    parties: [
      { name: 'Shopping Pátio Paulista SPE LTDA', role: 'Locador' },
      { name: 'Boutique Elegância LTDA', role: 'Locatário' },
      { name: 'Maria Fernanda Alves', role: 'Fiadora' }
    ],
    key_dates: [
      { date: '01/04/2026', description: 'Início da locação' },
      { date: '31/03/2031', description: 'Término do contrato (5 anos)' },
      { date: '01/04/2027', description: 'Primeiro reajuste pelo IGP-M' }
    ],
    deadlines: [
      { date: '25/03/2026', description: 'Assinatura do contrato e pagamento da caução (3 aluguéis)', urgency: 'alta' },
      { date: '01/04/2026', description: 'Entrega das chaves e início da locação', urgency: 'media' },
      { date: '01/04/2027', description: 'Reajuste anual pelo IGP-M — notificar locador em caso de contestação', urgency: 'baixa' }
    ],
    risk_flags: [
      { description: 'Cláusula de não-concorrência em raio de 500m por 12 meses pós-contrato — avaliar constitucionalidade', severity: 'baixo' },
      { description: 'Reajuste pelo IGP-M historicamente superior ao IPCA — impacto financeiro a monitorar', severity: 'baixo' }
    ],
    summary: 'Contrato de locação comercial de loja no Shopping Pátio Paulista pelo prazo de 5 anos (abril/2026 a março/2031), com aluguel mensal de R$ 28.000 reajustável anualmente pelo IGP-M. Caução de 3 meses (R$ 84.000) a ser depositada até 25/03/2026. Contrato inclui cláusula de exclusividade de segmento no corredor comercial e limitação de sublocação.',
    raw_extraction: {
      doc_type: 'Contrato de Locação Comercial',
      fraud_risk: { detected: false, confidence: 'baixo', indicators: [] }
    }
  })

  console.log('  🚨 Alerts:')
  await createAlert(FIRM_ID, proj3.id, doc3a.id, 'deadline', '📅 Prazo urgente em "Contrato de Locação": Assinatura e pagamento da caução — 25/03/2026')
  await createAlert(FIRM_ID, proj3.id, doc3a.id, 'deadline', '📅 Prazo em "Contrato de Locação": Entrega das chaves e início da locação — 01/04/2026')
  await createAlert(FIRM_ID, proj3.id, doc3a.id, 'risk', '⚠️ Risco baixo em "Contrato de Locação": Cláusula de não-concorrência pós-contrato — avaliar constitucionalidade')

  console.log('\n✅ Demo seed complete!\n')
  console.log('Summary:')
  console.log(`  📁 3 projects created/found`)
  console.log(`  📄 5 documents created`)
  console.log(`  🧠 5 document extractions created`)
  console.log(`  🚨 9 AI alerts created`)
  console.log(`\nFirm: ${FIRM_ID}`)
  console.log(`Login: cristiano@bluz.com.br / Notorious2024!`)
  console.log(`\nApp: https://notorious-ai.vercel.app\n`)
}

main().catch(err => {
  console.error('\n❌ Seed failed:', err.message)
  process.exit(1)
})
