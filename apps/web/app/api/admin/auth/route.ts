import { NextRequest, NextResponse } from 'next/server';
import { adminAuthConfigured, createAdminSession, isSameOriginRequest, verifyAdminPassword } from '@/lib/security/admin-auth';
import { enforceRateLimit } from '@/lib/security/rate-limit';
import { readJsonBody, RequestBodyError } from '@/lib/security/request-body';

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  if (!adminAuthConfigured()) return NextResponse.json({ success: false, error: 'Admin login is unavailable' }, { status: 503 });
  const limited = await enforceRateLimit(request, { policy: 'adminLogin' });
  if (limited) return limited;
  try {
    const body = await readJsonBody(request, 4096);
    if (!await verifyAdminPassword(body?.password)) return NextResponse.json({ success: false, error: 'Invalid password' }, { status: 401 });
    const response = NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } });
    response.cookies.set('admin_session', await createAdminSession(), {
      httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 86400, path: '/',
    });
    return response;
  } catch (error) {
    if (error instanceof RequestBodyError) return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    return NextResponse.json({ success: false, error: 'Invalid login request' }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  const response = NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } });
  response.cookies.delete('admin_session');
  return response;
}
