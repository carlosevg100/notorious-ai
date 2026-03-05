# Litigator AI — Full Architecture & Design Specification

## Product Vision
"O Sistema Operacional do Advogado Brasileiro" — AI-powered legal OS for Brazilian law firms.
NOT a generic SaaS. NOT a personal injury tool. This is a professional enterprise platform for law firm operations.

## Design System (MANDATORY — follow exactly)

### Color Palette
- **Background primary:** #08080A (near-black, hedge fund aesthetic)
- **Background secondary:** #111113
- **Background card:** #18181B
- **Background input:** #1E1E22
- **Accent/Gold:** #F0A500 (amber — used for buttons, highlights, active states, branding)
- **Accent hover:** #D4940A
- **Text primary:** #FAFAFA
- **Text secondary:** #A1A1AA
- **Text muted:** #71717A
- **Border:** #27272A
- **Border subtle:** #1E1E22
- **Success:** #22C55E
- **Warning:** #F59E0B
- **Error:** #EF4444
- **Info:** #3B82F6

### Light Mode (toggle)
- Background primary: #FFFFFF
- Background secondary: #F4F4F5
- Background card: #FFFFFF
- Text primary: #18181B
- Text secondary: #52525B
- Accent/Gold: #D4940A (slightly darker for contrast)
- Use CSS variables for all colors — toggle changes the variables

### Typography
- **Primary font:** Geist (sans-serif)
- **Mono font:** IBM Plex Mono (for legal references, case numbers, code-like data)
- **Headings:** Geist, semibold/bold
- **Body:** Geist, regular, 14px base
- **Data/numbers:** IBM Plex Mono

### Design Language
- **Aesthetic:** Dark hedge fund / Bloomberg terminal meets modern legal tech
- **Corners:** rounded-lg (8px) for cards, rounded-md (6px) for inputs/buttons
- **Shadows:** minimal — rely on borders and background contrast
- **Icons:** Lucide React — consistent, thin stroke
- **Spacing:** generous — this is a professional tool, not cramped
- **No brain icons, no emoji in UI, no playful elements**
- **No Google login — this is firm-issued access, email/password only**
- **No "Sign up" — accounts are provisioned by firm admin**

## Architecture

### Stack
- Next.js 14+ App Router
- TailwindCSS v4 with CSS custom properties
- TypeScript strict
- Supabase (Auth + DB + Storage + Realtime)
- OpenAI GPT-4o (extraction + chat)
- Vercel deployment

### 3 Main Screens

#### 1. Dashboard Global (/dashboard)
The command center. Lawyer opens this every morning.
- Stats cards: Processos Ativos, Docs Pendentes, Prazos Esta Semana, Prazos Vencidos
- Pipeline de Processos: horizontal bar showing count per phase (Análise → Contestação → Recurso → Execução → Encerrado)
- Prazos Próximos: table with deadline, description, process link, dias úteis badge (color-coded: red <3, amber <7, green >7)
- Atividade Recente: last 5 documents processed, last 3 peças generated

#### 2. Dashboard Cliente (/dashboard/clients and /dashboard/clients/[id])
- Client list: cards or table with name, CNPJ, process count, next deadline
- Client detail: header with client info + list of all processos for this client
- **+Cliente modal:** simple form (name, CNPJ, email, type: PF/PJ)

#### 3. Processo Individual (/dashboard/projects/[id])
The main workspace. 5-tab hub:
- **Documentos:** drag-and-drop upload zone, document list with processing status (realtime), file name, size, status badge
- **Análise:** structured extraction display — resumo executivo, partes, causa de pedir, pedidos, teses jurídicas, risco (color-coded badge), tutela antecipada, valor da causa
- **Prazos:** table of deadlines, +Prazo form, dias úteis calculation (CPC art. 219), status badges
- **Peças:** generate Contestação / Recurso / Petição via AI, version history, full-text modal viewer
- **Chat:** AI chat contextualizado nos documentos do processo, message history, GPT-4o

### Creation Flows
- **+Cliente:** modal with name, CNPJ, email, type fields
- **+Processo:** 4-step wizard
  1. Select client (or create new)
  2. Process details (name, numero_processo, tipo, vara, comarca)
  3. Upload initial documents
  4. AI extraction runs automatically → redirect to processo hub

### Navigation
- Left sidebar: Logo "Litigator AI" (text, gold accent, no icon), Dashboard, Clientes, Prazos, Peças
- Bottom of sidebar: Modo Claro/Escuro toggle, Sair (logout)
- Sidebar width: 240px, collapsible on mobile

### Auth
- Email/password ONLY (Supabase Auth)
- No Google login, no social auth
- No sign-up link — firm admin creates accounts
- Middleware redirects: unauthenticated → /login, authenticated /login → /dashboard

### Database
Use existing Supabase tables: firms, clients, projects, documents, prazos, pecas, chat_messages
- firm_id on all tables for multi-tenancy
- FIRM_ID constant: 1f430c10-550a-4267-9193-e03c831fc394

### AI Pipeline
1. Upload → Supabase Storage
2. POST /api/upload creates document record (status: pending)
3. Triggers Edge Function or inline extraction
4. OpenAI extracts structured data (ExtractedData type)
5. Supabase Realtime updates UI status

### All text in Portuguese BR
- Navigation, labels, buttons, placeholders, error messages — everything PT-BR
- Legal terminology must be correct (CPC references, etc.)

## What NOT to do
- No purple anywhere
- No brain/AI icons in the UI
- No Google/social login
- No sign-up flow
- No English text
- No playful/startup aesthetic
- No generic SaaS template look
- No "Personal Injury" or any American legal references
