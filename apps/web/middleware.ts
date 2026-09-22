import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest, isSameOriginRequest } from './lib/security/admin-auth';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAdminRoute = (pathname === '/admin' || pathname.startsWith('/admin/')) && pathname !== '/admin/login';
  const isAdminApiRoute = (pathname === '/api/admin' || pathname.startsWith('/api/admin/')) && pathname !== '/api/admin/auth';
  if (!isAdminRoute && !isAdminApiRoute) return NextResponse.next();
  if (!await isAdminRequest(request)) {
    if (isAdminApiRoute) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const loginUrl = new URL('/admin/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }
  if (isAdminApiRoute && !['GET', 'HEAD', 'OPTIONS'].includes(request.method) && !isSameOriginRequest(request)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }
  return NextResponse.next();
}

export const config = { matcher: ['/admin/:path*', '/api/admin/:path*'] };
