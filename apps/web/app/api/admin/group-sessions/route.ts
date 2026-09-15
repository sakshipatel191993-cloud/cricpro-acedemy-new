import { NextRequest, NextResponse } from 'next/server';
import { createSessionSchedule } from '@/lib/session-schedule';
import { supabaseAdmin } from '@/lib/services/supabase';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const active = searchParams.get('active');

    let query = supabaseAdmin
      .from('group_sessions')
      .select('*')
      .eq('session_kind', searchParams.get('kind') === 'masterclass' ? 'masterclass' : 'group')
      .order('schedule');

    if (active !== null) {
      query = query.eq('active', active === 'true');
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ success: true, sessions: data });
  } catch (error) {
    console.error('Admin group sessions fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch group sessions' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const dateFields: Record<string, string> = {};
    if (['session_date', 'start_time', 'end_time'].some(key => body[key] !== undefined)) {
      try {
        body.schedule = createSessionSchedule(body.session_date, body.start_time, body.end_time);
        dateFields.session_date = body.session_date;
        dateFields.start_time = body.start_time;
        dateFields.end_time = body.end_time;
      } catch (error) {
        return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Invalid schedule' }, { status: 400 });
      }
    }
    const { title, age_group, max_players, coach_name, schedule, price, active, session_kind } = body;

    if (!title || !age_group || !max_players || !schedule || price === undefined) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (session_kind === 'masterclass') {
      if (!coach_name || !Number.isFinite(Number(price)) || Number(price) < 0 || !Number.isInteger(Number(max_players)) || Number(max_players) < 1) {
        return NextResponse.json({ success: false, error: 'A coach, valid price and capacity are required' }, { status: 400 });
      }
      const { data: coach, error: coachError } = await supabaseAdmin.from('coaches').select('id').eq('name', coach_name).single();
      if (coachError || !coach) return NextResponse.json({ success: false, error: 'Select an existing coach or add one first' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('group_sessions')
      .insert({
        ...dateFields,
        session_kind: session_kind === 'masterclass' ? 'masterclass' : 'group',
        title,
        age_group,
        max_players,
        current_players: 0,
        coach_name,
        schedule,
        price,
        active: active ?? true
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, session: data });
  } catch (error) {
    console.error('Admin group session create error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create group session' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const dateFields: Record<string, string> = {};
    if (['session_date', 'start_time', 'end_time'].some(key => body[key] !== undefined)) {
      try {
        body.schedule = createSessionSchedule(body.session_date, body.start_time, body.end_time);
        dateFields.session_date = body.session_date;
        dateFields.start_time = body.start_time;
        dateFields.end_time = body.end_time;
      } catch (error) {
        return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Invalid schedule' }, { status: 400 });
      }
    }
    const { id, title, age_group, max_players, coach_name, schedule, price, active, session_kind } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Session ID is required' },
        { status: 400 }
      );
    }

    if (session_kind === 'masterclass') {
      if (!coach_name || !Number.isFinite(Number(price)) || Number(price) < 0 || !Number.isInteger(Number(max_players)) || Number(max_players) < 1) {
        return NextResponse.json({ success: false, error: 'A coach, valid price and capacity are required' }, { status: 400 });
      }
      const { data: coach, error: coachError } = await supabaseAdmin.from('coaches').select('id').eq('name', coach_name).single();
      if (coachError || !coach) return NextResponse.json({ success: false, error: 'Select an existing coach or add one first' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = { ...dateFields };
    if (title) updateData.title = title;
    if (age_group) updateData.age_group = age_group;
    if (max_players) updateData.max_players = max_players;
    if (coach_name !== undefined) updateData.coach_name = coach_name;
    if (schedule) updateData.schedule = schedule;
    if (price !== undefined) updateData.price = price;
    if (active !== undefined) updateData.active = active;

    const { data, error } = await supabaseAdmin
      .from('group_sessions')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, session: data });
  } catch (error) {
    console.error('Admin group session update error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update group session' },
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
        { success: false, error: 'Session ID is required' },
        { status: 400 }
      );
    }

    // Check for existing bookings
    const { data: bookings } = await supabaseAdmin
      .from('group_session_bookings')
      .select('id')
      .eq('session_id', id)
      .limit(1);

    if (bookings && bookings.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete session with existing bookings' },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from('group_sessions')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin group session delete error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete group session' },
      { status: 500 }
    );
  }
}