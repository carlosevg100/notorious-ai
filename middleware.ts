import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: { headers: req.headers } })
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) { return req.cookies.get(name)?.value },
        set(name, value, options) {
          req.cookies.set({ name, value, ...options })
          res = NextResponse.next({ request: { headers: req.headers } })
          res.cookies.set({ name, value, ...options })
        },
        remove(name, options) {
          req.cookies.set({ name, value: '', ...options })
          res = NextResponse.next({ request: { headers: req.headers } })
          res.cookies.set({ name, value: '', ...options })
        }
      }
    }
  )
  
  const { data: { session } } = await supabase.auth.getSession()
  
  const isAuth = !!session
  const isDashboard = req.nextUrl.pathname.startsWith('/dashboard')
  const isLoginPage = req.nextUrl.pathname === '/login'
  
  if (!isAuth && isDashboard) {
    return NextResponse.redirect(new URL('/login', req.url))
  }
  if (isAuth && isLoginPage) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }
  
  return res
}

export const config = {
  matcher: ['/dashboard/:path*', '/login']
}
