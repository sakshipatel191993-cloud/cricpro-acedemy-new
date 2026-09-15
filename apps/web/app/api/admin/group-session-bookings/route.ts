import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/services/supabase';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const sessionId = searchParams.get('sessionId');

    let query = supabaseAdmin
      .from('group_session_bookings')
      .select(`
        *,
        session:group_sessions!inner(title, age_group, session_kind)
      `)
      .neq('status', 'cancelled')
      .neq('status', 'expired')
      .eq('session.session_kind', searchParams.get('kind') === 'masterclass' ? 'masterclass' : 'group')
      .order('created_at', { ascending: false });

    if (sessionId) {
      query = query.eq('session_id', sessionId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ success: true, bookings: data });
  } catch (error) {
    console.error('Admin group session bookings fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch bookings' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      session_id, 
      player_name, 
      player_age, 
      parent_name, 
      parent_email, 
      parent_phone,
      emergency_contact,
      medical_notes,
      skill_level
    } = body;

    if (!session_id || !player_name || !parent_name || !parent_email || !parent_phone) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check if session is full
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('group_sessions')
      .select('max_players, current_players')
      .eq('id', session_id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ success: false, error: 'Session not found' }, { status: 404 });
    }

    if (session.current_players >= session.max_players) {
      return NextResponse.json({ success: false, error: 'Session is full' }, { status: 400 });
    }

    // Create booking
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('group_session_bookings')
      .insert({
        session_id,
        player_name,
        player_age: player_age ? parseInt(player_age) : null,
        parent_name,
        parent_email,
        parent_phone,
        emergency_contact,
        medical_notes,
        skill_level
      })
      .select()
      .single();

    if (bookingError) throw bookingError;

    return NextResponse.json({ success: true, booking });
  } catch (error) {
    console.error('Admin group session booking create error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create booking' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id } = body;
    const updateData: Record<string, unknown> = {};
    for (const key of ['player_name', 'player_age', 'parent_name', 'parent_email', 'parent_phone', 'emergency_contact', 'medical_notes', 'skill_level']) {
      if (body[key] !== undefined) updateData[key] = body[key];
    }

    if (!id) {
      return NextResponse.json({ success: false, error: 'Booking ID is required' }, { status: 400 });
    }

    const { data: booking, error } = await supabaseAdmin
      .from('group_session_bookings')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, booking });
  } catch (error) {
    console.error('Admin group session booking update error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update booking' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Booking ID is required' },
        { status: 400 }
      );
    }

    // Keep payment records for reconciliation and release the place atomically.
    const { data: booking, error: lookupError } = await supabaseAdmin.from('group_session_bookings')
      .select('id, status').eq('id', id).single();
    if (lookupError || !booking) return NextResponse.json({ success: false, error: 'Booking not found' }, { status: 404 });
    if (booking.status === 'pending_payment') return NextResponse.json({ success: false, error: 'A payment is in progress. Wait for checkout to complete or expire.' }, { status: 409 });
    const { error } = await supabaseAdmin.from('group_session_bookings')
      .update({ status: 'cancelled' }).eq('id', id).neq('status', 'pending_payment');
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin group session booking delete error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete booking' },
      { status: 500 }
    );
  }
}