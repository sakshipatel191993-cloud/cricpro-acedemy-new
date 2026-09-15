import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/services/supabase';

export async function GET() {
  const { data, error } = await supabaseAdmin.from('coaches').select('id, name').order('name');
  if (error) return NextResponse.json({ success: false, error: 'Unable to load coaches' }, { status: 500 });
  return NextResponse.json({ success: true, coaches: data });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name || name.length > 120) return NextResponse.json({ success: false, error: 'Enter a coach name (up to 120 characters)' }, { status: 400 });
  const { data, error } = await supabaseAdmin.from('coaches').insert({ name }).select('id, name').single();
  if (error) return NextResponse.json({ success: false, error: error.code === '23505' ? 'This coach already exists' : 'Unable to add coach' }, { status: error.code === '23505' ? 409 : 500 });
  return NextResponse.json({ success: true, coach: data }, { status: 201 });
}
