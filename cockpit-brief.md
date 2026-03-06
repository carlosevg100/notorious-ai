# Litigator AI — Client Dashboard Cockpit Redesign

## Reference Design
See the uploaded image. Key elements to implement:

## Design Language (apply to client detail page AND main dashboard "Painel de Controle")

### Color Scheme
- Background: #08080A (near-black)
- Card background: rgba(255,255,255,0.03) with subtle border rgba(255,255,255,0.06)
- Accent: #F0A500 (amber/gold) for brand, links, active states
- Text primary: #FFFFFF
- Text secondary/muted: #71717A
- Labels: uppercase, 11px, letter-spacing 0.05em, #71717A
- Numbers: large (28-36px), font-mono, bold
- Red: #EF4444 (urgency, vencidos, alto risco)
- Yellow/Amber: #F59E0B (warnings, médio risco)
- Green: #22C55E (success, baixo risco)

### Client Detail Page (`app/dashboard/clients/[id]/page.tsx`)

#### Header Section
- Client initials avatar (2-letter, circular, amber background, black text)
- Client name (22px bold) + status badge (ATIVO — green pill)
- CNPJ · Advogado responsável · "desde [date]"
- Top bar breadcrumb: Clientes / [Client Name]
- Top right: urgency count badge (red pill), "Exportar Relatório" button, "+ Novo Processo" button (amber)

#### Tabs
- Overview | Processos | Alertas [count] | Atividade
- Underline style, amber when active

#### Overview Tab — Card Grid Layout
Row 1 (5 cards, equal width):
- PROCESSOS ATIVOS (large number)
- PRAZOS HOJE (green number)  
- PRAZOS NA SEMANA (amber number)
- URGÊNCIAS (red number)
- TAXA DE ÊXITO (green percentage) — calculate from encerrado projects

Row 2 (3 cards):
- VALOR TOTAL DAS CAUSAS — R$ formatted, subtitle "soma dos valores de causa"
- RISCO FINANCEIRO ESTIMADO — R$ formatted, amber, subtitle "estimativa AI de exposição real"
- CONDENAÇÕES ACUMULADAS — R$ formatted, red, subtitle "processos encerrados desfavoráveis"

Row 3 (3 cards):
- PIPELINE — stacked horizontal colored bar + list with colored dots and bar widths per fase
- DISTRIBUIÇÃO DE RISCO — horizontal colored bar + numbers: Alto (red) Médio (amber) Baixo (green)
- ATIVIDADE RECENTE — list with colored dots + timestamps (12 min, 1h, 2h, 4h, 6h format)

Row 4 (optional):
- POR COMARCA — list of comarcas with process counts

### Main Dashboard ("Painel de Controle" — `app/dashboard/page.tsx`)
Apply same card style, colors, and typography. Keep the existing greeting but style the cards to match the cockpit design.

## Technical Notes
- All changes in: app/dashboard/clients/[id]/page.tsx and app/dashboard/page.tsx
- Keep existing data fetching logic, just reshape the JSX/styles
- Use inline styles (project convention — no Tailwind classes)
- Keep all existing imports and types
- Financial values (valor_causa) come from projects table or extracted_data — use 0 if not available
- "Taxa de Êxito" = encerrado favoráveis / total encerrados (show "—" if no encerrado)
- The app uses CSS variables: --bg-primary, --bg-card, --bg-input, --border, --accent, --text-primary, --text-secondary, --text-muted, --error, --warning, --info
- Make sure it builds clean with `npx next build`
- After done, commit and push to main (auto-deploys to Vercel)

## IMPORTANT
- Do NOT change any data fetching logic or API calls
- Do NOT modify lib/ files
- Do NOT add new dependencies
- Build MUST pass clean
- Commit message: "feat: cockpit-style client dashboard + painel de controle redesign"
