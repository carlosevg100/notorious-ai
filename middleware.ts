import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })
  const { data: { session } } = await supabase.auth.getSession()

  const isAuth = !!session
  const isLoginPage = req.nextUrl.pathname === '/login'
  const isDashboard = req.nextUrl.pathname.startsWith('/dashboard')
  const isApi = req.nextUrl.pathname.startsWith('/api')

  if (!isAuth && isDashboard) {
    return NextResponse.redirect(new URL('/login', req.url))
  }
  if (isAuth && isLoginPage) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  return res
}

export const config = {
  matcher: ['/dashboard/:path*', '/login', '/api/projects/:path*', '/api/documents/:path*', '/api/chat/:path*', '/api/drafts/:path*', '/api/alerts/:path*']
}
