import { NextRequest, NextResponse } from 'next/server';
import { paymentsEnabled } from '@/lib/services/stripe';
import { reconcileGroupCheckouts } from '@/lib/services/session-checkout';
import { supabaseAdmin } from '@/lib/services/supabase';
import { isUpcomingSession } from '@/lib/session-options';

export async function GET(request: NextRequest) {
  try {
    if (paymentsEnabled) {
      const { data: pending } = await supabaseAdmin.from('group_session_bookings').select('session_id')
        .eq('status', 'pending_payment').lt('expires_at', new Date().toISOString()).limit(50);
      await Promise.all([...new Set((pending ?? []).map(row => row.session_id as string))].map(reconcileGroupCheckouts));
    }
    const { data, error } = await supabaseAdmin
      .from('group_sessions')
      .select('*')
      .eq('active', true)
      .eq('session_kind', request.nextUrl.searchParams.get('kind') === 'masterclass' ? 'masterclass' : 'group')
      .order('schedule');

    if (error) throw error;

    return NextResponse.json(
      { success: true, sessions: (data ?? []).filter(session => isUpcomingSession(session)) },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('Group sessions fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch group sessions' },
      { status: 500 }
    );
  }
}
