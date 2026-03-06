# TASK: Dashboard Redesign to Match Design Reference

## Context
The current dashboard (`app/dashboard/page.tsx`) was improved but still falls far short of the design quality standard. Cadu provided a gold-standard React component (`DESIGN-REFERENCE.jsx` in this directory) that shows exactly what level of UI quality is expected.

## Objective
Rewrite `app/dashboard/page.tsx` AND `app/dashboard/layout.tsx` (sidebar) to match the design quality, patterns, and visual density of `DESIGN-REFERENCE.jsx`. The result must feel like a Bloomberg Terminal for lawyers — information-dense, visually polished, and executive-grade.

## What to Study First
**READ `DESIGN-REFERENCE.jsx` COMPLETELY.** This is your design bible. Every pattern in it must be adapted to our codebase. Key patterns:

### Color System (use these exact values)
```
bg0: "#08080A", bg1: "#0F0F12", bg2: "#141418", bg3: "#1A1A20"
border1: "#1F1F26", border2: "#252530", border3: "#2D2D3A"
text1: "#F4F4F6", text2: "#A0A0B0", text3: "#606070", text4: "#303040"
amber: "#F0A500", amberHover: "#C88800", amberBg: "#F0A50015", amberBorder: "#F0A50030"
red: "#EF4444", redBg: "#EF444415", redBorder: "#EF444430"
yellow: "#F59E0B", yellowBg: "#F59E0B15", yellowBorder: "#F59E0B30"
blue: "#3B82F6", blueBg: "#3B82F615", blueBorder: "#3B82F630"
green: "#10B981", greenBg: "#10B98115", greenBorder: "#10B98130"
stages: { analise: "#60A5FA", contestacao: "#F59E0B", probatoria: "#A78BFA", sentenca: "#FBBF24", recurso: "#F87171", execucao: "#34D399", encerrado: "#4B5563" }
```

### Typography
- Labels: 9px, uppercase, letter-spacing 0.1em, IBM Plex Mono, color text3
- Numbers: 38px for KPIs, 28px for financial, font-weight 700, colored by context
- Body: 11-12px, Geist font
- Monospace for all data: IBM Plex Mono

### Key Design Patterns from Reference
1. **Collapsible AI Briefing** with amber left border, 3 columns (Ação Imediata / Situação da Carteira / Resultados), collapse button
2. **KPI row** with 5 cards, alert state (red top border + tinted background when value > 0)
3. **Risco Financeiro** horizontal bar with per-client breakdown inline
4. **Pipeline Global** with proportional colored segments + legend
5. **Client grid** (2 columns) with hover state showing pipeline details, urgency badges, pipeline mini-bar, processos count, risco financeiro, taxa de êxito %
6. **Prazos Próximos** column with urgency-colored backgrounds (critical=red, alto=yellow, medio=blue, baixo=gray)
7. **Atividade Recente** as 3-column grid with tipo icons, client dots, timestamps
8. **Sidebar** with NAVEGAÇÃO section (active=amber left border + amber bg), CLIENTES section below with urgency badges, user profile at bottom
9. **Top bar** with pulsing red alert for "prazos vencendo hoje" + action buttons
10. **Animations**: fadeUp staggered per section (.f1, .f2, .f3, .f4)

## Files to Modify
1. `app/dashboard/page.tsx` — the main Painel de Controle (COMPLETE REWRITE of the JSX return)
2. `app/dashboard/layout.tsx` — the sidebar (must include CLIENTES section with urgency badges + user profile)

## Files NOT to Modify
- `lib/` — do not touch any lib files
- `app/api/` — do not touch API routes
- `middleware.ts` — do not touch
- Do NOT add new npm dependencies

## Technical Constraints
- Use inline styles (project convention) — same as the reference
- You CAN add a `<style>` tag for hover states and animations (same as reference does)
- Keep ALL existing data fetching logic (useEffect, Supabase queries)
- Keep ALL existing imports and TypeScript types
- The reference uses hardcoded data — our app fetches from Supabase. Adapt the visual patterns to use our real data.
- Build must pass: `npx next build`
- Fix the "Dr. Dr" greeting bug: if userName starts with "Dr", don't add another "Dr." prefix

## Sidebar Enhancement (layout.tsx)
The current sidebar only has navigation links. Add:
1. CLIENTES section below nav links (fetch clients list)
2. Each client shows: initials avatar (colored) + name + urgency count badge (red circle)
3. User profile at bottom: initials circle + name + "Admin" + "⋯" menu icon
4. Active nav item: amber left border + amber tinted background (like reference)
5. Firm name under logo: small, muted, IBM Plex Mono

## Definition of Done
- [ ] Dashboard matches the visual density and quality of DESIGN-REFERENCE.jsx
- [ ] Sidebar has NAVEGAÇÃO + CLIENTES sections + user profile
- [ ] AI Briefing card is collapsible with 3 columns
- [ ] KPI cards have alert states (red top bar when value > 0)
- [ ] Client grid shows pipeline bars, risk, êxito %, urgency badges, hover detail
- [ ] Prazos Próximos has urgency-colored backgrounds
- [ ] Atividade Recente is a rich grid (not a simple list)
- [ ] Risco Financeiro horizontal bar with per-client breakdown
- [ ] Pipeline Global with proportional colored segments
- [ ] Top bar with alert pill + action buttons
- [ ] Animations (fadeUp staggered)
- [ ] "Dr. Dr" greeting bug fixed
- [ ] `npx next build` passes with zero errors
- [ ] Changes committed and pushed to main

## After Implementation
Run: `npx next build`
Fix ANY TypeScript errors.
Then: `git add -A && git commit -m "feat: executive cockpit redesign — matching gold standard reference" && git push origin main`
