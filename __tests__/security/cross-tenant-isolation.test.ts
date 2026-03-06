/**
 * Cross-tenant isolation tests — Litigator AI Security Sprint
 *
 * These tests verify that no authenticated user can access another firm's data
 * by supplying a different firm_id in the request body.
 *
 * Pattern: User from FIRM_A sends a request with FIRM_B's firm_id in the body.
 * Expected result: routes must use FIRM_A's firm_id (from JWT), ignoring the body value.
 *
 * NOTE: These are integration tests — they require a live Supabase instance.
 * Run with: npx jest __tests__/security/ --testTimeout=15000
 *
 * For CI without live DB, the mock tests below validate the helper logic.
 */

import { NextRequest } from 'next/server'

// ─── Mock Supabase for unit testing ────────────────────────────────────────
const FIRM_A = 'aaaaaaaa-0000-0000-0000-aaaaaaaaaaaa'
const FIRM_B = 'bbbbbbbb-0000-0000-0000-bbbbbbbbbbbb'
const USER_A_ID = 'user-a-000000000000'
const USER_A_TOKEN = 'mock-token-user-a'

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getUser: jest.fn((token: string) => {
        if (token === USER_A_TOKEN) {
          return { data: { user: { id: USER_A_ID } }, error: null }
        }
        return { data: { user: null }, error: new Error('invalid token') }
      }),
    },
    from: jest.fn((table: string) => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(() => {
        if (table === 'users') {
          return { data: { firm_id: FIRM_A, role: 'admin' }, error: null }
        }
        return { data: null, error: null }
      }),
    })),
  })),
}))

// ─── Helper import after mock ───────────────────────────────────────────────
import { getAuthenticatedFirmId, isAuthError } from '@/lib/get-firm-id'

function makeRequest(token: string | null, body?: Record<string, unknown>): NextRequest {
  const req = new NextRequest('http://localhost/api/test', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  return req
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('getAuthenticatedFirmId — Security Helper', () => {
  it('returns FIRM_A when valid token for user-a is supplied', async () => {
    const req = makeRequest(USER_A_TOKEN)
    const result = await getAuthenticatedFirmId(req)
    expect(isAuthError(result)).toBe(false)
    if (!isAuthError(result)) {
      expect(result.firm_id).toBe(FIRM_A)
      expect(result.user_id).toBe(USER_A_ID)
    }
  })

  it('returns 401 when no Authorization header is supplied', async () => {
    const req = makeRequest(null)
    const result = await getAuthenticatedFirmId(req)
    expect(isAuthError(result)).toBe(true)
    if (isAuthError(result)) {
      expect(result.status).toBe(401)
    }
  })

  it('returns 401 when invalid/expired token is supplied', async () => {
    const req = makeRequest('invalid-token-xyz')
    const result = await getAuthenticatedFirmId(req)
    expect(isAuthError(result)).toBe(true)
    if (isAuthError(result)) {
      expect(result.status).toBe(401)
    }
  })
})

describe('Cross-tenant isolation — firm_id in body is ignored', () => {
  it('ignores firm_id in request body — uses JWT firm_id instead', async () => {
    // Attack: user from FIRM_A sends FIRM_B in body to access Firm B data
    const req = makeRequest(USER_A_TOKEN, { firm_id: FIRM_B, project_id: 'some-project' })
    const result = await getAuthenticatedFirmId(req)
    expect(isAuthError(result)).toBe(false)
    if (!isAuthError(result)) {
      // Must return FIRM_A from JWT, NOT FIRM_B from body
      expect(result.firm_id).toBe(FIRM_A)
      expect(result.firm_id).not.toBe(FIRM_B)
    }
  })

  it('ignores firm_id in query string — uses JWT firm_id instead', async () => {
    const req = new NextRequest(
      `http://localhost/api/test?firm_id=${FIRM_B}`,
      { method: 'GET', headers: { Authorization: `Bearer ${USER_A_TOKEN}` } }
    )
    const result = await getAuthenticatedFirmId(req)
    expect(isAuthError(result)).toBe(false)
    if (!isAuthError(result)) {
      expect(result.firm_id).toBe(FIRM_A)
      expect(result.firm_id).not.toBe(FIRM_B)
    }
  })
})

describe('Route-level isolation evidence', () => {
  const VULNERABLE_ROUTES = [
    'analyze-case',
    'research',
    'strategy',
    'strategy/save',
    'pecas',
    'upload',
    'upload-documents',
    'invitations',
  ]

  it('all 8 formerly vulnerable routes now import getAuthenticatedFirmId', () => {
    const fs = require('fs')
    const path = require('path')

    for (const route of VULNERABLE_ROUTES) {
      const routePath = path.join(process.cwd(), 'app', 'api', route, 'route.ts')
      const content = fs.readFileSync(routePath, 'utf-8')
      expect(content).toContain('getAuthenticatedFirmId')
      expect(content).toContain('isAuthError')
    }
  })

  it('no route uses req.body.firm_id or formData firm_id for authorization', () => {
    const fs = require('fs')
    const path = require('path')

    for (const route of VULNERABLE_ROUTES) {
      const routePath = path.join(process.cwd(), 'app', 'api', route, 'route.ts')
      const content = fs.readFileSync(routePath, 'utf-8')
      // firm_id must NOT be destructured from body for auth purposes
      // Allowed patterns: firm_id = auth.firm_id
      // Disallowed patterns: const { firm_id } = body (or formData.get('firm_id') for auth)
      const bodyDestructure = /const\s*\{[^}]*firm_id[^}]*\}\s*=\s*body/.test(content)
      const formDataFirmId = /formData\.get\(['"]firm_id['"]\)/.test(content)
      expect(bodyDestructure).toBe(false)
      expect(formDataFirmId).toBe(false)
    }
  })
})
