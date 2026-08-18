import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/services/supabase';

// Public endpoint: returns active resources for the booking flow.
// Unlike /api/admin/resources, this is NOT behind admin auth.
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type');

    let query = supabaseAdmin
      .from('resources')
      .select('*')
      .eq('active', true);

    if (type) {
      query = query.eq('type', type);
    }

    const { data, error } = await query
      .order('type')
      .order('name');

    if (error) throw error;

    return NextResponse.json({ success: true, resources: data });
  } catch (error) {
    console.error('Public resources fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch resources' },
      { status: 500 }
    );
  }
}
