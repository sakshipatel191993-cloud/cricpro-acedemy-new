import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/services/supabase';
import { isSameOriginRequest } from '@/lib/security/admin-auth';
import { enforceRateLimit } from '@/lib/security/rate-limit';
import { readJsonBody, RequestBodyError } from '@/lib/security/request-body';

function londonDate(value: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(value);
  const part = (type: string) => parts.find(item => item.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ success: false }, { status: 403 });
  const limited = await enforceRateLimit(request, { policy: 'analytics' });
  if (limited) return limited;

  try {
    const body = await readJsonBody(request, 512);
    const sessionId = body.sessionId;
    if (typeof sessionId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sessionId)) {
      return NextResponse.json({ success: false }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from('website_visits').upsert(
      { visit_date: londonDate(new Date()), session_id: sessionId },
      { onConflict: 'visit_date,session_id', ignoreDuplicates: true },
    );
    if (error) throw error;
    return new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof RequestBodyError) return NextResponse.json({ success: false }, { status: error.status });
    console.error('Visit tracking error:', error);
    return NextResponse.json({ success: false }, { status: 503 });
  }
}
