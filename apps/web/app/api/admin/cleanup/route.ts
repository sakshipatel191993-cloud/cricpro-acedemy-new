import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/services/supabase';

// Expire pending_payment bookings older than 30 minutes
export async function POST() {
  try {
    const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();

    const { data, error } = await supabaseAdmin
      .from('bookings')
      .update({ status: 'cancelled', payment_status: 'failed' })
      .eq('status', 'pending_payment')
      .is('block_booking_id', null)
      .lt('expires_at', cutoff)
      .select('id, booking_reference');

    if (error) throw error;

    const count = data?.length ?? 0;
    console.log(`[Cleanup] Expired ${count} stale pending_payment bookings`);

    return NextResponse.json({ success: true, expired: count, bookings: data });
  } catch (error) {
    console.error('Cleanup error:', error);
    return NextResponse.json({ success: false, error: 'Cleanup failed' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data, error } = await supabaseAdmin
      .from('bookings')
      .select('id, booking_reference, expires_at, created_at')
      .eq('status', 'pending_payment')
      .is('block_booking_id', null)
      .lt('expires_at', cutoff);

    if (error) throw error;
    return NextResponse.json({ success: true, stale: data?.length ?? 0, bookings: data });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to check stale bookings' }, { status: 500 });
  }
}
