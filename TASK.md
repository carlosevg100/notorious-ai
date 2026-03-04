# TASK: Notorious AI V4 — Full Rebuild

Read REBUILD_BRIEF.md completely before touching any code.

## Summary
Rebuild Notorious AI from scratch with correct architecture. The current v3 is broken — PDF extraction hangs because it uses Vercel serverless (10s timeout). 

The new architecture:
- Upload files DIRECTLY to Supabase Storage (not through Vercel)
- Process via Supabase Edge Functions (no timeout issues)  
- Show real-time status updates via Supabase Realtime

## Your job
1. Read REBUILD_BRIEF.md fully
2. Apply the new Supabase schema (SQL in the brief) via Supabase Management API or direct SQL
3. Rebuild all Next.js pages and API routes per the spec
4. Create supabase/functions/process-document/index.ts (exact code in brief)
5. Deploy Edge Function via Supabase CLI
6. Build must pass: npm run build (zero TypeScript errors)
7. Push to GitHub — Vercel auto-deploys
8. Verify the app is live at https://notorious-ai.vercel.app

## Credentials
All in REBUILD_BRIEF.md — GitHub token, Vercel token, Supabase keys, OpenAI key.

## Git config
git config user.email "carlosevg100@gmail.com"
git config user.name "Mr. Musk (Notorious AI CTO)"

Use the GitHub token for push:
git remote set-url origin https://carlosevg100:[REDACTED_GITHUB_TOKEN]@github.com/carlosevg100/notorious-ai.git

## Done criteria
- npm run build passes
- Login works (cristiano@bluz.com.br / Notorious2024!)
- Upload PDF → processing status updates in real-time (Supabase Realtime)
- Extracted data shows in Análise tab
- Deployed and live

## When done
Run: openclaw system event --text "Mr. Musk done: Notorious AI v4 deployed — extraction bulletproof via Edge Functions. Commit: $(git rev-parse --short HEAD)" --mode now
