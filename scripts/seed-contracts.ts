// Seed demo contracts for B/Luz account
// Run: npx tsx scripts/seed-contracts.ts

const SUPABASE_URL = 'https://fbgqzouxbagmmlzibyhl.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZiZ3F6b3V4YmFnbW1semlieWhsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjQ3NjE1MSwiZXhwIjoyMDg4MDUyMTUxfQ.p_SD9mQxanP0VHQqpm0NCqbRiuHk1MPGr-1dAAZqp2s'
const FIRM_ID = '1f430c10-550a-4267-9193-e03c831fc394'
const USER_ID = '9a2fc5c2-100f-469b-bfb6-fdbc64bfa9f5'

const headers = {
  'apikey': SERVICE_KEY,
  'Authorization': `Bearer ${SERVICE_KEY}`,
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

async function getOrCreateContract(name: string, data: object): Promise<{ id: string; name: string; isNew: boolean }> {
  const existing = await supabaseGet('contracts', `name=eq.${encodeURIComponent(name)}&firm_id=eq.${FIRM_ID}&select=id,name`)
  if (Array.isArray(existing) && existing.length > 0) {
    console.log(`  ↩  Contract already exists: "${name}" (${existing[0].id})`)
    return { ...existing[0], isNew: false }
  }
  const contract = await supabaseInsert('contracts', { ...data, name, firm_id: FIRM_ID, created_by: USER_ID })
  console.log(`  ✓  Created contract: "${name}" (${contract.id})`)
  return { ...contract, isNew: true }
}

async function createExtraction(contract_id: string, data: object) {
  const ext = await supabaseInsert('contract_extractions', { contract_id, ...data })
  console.log(`    ✓ Extraction created`)
  return ext
}

async function createAlert(contract_id: string, type: string, message: string, alert_date?: string) {
  const alert = await supabaseInsert('contract_alerts', {
    firm_id: FIRM_ID, contract_id, type, message,
    alert_date: alert_date || new Date().toISOString().split('T')[0],
    is_read: false
  })
  console.log(`    ✓ Alert [${type}]: ${message.substring(0, 80)}...`)
  return alert
}

async function main() {
  console.log('\n🌱 Seeding demo contracts for B/Luz\n')
  console.log(`Firm ID: ${FIRM_ID}\n`)

  // ─── CONTRACT 1: Prestacao de Servicos ───────────────────────────────────────
  console.log('📄 CONTRACT 1: Prestacao de Servicos — Cliente ABC Ltda')
  const c1 = await getOrCreateContract('Contrato de Prestacao de Servicos - Cliente ABC Ltda', {
    contract_type: 'Prestacao de Servicos',
    status: 'vigente',
    value: 180000,
    currency: 'BRL',
    start_date: '2025-01-01',
    end_date: '2027-01-01',
    auto_renew: false,
    renewal_notice_days: 60,
    responsible_lawyer: 'Dr. Cristiano Gimenez',
    parties: [
      { name: 'B/Luz Advogados', role: 'contratado' },
      { name: 'ABC Ltda', role: 'contratante' }
    ]
  })

  if (c1.isNew) {
    await createExtraction(c1.id, {
      summary: 'Contrato de prestação de serviços jurídicos firmado entre B/Luz Advogados (contratado) e ABC Ltda (contratante), com vigência de 2 anos a partir de janeiro de 2025. Abrange assessoria jurídica empresarial, consultoria contratual e representação em disputas. O valor total dos honorários é de R$ 180.000,00 (cento e oitenta mil reais), pagáveis mensalmente. O contrato prevê cláusulas de confidencialidade, sigilo profissional e exclusividade de representação no setor de telecomunicações.',
      key_obligations: [
        'B/Luz Advogados compromete-se a prestar assessoria jurídica empresarial e consultoria contratual durante toda a vigência',
        'ABC Ltda obriga-se ao pagamento mensal dos honorários no valor de R$ 15.000,00, até o 5º dia útil de cada mês',
        'As partes devem manter sigilo absoluto sobre informações confidenciais compartilhadas durante a prestação dos serviços'
      ],
      penalties: [
        'Multa de 20% sobre o valor total do contrato em caso de rescisão antecipada sem justa causa',
        'Juros de mora de 1% ao mês sobre valores em atraso, mais correção monetária pelo IGPM'
      ],
      termination_clauses: [
        'Rescisão por qualquer das partes mediante aviso prévio de 60 dias',
        'Rescisão imediata em caso de descumprimento grave de obrigações contratuais'
      ],
      confidentiality: true,
      non_compete: false,
      governing_law: 'Legislação brasileira, em especial o Código Civil e o Estatuto da OAB',
      dispute_resolution: 'Foro da Comarca de São Paulo, com preferência para mediação prévia',
      risk_level: 'baixo',
      risk_flags: [
        { description: 'Cláusula de exclusividade pode limitar atuação do escritório em casos similares', severity: 'baixo' }
      ],
      fraud_risk: { detected: false, confidence: 'baixo', indicators: [] }
    })
  }

  // ─── CONTRACT 2: NDA ──────────────────────────────────────────────────────────
  console.log('\n📄 CONTRACT 2: NDA — Projeto Fusao XYZ')
  const c2 = await getOrCreateContract('NDA - Projeto Fusao XYZ', {
    contract_type: 'NDA',
    status: 'vigente',
    value: null,
    currency: 'BRL',
    start_date: '2025-06-01',
    end_date: '2026-03-20',
    auto_renew: false,
    renewal_notice_days: 30,
    responsible_lawyer: 'Dra. Ana Lima',
    parties: [
      { name: 'B/Luz Advogados', role: 'interveniente' },
      { name: 'Empresa XYZ S.A.', role: 'contratante' },
      { name: 'Grupo Alpha', role: 'contratado' }
    ]
  })

  if (c2.isNew) {
    await createExtraction(c2.id, {
      summary: 'Acordo de Não-Divulgação (NDA) relativo ao Projeto Fusão XYZ, firmado entre Empresa XYZ S.A., Grupo Alpha e B/Luz Advogados como interveniente. Vigência de junho de 2025 a março de 2026. O acordo proíbe a divulgação de informações estratégicas, financeiras e operacionais relacionadas à potencial fusão entre as empresas. Inclui cláusula de não-concorrência por 12 meses após o término e obrigação de devolução ou destruição de todos os documentos confidenciais ao fim da vigência.',
      key_obligations: [
        'Manutenção absoluta de sigilo sobre informações financeiras, operacionais e estratégicas relacionadas ao Projeto Fusão XYZ',
        'Proibição de uso das informações para qualquer finalidade além da avaliação da potencial fusão',
        'Devolução ou destruição certificada de todos os documentos e dados confidenciais ao término do acordo'
      ],
      penalties: [
        'Multa de R$ 5.000.000,00 (cinco milhões de reais) por violação comprovada do sigilo',
        'Indenização por perdas e danos adicionais comprovados'
      ],
      termination_clauses: [
        'Término automático em 20/03/2026 ou na conclusão/abandono definitivo do projeto de fusão',
        'Rescisão por mútuo acordo mediante notificação formal'
      ],
      confidentiality: true,
      non_compete: true,
      governing_law: 'Lei Brasileira, Código Civil',
      dispute_resolution: 'Câmara de Arbitragem FIESP — São Paulo/SP',
      risk_level: 'medio',
      risk_flags: [
        { description: 'Contrato vence em 17 dias — necessidade de renovação ou confirmação de encerramento do projeto', severity: 'alto' },
        { description: 'Cláusula de não-concorrência por 12 meses pode restringir atuação do escritório em M&A', severity: 'medio' }
      ],
      fraud_risk: { detected: false, confidence: 'baixo', indicators: [] }
    })
    await createAlert(c2.id, 'vencimento', '⏰ Atencao: NDA vence em 17 dias - Projeto Fusao XYZ', '2026-03-20')
  }

  // ─── CONTRACT 3: Locacao Comercial ────────────────────────────────────────────
  console.log('\n📄 CONTRACT 3: Locacao Comercial — Av. Paulista 1000')
  const c3 = await getOrCreateContract('Locacao Comercial - Av. Paulista 1000', {
    contract_type: 'Locacao',
    status: 'vigente',
    value: 45000,
    currency: 'BRL',
    start_date: '2023-03-01',
    end_date: '2026-03-05',
    auto_renew: true,
    renewal_notice_days: 90,
    responsible_lawyer: 'Dr. Cristiano Gimenez',
    parties: [
      { name: 'B/Luz Advogados', role: 'contratante' },
      { name: 'Imobiliaria Paulista Ltda', role: 'contratado' }
    ]
  })

  if (c3.isNew) {
    await createExtraction(c3.id, {
      summary: 'Contrato de locação comercial do escritório sede localizado na Av. Paulista, 1000, São Paulo/SP. Firmado entre B/Luz Advogados (locatário) e Imobiliária Paulista Ltda (locador), com vigência de 3 anos a partir de março de 2023. Aluguel mensal de R$ 45.000,00 com reajuste anual pelo IGP-M. O contrato possui cláusula de renovação automática caso nenhuma das partes manifeste intenção de não renovar com antecedência de 90 dias. Urgente: vencimento em 2 dias, decisão sobre renovação necessária.',
      key_obligations: [
        'B/Luz Advogados obriga-se ao pagamento do aluguel mensal de R$ 45.000,00, até o 5º dia útil de cada mês',
        'Manutenção do imóvel em condições adequadas de uso e devolução nas mesmas condições recebidas',
        'Notificação com 90 dias de antecedência caso não haja interesse na renovação automática'
      ],
      penalties: [
        'Multa equivalente a 3 (três) aluguéis em caso de devolução antecipada do imóvel',
        'Juros de mora de 2% ao mês sobre aluguéis em atraso, acrescido de multa de 10%'
      ],
      termination_clauses: [
        'Renovação automática por prazo indeterminado salvo notificação contrária com 90 dias de antecedência',
        'Rescisão por infração contratual mediante notificação formal com prazo de cura de 30 dias'
      ],
      confidentiality: false,
      non_compete: false,
      governing_law: 'Lei 8.245/91 (Lei do Inquilinato)',
      dispute_resolution: 'Foro da Comarca de São Paulo/SP',
      risk_level: 'alto',
      risk_flags: [
        { description: 'URGENTE: Contrato vence em 2 dias — sem manifestação, renovação automática será acionada', severity: 'alto' },
        { description: 'Reajuste pelo IGP-M pode gerar aumento significativo no próximo período', severity: 'medio' }
      ],
      fraud_risk: { detected: false, confidence: 'baixo', indicators: [] }
    })
    await createAlert(c3.id, 'vencimento', '🚨 URGENTE: Contrato de locacao vence em 2 dias - decidir sobre renovacao', '2026-03-05')
  }

  // ─── CONTRACT 4: Honorarios Petrobras ─────────────────────────────────────────
  console.log('\n📄 CONTRACT 4: Acordo de Honorarios — Caso Petrobras')
  const c4 = await getOrCreateContract('Acordo de Honorarios - Caso Petrobras', {
    contract_type: 'Prestacao de Servicos',
    status: 'aguardando_assinatura',
    value: 850000,
    currency: 'BRL',
    start_date: '2026-03-01',
    end_date: '2027-03-01',
    auto_renew: false,
    renewal_notice_days: 60,
    responsible_lawyer: 'Dr. Cristiano Gimenez',
    parties: [
      { name: 'B/Luz Advogados', role: 'contratado' },
      { name: 'Petrobras S.A.', role: 'contratante' }
    ]
  })

  if (c4.isNew) {
    await createExtraction(c4.id, {
      summary: 'Acordo de honorários para representação jurídica da Petrobras S.A. no Caso Petrobras, envolvendo litígio de alta complexidade perante o Superior Tribunal de Justiça. O valor total dos honorários é de R$ 850.000,00, estruturado em parcela fixa mensal de R$ 50.000,00 e êxito de 10% sobre o valor da causa. Contrato em fase de revisão final pela assessoria jurídica da Petrobras, aguardando assinatura das partes. Inclui cláusula de reajuste pelo IPCA e previsão de despesas adicionais reembolsáveis.',
      key_obligations: [
        'B/Luz Advogados compromete-se a representar a Petrobras em todas as instâncias relacionadas ao caso, incluindo STJ',
        'Petrobras S.A. obriga-se ao pagamento mensal de R$ 50.000,00 e honorários de êxito de 10% sobre o valor da causa',
        'Relatórios mensais de andamento processual e estratégia jurídica'
      ],
      penalties: [
        'Em caso de desistência injustificada pela Petrobras, pagamento integral dos honorários contratados',
        'Multa de 15% sobre os honorários mensais em caso de atraso no pagamento superior a 15 dias'
      ],
      termination_clauses: [
        'Rescisão pelo cliente mediante aviso prévio de 30 dias e pagamento dos honorários devidos até a data',
        'Rescisão pelo escritório em caso de conflito de interesses superveniente ou descumprimento de obrigações financeiras'
      ],
      confidentiality: true,
      non_compete: false,
      governing_law: 'Código Civil Brasileiro e Estatuto da OAB',
      dispute_resolution: 'Câmara de Mediação e Arbitragem de São Paulo (CAMASP)',
      risk_level: 'medio',
      risk_flags: [
        { description: 'Contrato de alto valor aguardando assinatura — risco de não concretização', severity: 'medio' },
        { description: 'Honorários de êxito atrelados ao resultado — exposição ao risco de derrota', severity: 'baixo' }
      ],
      fraud_risk: { detected: false, confidence: 'baixo', indicators: [] }
    })
  }

  // ─── CONTRACT 5: Alteracao Contrato Social ────────────────────────────────────
  console.log('\n📄 CONTRACT 5: Alteracao Contrato Social — DEF Participacoes')
  const c5 = await getOrCreateContract('Alteracao Contrato Social - DEF Participacoes', {
    contract_type: 'Societario',
    status: 'vigente',
    value: 2500000,
    currency: 'BRL',
    start_date: '2024-01-01',
    end_date: null,
    auto_renew: false,
    renewal_notice_days: 30,
    responsible_lawyer: 'Dr. Cristiano Gimenez',
    parties: [
      { name: 'DEF Participacoes S.A.', role: 'contratante' },
      { name: 'B/Luz Advogados', role: 'interveniente' }
    ]
  })

  if (c5.isNew) {
    await createExtraction(c5.id, {
      summary: 'Instrumento de Alteração de Contrato Social da DEF Participações S.A., registrado na JUCESP em 15/01/2024. O instrumento formaliza a entrada de novos sócios, alteração do capital social para R$ 2.500.000,00 e reestruturação do quadro de administração. B/Luz Advogados atua como interveniente e responsável pela formalização jurídica. ATENÇÃO: A análise do documento identificou inconsistências graves entre as datas e assinaturas que podem indicar adulteração posterior ao registro original.',
      key_obligations: [
        'DEF Participações S.A. deve comunicar ao escritório qualquer alteração societária subsequente dentro de 30 dias',
        'B/Luz Advogados responsabiliza-se pela assessoria jurídica nas alterações e representação perante a JUCESP',
        'Atualização obrigatória do Livro de Registro de Sócios e demais registros corporativos'
      ],
      penalties: [
        'Responsabilidade solidária dos sócios administradores por irregularidades formais não comunicadas ao escritório'
      ],
      termination_clauses: [
        'O instrumento é definitivo após o registro na JUCESP e não admite rescisão, apenas novas alterações'
      ],
      confidentiality: true,
      non_compete: false,
      governing_law: 'Lei das Sociedades Anônimas (Lei 6.404/76) e Código Civil',
      dispute_resolution: 'Foro da Comarca de São Paulo, Capital',
      risk_level: 'alto',
      risk_flags: [
        { description: 'Inconsistência de datas entre cláusula 3.1 e Anexo B — possível adulteração do documento', severity: 'alto' },
        { description: 'Assinatura na página 4 diverge do padrão das demais páginas — suspeita de adulteração', severity: 'alto' },
        { description: 'Capital social aumentado sem evidência de integralização documentada', severity: 'medio' }
      ],
      fraud_risk: {
        detected: true,
        confidence: 'alto',
        indicators: [
          'Datas inconsistentes entre clausula 3.1 e Anexo B — data de aprovação anterior à data de convocação',
          'Assinatura da pagina 4 diverge do padrao das demais paginas — traço e pressão diferentes, provável adulteração póstuma',
          'Numeração de CNPJ do novo sócio apresenta formato inválido na cláusula 5.2'
        ]
      }
    })
    await createAlert(c5.id, 'fraude', '🚨 Risco de fraude detectado: Datas inconsistentes entre clausula 3.1 e Anexo B', new Date().toISOString().split('T')[0])
  }

  console.log('\n✅ Contracts seed complete!\n')
  console.log('Summary:')
  console.log(`  📄 5 contracts seeded (idempotent)`)
  console.log(`  🧠 5 contract extractions`)
  console.log(`  🚨 Alerts for NDA, Locacao, and DEF Participacoes`)
  console.log(`\nFirm: ${FIRM_ID}`)
  console.log(`Login: cristiano@bluz.com.br / Notorious2024!`)
  console.log(`\nApp: https://notorious-ai.vercel.app/dashboard/contratos\n`)
  console.log('NOTE: If tables do not exist, apply supabase/migrations/002_contracts.sql')
  console.log('      in Supabase Dashboard SQL Editor first, then re-run this script.\n')
}

main().catch(err => {
  console.error('\n❌ Seed failed:', err.message)
  if (err.message.includes('relation "public.contracts" does not exist') || err.message.includes('42P01')) {
    console.error('\n⚠️  Tables not found. Please apply supabase/migrations/002_contracts.sql in:')
    console.error('    https://supabase.com/dashboard/project/fbgqzouxbagmmlzibyhl/sql/new')
  }
  process.exit(1)
})
