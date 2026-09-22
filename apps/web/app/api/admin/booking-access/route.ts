import { NextRequest, NextResponse } from 'next/server';
import { isAdminMutationRequest } from '@/lib/security/admin-auth';
import { readJsonBody } from '@/lib/security/request-body';
import { supabaseAdmin } from '@/lib/services/supabase';
export async function POST(request: NextRequest) {
  if (!await isAdminMutationRequest(request)) return NextResponse.json({ error:'Forbidden' },{ status:403 });
  try {
    const body = await readJsonBody(request,1024);
    if (body.action !== 'revoke' || typeof body.bookingId !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(body.bookingId) || !['resource','group'].includes(String(body.kind))) return NextResponse.json({ error:'Invalid request' },{ status:400 });
    const { data,error } = await supabaseAdmin.from('booking_access_scopes').select('id').eq(body.kind === 'group' ? 'group_booking_id':'booking_id',body.bookingId).maybeSingle();
    if (error) throw error;
    if (data) {
      const result = await supabaseAdmin.rpc('revoke_booking_access',{ p_scope:data.id });
      if (result.error) throw result.error;
    }
    return NextResponse.json({ success:true },{ headers:{ 'Cache-Control':'no-store' } });
  } catch { return NextResponse.json({ error:'Revocation unavailable' },{ status:503 }); }
}
