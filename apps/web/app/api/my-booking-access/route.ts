import { NextRequest,NextResponse } from 'next/server';
import { getVerifiedCustomerId } from '@/lib/security/customer-auth';
import { guestAccessEnabled } from '@/lib/security/guest-access';
import { enforceRateLimit } from '@/lib/security/rate-limit';
import { supabaseAdmin } from '@/lib/services/supabase';
export async function GET(request: NextRequest) {
  const owner = await getVerifiedCustomerId(request);
  if (!owner) return NextResponse.json({ error:'Sign in required' },{ status:401 });
  const limited = await enforceRateLimit(request,{ policy:'privateRead',subject:owner });
  if (limited) return limited;
  if (!guestAccessEnabled()) return NextResponse.json({ bookings:[] },{ headers:{ 'Cache-Control':'private, no-store' } });
  const { data,error } = await supabaseAdmin.from('booking_access_scopes').select('booking_id,group_booking_id').eq('owner_id',owner).limit(100);
  if (error) return NextResponse.json({ error:'Bookings unavailable' },{ status:503 });
  return NextResponse.json({ bookings:(data ?? []).map(row => ({ kind:row.booking_id ? 'resource':'group',id:row.booking_id ?? row.group_booking_id })) },{ headers:{ 'Cache-Control':'private, no-store' } });
}
